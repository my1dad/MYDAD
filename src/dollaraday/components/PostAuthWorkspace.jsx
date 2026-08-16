import { useEffect, useState } from "react";
import {
  getDadProfiles,
  replaceAllDadProfiles,
} from "../lib/dadProfileStorage";
import { useDadAuth } from "../context/DadAuthContext.jsx";

function WorkspaceBootFallback() {
  return (
    <div
      className="flex h-full w-full items-center justify-center bg-[var(--dda-bg,#0b1220)]"
      role="status"
      aria-live="polite"
      aria-label="Loading dashboard"
    >
      <div className="h-10 w-10 animate-pulse rounded-full bg-white/15" />
    </div>
  );
}

/**
 * Cloud-first workspace: adopt remote bins+profiles before the dashboard mounts.
 * Failed / unreachable cloud → empty $0 bins, never yesterday's localStorage.
 */
export default function PostAuthWorkspace({ children }) {
  const { isAuthenticated } = useDadAuth();
  const [workspaceReady, setWorkspaceReady] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setWorkspaceReady(false);
      return undefined;
    }

    let alive = true;
    const cleanups = [];
    setWorkspaceReady(false);

    const run = async () => {
      const cloudSync = await import("../lib/supabase/cloudSync");
      cloudSync.pauseCloudPushes(60_000);

      const result = await cloudSync.pullCloudWorkspaceNow({
        getLocalProfiles: getDadProfiles,
        replaceLocalProfiles: replaceAllDadProfiles,
      });
      if (!alive) return;

      if (result === "local-dev") {
        const { ensureLocalBinsHydrated } = await import("../lib/internalDatabase");
        ensureLocalBinsHydrated();
      }

      await cloudSync.rebuildWorkspaceStoresAfterAdopt();
      if (!alive) return;

      if (result !== "local-dev") {
        const cleanupCloud = await cloudSync.initCloudSync({
          skipInitialSync: result === "adopted" || result === "blank",
          getLocalProfiles: getDadProfiles,
          replaceLocalProfiles: replaceAllDadProfiles,
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
      }

      if (!alive) return;
      setWorkspaceReady(true);
    };

    void run().catch(async (err) => {
      console.warn("[PostAuthWorkspace] Workspace adopt failed:", err);
      try {
        const { rebuildWorkspaceStoresAfterAdopt } = await import("../lib/supabase/cloudSync");
        await rebuildWorkspaceStoresAfterAdopt();
      } catch {
        /* still ungate the shell */
      }
      if (!alive) return;
      setWorkspaceReady(true);
    });

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

  if (!isAuthenticated) return children;
  if (!workspaceReady) return <WorkspaceBootFallback />;
  return children;
}
