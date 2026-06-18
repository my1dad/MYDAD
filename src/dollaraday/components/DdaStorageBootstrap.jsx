import { useEffect, useState } from "react";
import { getActiveDadProfile } from "../lib/dadProfileStorage";
import { initInternalDatabase } from "../lib/internalDatabase";
import { persistMemberFromProfile } from "../lib/memberRegistry";
import { hydratePoolStateFromStorage } from "../lib/poolState";
import { startRecurringAutomation } from "../lib/recurringContributions";

const INIT_TIMEOUT_MS = 8000;

export default function DdaStorageBootstrap({ children, fallback = null }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    let cleanupRecurring = null;

    (async () => {
      try {
        const result = await Promise.race([
          (async () => {
            await initInternalDatabase();
            hydratePoolStateFromStorage();
            const profile = getActiveDadProfile();
            if (profile) {
              persistMemberFromProfile(profile);
            }
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
    };
  }, []);

  if (!ready) return fallback;
  return <div className="h-full w-full overflow-hidden">{children}</div>;
}
