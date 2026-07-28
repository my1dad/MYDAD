import { useEffect } from "react";
import {
  ensureProfileProIds,
  getActiveDadProfile,
  getDadProfiles,
  replaceAllDadProfiles,
} from "../lib/dadProfileStorage";
import { syncAllProfilesToMemberRegistry } from "../lib/profileRegistry";
import { persistMemberFromProfile, pruneDuplicateAdminMemberRecords } from "../lib/memberRegistry";
import { useDadAuth } from "../context/DadAuthContext.jsx";

function hydrateLocalWorkspace(hydratePoolStateFromStorage, syncAllocationPoolMetrics) {
  syncAllProfilesToMemberRegistry();
  pruneDuplicateAdminMemberRecords();
  ensureProfileProIds();
  syncAllProfilesToMemberRegistry();
  hydratePoolStateFromStorage?.();
  syncAllocationPoolMetrics?.();
  const profile = getActiveDadProfile();
  if (profile) {
    persistMemberFromProfile(profile);
  }
}

/**
 * Starts cloud sync + background automations only after the user is signed in.
 * Keeps the login screen free of network/localStorage thrash while typing.
 */
export default function PostAuthWorkspace({ children }) {
  const { isAuthenticated } = useDadAuth();

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    let alive = true;
    const cleanups = [];

    const idle = window.requestIdleCallback
      ? (cb) => window.requestIdleCallback(cb, { timeout: 1500 })
      : (cb) => window.setTimeout(cb, 0);

    const cancelIdle = window.cancelIdleCallback
      ? (id) => window.cancelIdleCallback(id)
      : (id) => window.clearTimeout(id);

    const idleId = idle(() => {
      void (async () => {
        try {
          const [
            { initCloudSync, pushCloudProfilesNow },
            { hydratePoolStateFromStorage },
            { syncAllocationPoolMetrics },
            { startRecurringCashflowAutomation },
            { startAllocationYieldAutomation },
            { startRecurringAutomation },
          ] = await Promise.all([
            import("../lib/supabase/cloudSync"),
            import("../lib/poolState"),
            import("../lib/allocationApy"),
            import("../lib/recurringCashflow"),
            import("../lib/allocationYieldAccrual"),
            import("../lib/recurringContributions"),
          ]);

          if (!alive) return;

          hydrateLocalWorkspace(hydratePoolStateFromStorage, syncAllocationPoolMetrics);

          const cleanupCloud = await initCloudSync({
            getLocalProfiles: getDadProfiles,
            replaceLocalProfiles: (profiles) => {
              replaceAllDadProfiles(profiles);
              syncAllProfilesToMemberRegistry();
            },
            onProfilesChanged: (profiles) => {
              replaceAllDadProfiles(profiles);
              syncAllProfilesToMemberRegistry();
              hydratePoolStateFromStorage();
            },
          });

          if (!alive) {
            cleanupCloud?.();
            return;
          }
          if (typeof cleanupCloud === "function") cleanups.push(cleanupCloud);

          void pushCloudProfilesNow(getDadProfiles()).catch((err) =>
            console.warn("[PostAuthWorkspace] Profile push skipped:", err),
          );

          hydrateLocalWorkspace(hydratePoolStateFromStorage, syncAllocationPoolMetrics);

          if (!alive) return;
          cleanups.push(startRecurringCashflowAutomation());
          cleanups.push(startAllocationYieldAutomation());
          cleanups.push(startRecurringAutomation());
        } catch (err) {
          console.warn("[PostAuthWorkspace] Background sync issue:", err);
        }
      })();
    });

    return () => {
      alive = false;
      cancelIdle(idleId);
      while (cleanups.length) {
        const stop = cleanups.pop();
        if (typeof stop === "function") stop();
      }
    };
  }, [isAuthenticated]);

  return children;
}
