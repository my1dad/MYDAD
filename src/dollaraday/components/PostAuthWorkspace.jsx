import { useEffect } from "react";
import {
  ensureProfileProIds,
  getActiveDadProfile,
  getDadProfiles,
  replaceAllDadProfiles,
} from "../lib/dadProfileStorage";
import { useDadAuth } from "../context/DadAuthContext.jsx";

/**
 * After login: paint UI first. Cloud sync + automations start much later on idle
 * so navigation is never fighting background work.
 */
export default function PostAuthWorkspace({ children }) {
  const { isAuthenticated } = useDadAuth();

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    let alive = true;
    const cleanups = [];

    const idle = window.requestIdleCallback
      ? (cb, opts) => window.requestIdleCallback(cb, opts)
      : (cb) => window.setTimeout(cb, 4000);

    const cancelIdle = window.cancelIdleCallback
      ? (id) => window.cancelIdleCallback(id)
      : (id) => window.clearTimeout(id);

    // Local hydrate only — cheap, no cloud, no automations.
    const localIdleId = idle(() => {
      void (async () => {
        try {
          const [
            { hydratePoolStateFromStorage },
            { persistMemberFromProfile, pruneDuplicateAdminMemberRecords },
          ] = await Promise.all([
            import("../lib/poolState"),
            import("../lib/memberRegistry"),
          ]);
          if (!alive) return;
          pruneDuplicateAdminMemberRecords();
          ensureProfileProIds();
          hydratePoolStateFromStorage();
          const profile = getActiveDadProfile();
          if (profile) persistMemberFromProfile(profile);
        } catch (err) {
          console.warn("[PostAuthWorkspace] Local hydrate skipped:", err);
        }
      })();
    }, { timeout: 2500 });

    // Cloud + automations: wait until the UI has been idle for a while.
    const cloudTimer = window.setTimeout(() => {
      const cloudIdleId = idle(() => {
        void (async () => {
          try {
            const [
              { initCloudSync },
              { hydratePoolStateFromStorage },
              { startRecurringCashflowAutomation },
              { startAllocationYieldAutomation },
              { startRecurringAutomation },
              { syncAllProfilesToMemberRegistry },
            ] = await Promise.all([
              import("../lib/supabase/cloudSync"),
              import("../lib/poolState"),
              import("../lib/recurringCashflow"),
              import("../lib/allocationYieldAccrual"),
              import("../lib/recurringContributions"),
              import("../lib/profileRegistry"),
            ]);

            if (!alive) return;

            const cleanupCloud = await initCloudSync({
              getLocalProfiles: getDadProfiles,
              replaceLocalProfiles: (profiles) => {
                replaceAllDadProfiles(profiles);
              },
              onProfilesChanged: (profiles) => {
                replaceAllDadProfiles(profiles);
                // Defer registry rebuild — never block taps with a full sync.
                idle(() => {
                  if (!alive) return;
                  syncAllProfilesToMemberRegistry();
                  hydratePoolStateFromStorage();
                }, { timeout: 5000 });
              },
            });

            if (!alive) {
              cleanupCloud?.();
              return;
            }
            if (typeof cleanupCloud === "function") cleanups.push(cleanupCloud);

            idle(() => {
              if (!alive) return;
              syncAllProfilesToMemberRegistry();
              cleanups.push(startRecurringCashflowAutomation());
              cleanups.push(startAllocationYieldAutomation());
              cleanups.push(startRecurringAutomation());
            }, { timeout: 15000 });
          } catch (err) {
            console.warn("[PostAuthWorkspace] Background sync issue:", err);
          }
        })();
      }, { timeout: 8000 });
      cleanups.push(() => cancelIdle(cloudIdleId));
    }, 6000);

    return () => {
      alive = false;
      cancelIdle(localIdleId);
      window.clearTimeout(cloudTimer);
      while (cleanups.length) {
        const stop = cleanups.pop();
        if (typeof stop === "function") stop();
      }
    };
  }, [isAuthenticated]);

  return children;
}
