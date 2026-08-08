import { useEffect } from "react";
import {
  getDadProfiles,
  replaceAllDadProfiles,
} from "../lib/dadProfileStorage";
import { useDadAuth } from "../context/DadAuthContext.jsx";

/**
 * Keep the UI free. Background work is minimal and delayed:
 * 1) Unlock delivery lock + pull profiles so admin sees members immediately
 *    (skipped while factory-zero lock is active after master reset)
 * 2) Rebuild member registry from profiles
 * 3) Light local pool hydrate
 * 4) Full cloud sync later
 */
export default function PostAuthWorkspace({ children }) {
  const { isAuthenticated } = useDadAuth();

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    let alive = true;
    const cleanups = [];

    const unlockTimer = window.setTimeout(() => {
      void import("../lib/supabase/cloudSync")
        .then(({ clearFactoryZeroDeliveryLock, pauseCloudPushes, pullCloudProfilesNow, isFactoryZeroLocked }) => {
          if (!alive) return null;

          // Master reset sets factory-zero so wiped liquidity/members stay gone.
          // Clearing that lock here was resurrecting cloud pool + member data on reload.
          if (isFactoryZeroLocked()) {
            return pullCloudProfilesNow(getDadProfiles, replaceAllDadProfiles);
          }

          clearFactoryZeroDeliveryLock();
          pauseCloudPushes(0);
          return pullCloudProfilesNow(getDadProfiles, replaceAllDadProfiles);
        })
        .then(() => {
          if (!alive) return null;
          return import("../lib/profileRegistry").then(({ syncAllProfilesToMemberRegistry }) => {
            if (!alive) return;
            syncAllProfilesToMemberRegistry();
          });
        })
        .catch((err) => console.warn("[PostAuthWorkspace] Profile restore skipped:", err));
    }, 50);

    // Light local hydrate after first paint.
    const localTimer = window.setTimeout(() => {
      void import("../lib/poolState")
        .then(({ hydratePoolStateFromStorage }) => {
          if (!alive) return;
          hydratePoolStateFromStorage();
        })
        .catch((err) => console.warn("[PostAuthWorkspace] Local hydrate skipped:", err));
    }, 800);

    // Full cloud sync once, deferred — skip while factory-zero lock is active.
    const cloudTimer = window.setTimeout(() => {
      if (!alive || document.visibilityState !== "visible") return;

      void (async () => {
        try {
          const {
            initCloudSync,
            clearFactoryZeroDeliveryLock,
            pauseCloudPushes,
            isFactoryZeroLocked,
          } = await import("../lib/supabase/cloudSync");
          if (!alive) return;

          if (isFactoryZeroLocked()) {
            // Keep the post-reset wipe lock. Full sync here was reloading pre-reset
            // liquidity/members from cloud after Master reset.
            return;
          }

          clearFactoryZeroDeliveryLock();
          pauseCloudPushes(0);

          const cleanupCloud = await initCloudSync({
            getLocalProfiles: getDadProfiles,
            replaceLocalProfiles: (profiles) => {
              replaceAllDadProfiles(profiles);
            },
            onProfilesChanged: (profiles) => {
              replaceAllDadProfiles(profiles);
              void import("../lib/profileRegistry").then(({ syncAllProfilesToMemberRegistry }) => {
                syncAllProfilesToMemberRegistry();
              });
            },
          });

          if (!alive) {
            cleanupCloud?.();
            return;
          }
          if (typeof cleanupCloud === "function") cleanups.push(cleanupCloud);

          void import("../lib/profileRegistry").then(({ syncAllProfilesToMemberRegistry }) => {
            if (!alive) return;
            syncAllProfilesToMemberRegistry();
          });

          window.setTimeout(() => {
            if (!alive || document.visibilityState !== "visible") return;
            void import("../lib/poolState").then(({ hydratePoolStateFromStorage }) => {
              if (!alive) return;
              hydratePoolStateFromStorage({ reconcile: true });
            });
          }, 45_000);
        } catch (err) {
          console.warn("[PostAuthWorkspace] Cloud sync deferred:", err);
        }
      })();
    }, 4_000);

    return () => {
      alive = false;
      window.clearTimeout(unlockTimer);
      window.clearTimeout(localTimer);
      window.clearTimeout(cloudTimer);
      while (cleanups.length) {
        const stop = cleanups.pop();
        if (typeof stop === "function") stop();
      }
    };
  }, [isAuthenticated]);

  return children;
}
