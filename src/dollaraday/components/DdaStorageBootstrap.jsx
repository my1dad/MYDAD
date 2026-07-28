import { useEffect, useState } from "react";
import {
  ensureProfileProIds,
  getActiveDadProfile,
  getDadProfiles,
  replaceAllDadProfiles,
} from "../lib/dadProfileStorage";
import { syncAllProfilesToMemberRegistry } from "../lib/profileRegistry";
import { initInternalDatabase } from "../lib/internalDatabase";
import { persistMemberFromProfile, pruneDuplicateAdminMemberRecords } from "../lib/memberRegistry";

function StorageLoadingFallback() {
  return (
    <div
      className="flex h-full min-h-[100dvh] w-full items-center justify-center bg-[#071013]"
      aria-live="polite"
      aria-label="Loading My Dollar A Day"
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-emerald-400" />
        <p className="text-sm font-medium text-gray-400">Loading workspace…</p>
      </div>
    </div>
  );
}

function hydrateLocalWorkspace() {
  syncAllProfilesToMemberRegistry();
  pruneDuplicateAdminMemberRecords();
  ensureProfileProIds();
  syncAllProfilesToMemberRegistry();
  const profile = getActiveDadProfile();
  if (profile) {
    persistMemberFromProfile(profile);
  }
}

/**
 * Unblocks the login UI as soon as local storage is ready.
 * Cloud sync + automations continue in the background and must never
 * prevent typing credentials.
 */
export default function DdaStorageBootstrap({ children, fallback = <StorageLoadingFallback /> }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    const cleanups = [];

    (async () => {
      try {
        await initInternalDatabase();
        if (!alive) return;

        try {
          hydrateLocalWorkspace();
        } catch (err) {
          console.warn("[DdaStorageBootstrap] Local hydrate issue:", err);
        }

        // Login / guest UI becomes interactive immediately.
        setReady(true);

        // Heavy cloud + automation work loads asynchronously after paint.
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

          hydratePoolStateFromStorage();
          syncAllocationPoolMetrics();

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

          syncAllProfilesToMemberRegistry();
          void pushCloudProfilesNow(getDadProfiles()).catch((err) =>
            console.warn("[DdaStorageBootstrap] Profile push skipped:", err),
          );

          hydrateLocalWorkspace();
          hydratePoolStateFromStorage();
          syncAllocationPoolMetrics();

          if (!alive) return;
          cleanups.push(startRecurringCashflowAutomation());
          cleanups.push(startAllocationYieldAutomation());
          cleanups.push(startRecurringAutomation());
        } catch (err) {
          console.warn("[DdaStorageBootstrap] Background sync issue, continuing offline:", err);
        }
      } catch (err) {
        console.warn("[DdaStorageBootstrap] Storage init issue, continuing:", err);
        if (alive) setReady(true);
      }
    })();

    return () => {
      alive = false;
      while (cleanups.length) {
        const stop = cleanups.pop();
        if (typeof stop === "function") stop();
      }
    };
  }, []);

  if (!ready) return fallback;
  return <div className="h-full w-full overflow-hidden">{children}</div>;
}
