import { useEffect } from "react";
import {
  ensureLocalBinsHydrated,
  initInternalDatabase,
  seedEmptyBinsInMemory,
} from "../lib/internalDatabase";
import { isSupabaseConfigured } from "../lib/supabase/client";

if (isSupabaseConfigured()) {
  // Cloud-first: never seed yesterday's localStorage bins into the first paint.
  seedEmptyBinsInMemory();
} else {
  ensureLocalBinsHydrated();
}

// If a prior wipe left the blank lock on, never paint stale cached members on boot.
try {
  if (
    localStorage.getItem("dollar-a-day-factory-zero") === "1" ||
    localStorage.getItem("dollar-a-day-platform-blank") === "1"
  ) {
    void import("../lib/dadProfileStorage").then(({ scrubLocalProfilesToAdminOnly }) => {
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

    // Profiles-only pull for the login directory. Do not mark bin-push authority.
    void import("../lib/supabase/cloudSync")
      .then(async ({ pullCloudProfilesNow, pauseCloudPushes }) => {
        pauseCloudPushes(60_000);
        const { getDadProfiles, replaceAllDadProfiles } = await import("../lib/dadProfileStorage");
        await pullCloudProfilesNow(getDadProfiles, replaceAllDadProfiles);
      })
      .catch((err) => console.warn("[DdaStorageBootstrap] Cloud profile pull skipped:", err));
  }, []);

  return <div className="h-full w-full overflow-hidden">{children}</div>;
}
