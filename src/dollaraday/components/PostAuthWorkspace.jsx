import { useEffect } from "react";
import {
  getDadProfiles,
  replaceAllDadProfiles,
} from "../lib/dadProfileStorage";
import { useDadAuth } from "../context/DadAuthContext.jsx";

/**
 * Keep the UI free. Background work is minimal and delayed:
 * 1) Immediate profile pull so admin sees pending members to approve
 * 2) Light local pool hydrate (no member reconcile storm)
 * 3) Full cloud sync later — never on every visibility flip
 * 4) No recurring automations on login — those run on-demand in Accounts
 */
export default function PostAuthWorkspace({ children }) {
  const { isAuthenticated } = useDadAuth();

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    let alive = true;
    const cleanups = [];

    // Profiles first — admin must see new pending members without waiting 12s.
    const profilePullTimer = window.setTimeout(() => {
      void import("../lib/supabase/cloudSync")
        .then(({ pullCloudProfilesNow }) => {
          if (!alive) return;
          return pullCloudProfilesNow(getDadProfiles, replaceAllDadProfiles);
        })
        .catch((err) => console.warn("[PostAuthWorkspace] Profile pull skipped:", err));
    }, 300);

    // Light local hydrate after first paint — no cloud, no registry rebuild.
    const localTimer = window.setTimeout(() => {
      void import("../lib/poolState")
        .then(({ hydratePoolStateFromStorage }) => {
          if (!alive) return;
          hydratePoolStateFromStorage();
        })
        .catch((err) => console.warn("[PostAuthWorkspace] Local hydrate skipped:", err));
    }, 800);

    // Full cloud sync once, deferred — never on every visibility flip.
    const cloudTimer = window.setTimeout(() => {
      if (!alive || document.visibilityState !== "visible") return;

      void (async () => {
        try {
          const { initCloudSync } = await import("../lib/supabase/cloudSync");
          if (!alive) return;

          const cleanupCloud = await initCloudSync({
            getLocalProfiles: getDadProfiles,
            replaceLocalProfiles: (profiles) => {
              replaceAllDadProfiles(profiles);
            },
            onProfilesChanged: (profiles) => {
              // Profiles only — never rebuild every member row mid-session.
              replaceAllDadProfiles(profiles);
            },
          });

          if (!alive) {
            cleanupCloud?.();
            return;
          }
          if (typeof cleanupCloud === "function") cleanups.push(cleanupCloud);

          // Optional deep reconcile once, far after cloud settle.
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
    }, 12_000);

    return () => {
      alive = false;
      window.clearTimeout(profilePullTimer);
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
