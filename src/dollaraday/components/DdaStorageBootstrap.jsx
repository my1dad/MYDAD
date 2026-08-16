import { useEffect } from "react";
import { ensureLocalBinsHydrated, initInternalDatabase } from "../lib/internalDatabase";

// Seed bins before first paint so authenticated reload doesn't flash empty balances.
ensureLocalBinsHydrated();

// If a prior wipe left the blank lock on, never paint stale cached members on boot.
try {
  if (
    localStorage.getItem("dollar-a-day-factory-zero") === "1" ||
    localStorage.getItem("dollar-a-day-platform-blank") === "1"
  ) {
    void import("../lib/dadProfileStorage").then(({ scrubLocalProfilesToAdminOnly }) => {
      // Re-check: login may have cleared the lock while this import was in flight.
      if (
        localStorage.getItem("dollar-a-day-factory-zero") === "1" ||
        localStorage.getItem("dollar-a-day-platform-blank") === "1"
      ) {
        scrubLocalProfilesToAdminOnly();
      }
    });
  }
} catch {
  /* ignore */
}

/**
 * Kick off full DB init in the background. Never block first paint / login / nav.
 */
export default function DdaStorageBootstrap({ children }) {
  useEffect(() => {
    void initInternalDatabase().catch((err) => {
      console.warn("[DdaStorageBootstrap] Storage init issue, continuing:", err);
    });

    // Cloud blank lock wins over any local profile cache as soon as the app boots.
    // Pause opportunistic pushes until this pull completes so stale bins cannot re-upload.
    void import("../lib/supabase/cloudSync")
      .then(async ({ pullCloudProfilesNow, pauseCloudPushes, markCloudAuthorityReady }) => {
        pauseCloudPushes(8_000);
        const { getDadProfiles, replaceAllDadProfiles } = await import("../lib/dadProfileStorage");
        await pullCloudProfilesNow(getDadProfiles, replaceAllDadProfiles);
        markCloudAuthorityReady();
      })
      .catch((err) => console.warn("[DdaStorageBootstrap] Cloud blank pull skipped:", err));
  }, []);

  return <div className="h-full w-full overflow-hidden">{children}</div>;
}
