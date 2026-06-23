import { useEffect, useState } from "react";
import { getActiveDadProfile } from "../lib/dadProfileStorage";
import { initInternalDatabase } from "../lib/internalDatabase";
import { persistMemberFromProfile } from "../lib/memberRegistry";
import { hydratePoolStateFromStorage } from "../lib/poolState";
import { startRecurringAutomation } from "../lib/recurringContributions";
import { startRecurringCashflowAutomation } from "../lib/recurringCashflow";

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
            cleanupCashflow = startRecurringCashflowAutomation();
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
    };
  }, []);

  if (!ready) return fallback;
  return <div className="h-full w-full overflow-hidden">{children}</div>;
}
