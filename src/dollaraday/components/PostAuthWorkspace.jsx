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
 * Failed / unreachable cloud keeps the boot screen — never yesterday's cache or a $0 wipe.
 */
export default function PostAuthWorkspace({ children }) {
  const { isAuthenticated } = useDadAuth();
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [workspaceError, setWorkspaceError] = useState("");
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) {
      setWorkspaceReady(false);
      setWorkspaceError("");
      return undefined;
    }

    let alive = true;
    const cleanups = [];
    setWorkspaceReady(false);
    setWorkspaceError("");

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

    void run().catch((err) => {
      console.warn("[PostAuthWorkspace] Workspace adopt failed:", err);
      if (!alive) return;
      setWorkspaceError(err?.message || "Could not load the live workspace.");
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
  }, [isAuthenticated, retryTick]);

  if (!isAuthenticated) return children;
  if (workspaceError) {
    return (
      <div
        className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[var(--dda-bg,#0b1220)] px-6 text-center"
        role="alert"
      >
        <p className="text-lg font-semibold text-white">Live workspace unavailable</p>
        <p className="max-w-md text-sm text-gray-400">
          The dashboard did not load from the cloud. Retry to avoid opening on empty or stale data.
        </p>
        <button
          type="button"
          onClick={() => setRetryTick((tick) => tick + 1)}
          className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
        >
          Retry
        </button>
      </div>
    );
  }
  if (!workspaceReady) return <WorkspaceBootFallback />;
  return children;
}
