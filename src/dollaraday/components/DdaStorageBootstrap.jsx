import { useEffect, useState } from "react";
import {
  ensureProfileProIds,
  getActiveDadProfile,
  getDadProfiles,
  replaceAllDadProfiles,
} from "../lib/dadProfileStorage";
import { syncAllProfilesToMemberRegistry } from "../lib/profileRegistry";
import { initInternalDatabase } from "../lib/internalDatabase";
import { initCloudSync } from "../lib/supabase/cloudSync";
import { persistMemberFromProfile, pruneDuplicateAdminMemberRecords } from "../lib/memberRegistry";
import { hydratePoolStateFromStorage } from "../lib/poolState";
import { syncAllocationPoolMetrics } from "../lib/allocationApy";
import { startRecurringAutomation } from "../lib/recurringContributions";
import { startRecurringCashflowAutomation } from "../lib/recurringCashflow";
import { startAllocationYieldAutomation } from "../lib/allocationYieldAccrual";

const INIT_TIMEOUT_MS = 8000;

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

export default function DdaStorageBootstrap({ children, fallback = <StorageLoadingFallback /> }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    let cleanupRecurring = null;
    let cleanupCashflow = null;
    let cleanupAllocationYield = null;

    let cleanupCloud = null;

    (async () => {
      try {
        const result = await Promise.race([
          (async () => {
            await initInternalDatabase();
            cleanupCloud = await initCloudSync({
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
            pruneDuplicateAdminMemberRecords();
            ensureProfileProIds();
            syncAllProfilesToMemberRegistry();
            hydratePoolStateFromStorage();
            syncAllocationPoolMetrics();
            const profile = getActiveDadProfile();
            if (profile) {
              persistMemberFromProfile(profile);
            }
            cleanupCashflow = startRecurringCashflowAutomation();
            cleanupAllocationYield = startAllocationYieldAutomation();
            return startRecurringAutomation();
          })(),
          new Promise((_, reject) => {
            window.setTimeout(
              () => reject(new Error("Dollar A Day storage init timed out")),
              INIT_TIMEOUT_MS
            );
          }),
        ]);
        cleanupRecurring = result;
      } catch (err) {
        console.warn("[DdaStorageBootstrap] Storage init issue, continuing:", err);
      } finally {
        if (alive) setReady(true);
      }
    })();

    return () => {
      alive = false;
      if (typeof cleanupRecurring === "function") {
        cleanupRecurring();
      }
      if (typeof cleanupCashflow === "function") {
        cleanupCashflow();
      }
      if (typeof cleanupAllocationYield === "function") {
        cleanupAllocationYield();
      }
      if (typeof cleanupCloud === "function") {
        cleanupCloud();
      }
    };
  }, []);

  if (!ready) return fallback;
  return <div className="h-full w-full overflow-hidden">{children}</div>;
}
