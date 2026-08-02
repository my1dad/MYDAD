import { useEffect } from "react";
import {
  ensureProfileProIds,
  getActiveDadProfile,
  getDadProfiles,
  replaceAllDadProfiles,
} from "../lib/dadProfileStorage";
import { useDadAuth } from "../context/DadAuthContext.jsx";

/**
 * Starts cloud sync + background automations only after the user is signed in.
 * UI paints from localStorage first — this work is idle-deferred and never blocks nav.
 * Heavy modules are dynamically imported so this stays out of the login bundle.
 */
export default function PostAuthWorkspace({ children }) {
  const { isAuthenticated } = useDadAuth();

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    let alive = true;
    const cleanups = [];

    const idle = window.requestIdleCallback
      ? (cb) => window.requestIdleCallback(cb, { timeout: 8000 })
      : (cb) => window.setTimeout(cb, 2500);

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
            { syncAllProfilesToMemberRegistry },
            { persistMemberFromProfile, pruneDuplicateAdminMemberRecords },
          ] = await Promise.all([
            import("../lib/supabase/cloudSync"),
            import("../lib/poolState"),
            import("../lib/allocationApy"),
            import("../lib/recurringCashflow"),
            import("../lib/allocationYieldAccrual"),
            import("../lib/recurringContributions"),
            import("../lib/profileRegistry"),
            import("../lib/memberRegistry"),
          ]);

          if (!alive) return;

          // Local hydrate first (cheap) — cloud pull follows once.
          syncAllProfilesToMemberRegistry();
          pruneDuplicateAdminMemberRecords();
          ensureProfileProIds();
          hydratePoolStateFromStorage();
          syncAllocationPoolMetrics();
          const profile = getActiveDadProfile();
          if (profile) persistMemberFromProfile(profile);

          // One initial sync, then realtime + rare backup poll (see cloudSync).
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

          if (!alive) return;
          // Each automation: run once on start, then long interval + visibility.
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
