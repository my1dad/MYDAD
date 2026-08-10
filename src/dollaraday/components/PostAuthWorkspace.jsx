import { useEffect } from "react";
import {
  getDadProfiles,
  replaceAllDadProfiles,
} from "../lib/dadProfileStorage";
import { useDadAuth } from "../context/DadAuthContext.jsx";

/**
 * Keep the UI free. Background work is minimal and delayed:
 * 1) Pull cloud profiles (never re-upload stale local members onto a wipe)
 * 2) Rebuild member registry from profiles
 * 3) Light local pool hydrate
 * 4) Full cloud sync later — skipped while factory-zero lock is active
 */
export default function PostAuthWorkspace({ children }) {
  const { isAuthenticated } = useDadAuth();

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    let alive = true;
    const cleanups = [];

    const unlockTimer = window.setTimeout(() => {
      void import("../lib/supabase/cloudSync")
        .then(async ({
          clearFactoryZeroDeliveryLock,
          pauseCloudPushes,
          pullCloudProfilesNow,
          isFactoryZeroLocked,
        }) => {
          if (!alive) return;

          // Pull first. A newer admin-only cloud wipe replaces stale local members
          // and keeps the factory-zero lock — do not unlock just because local cache
          // still has pre-wipe people.
          await pullCloudProfilesNow(getDadProfiles, replaceAllDadProfiles);
          if (!alive) return;

          const afterPull = getDadProfiles();
          const liveMembers = afterPull.filter(
            (profile) => profile.username?.trim().toLowerCase() !== "admin",
          );

          if (liveMembers.length && !isFactoryZeroLocked()) {
            clearFactoryZeroDeliveryLock();
            pauseCloudPushes(0);
          } else if (!isFactoryZeroLocked() && !liveMembers.length) {
            pauseCloudPushes(0);
          }

          const { syncAllProfilesToMemberRegistry } = await import("../lib/profileRegistry");
          if (!alive) return;
          syncAllProfilesToMemberRegistry();
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

          // After pull, only skip full bin sync while wipe lock is still active
          // and the directory is still admin-only (blank backtest platform).
          const liveMembers = getDadProfiles().filter(
            (profile) => profile.username?.trim().toLowerCase() !== "admin",
          );
          if (isFactoryZeroLocked() && !liveMembers.length) {
            return;
          }

          if (liveMembers.length) {
            clearFactoryZeroDeliveryLock();
          }
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
