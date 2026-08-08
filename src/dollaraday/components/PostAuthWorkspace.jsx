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
        .then(async ({
          clearFactoryZeroDeliveryLock,
          pauseCloudPushes,
          pullCloudProfilesNow,
          isFactoryZeroLocked,
          persistMembersToCloud,
        }) => {
          if (!alive) return;

          const locals = getDadProfiles();
          const members = locals.filter(
            (profile) => profile.username?.trim().toLowerCase() !== "admin",
          );

          // Never re-wipe cloud on login. If members exist, unlock and force-save them.
          if (members.length) {
            clearFactoryZeroDeliveryLock();
            pauseCloudPushes(0);
            try {
              await persistMembersToCloud(members);
            } catch (err) {
              console.warn("[PostAuthWorkspace] Member re-persist skipped:", err);
            }
          } else if (!isFactoryZeroLocked()) {
            clearFactoryZeroDeliveryLock();
            pauseCloudPushes(0);
          }

          // Always pull cloud profiles so approved members return after logout/login.
          await pullCloudProfilesNow(getDadProfiles, replaceAllDadProfiles);
          if (!alive) return;
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

          // If members already exist, drop the reset lock so profile sync can run.
          // Still avoid pulling pre-reset liquidity when the lock remains and there
          // are no members yet (fresh wipe).
          const localMembers = getDadProfiles().filter(
            (profile) => profile.username?.trim().toLowerCase() !== "admin",
          );
          if (localMembers.length) {
            clearFactoryZeroDeliveryLock();
          } else if (isFactoryZeroLocked()) {
            // Fresh wipe with no members — skip full bin sync to keep liquidity at $0.
            // Profiles were already pulled above.
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
