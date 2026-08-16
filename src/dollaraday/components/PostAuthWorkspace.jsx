import { useEffect } from "react";
import {
  getDadProfiles,
  replaceAllDadProfiles,
} from "../lib/dadProfileStorage";
import { useDadAuth } from "../context/DadAuthContext.jsx";

/**
 * Keep the UI free. Background work is ordered for cloud authority:
 * 1) Pull cloud profiles + adopt remote bins (never re-upload stale local members)
 * 2) Rebuild member registry from the adopted directory
 * 3) Light local pool hydrate
 * 4) Full cloud sync later — blank lock still blocks fat pushes
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
          adoptOpenPlatformFromCloud,
          pauseCloudPushes,
          pullCloudProfilesNow,
          isFactoryZeroLocked,
          isCloudPlatformBlank,
          markCloudAuthorityReady,
          getWorkspaceEpoch,
        }) => {
          if (!alive) return;

          // Pull first. A newer admin-only cloud wipe replaces stale local members
          // and keeps the factory-zero lock — do not unlock just because local cache
          // still has pre-wipe people.
          await pullCloudProfilesNow(getDadProfiles, replaceAllDadProfiles);
          if (!alive) return;

          const blank = await isCloudPlatformBlank().catch(() => isFactoryZeroLocked());
          if (!alive) return;

          if (blank) {
            // Keep pushes paused; blank lock continues to block fat republish.
            markCloudAuthorityReady();
          } else {
            adoptOpenPlatformFromCloud(getWorkspaceEpoch());
            pauseCloudPushes(0);
          }

          const { syncAllProfilesToMemberRegistry } = await import("../lib/profileRegistry");
          if (!alive) return;
          syncAllProfilesToMemberRegistry();
        })
        .catch((err) => console.warn("[PostAuthWorkspace] Profile restore skipped:", err));
    }, 50);

    // Light local hydrate after first paint — after cloud pull had a chance to run.
    const localTimer = window.setTimeout(() => {
      void import("../lib/poolState")
        .then(({ hydratePoolStateFromStorage }) => {
          if (!alive) return;
          hydratePoolStateFromStorage();
        })
        .catch((err) => console.warn("[PostAuthWorkspace] Local hydrate skipped:", err));
    }, 800);

    // Full cloud sync once, deferred. Always run — admin-only cloud wipe applies $0 bins here.
    const cloudTimer = window.setTimeout(() => {
      if (!alive || document.visibilityState !== "visible") return;

      void (async () => {
        try {
          const {
            initCloudSync,
            adoptOpenPlatformFromCloud,
            pauseCloudPushes,
            isFactoryZeroLocked,
            isCloudPlatformBlank,
            getWorkspaceEpoch,
          } = await import("../lib/supabase/cloudSync");
          if (!alive) return;

          const blank = await isCloudPlatformBlank().catch(() => isFactoryZeroLocked());
          if (blank) {
            // Keep pushes paused; sync still pulls blank bins from cloud.
          } else {
            adoptOpenPlatformFromCloud(getWorkspaceEpoch());
            pauseCloudPushes(0);
          }

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

    cleanups.push(() => window.clearTimeout(unlockTimer));
    cleanups.push(() => window.clearTimeout(localTimer));
    cleanups.push(() => window.clearTimeout(cloudTimer));

    return () => {
      alive = false;
      cleanups.forEach((fn) => {
        try {
          fn();
        } catch {
          /* ignore */
        }
      });
    };
  }, [isAuthenticated]);

  return children;
}
