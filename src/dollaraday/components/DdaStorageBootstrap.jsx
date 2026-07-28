import { useEffect, useState } from "react";
import { initInternalDatabase } from "../lib/internalDatabase";

function StorageLoadingFallback() {
  return (
    <div
      className="flex h-full min-h-[100dvh] w-full items-center justify-center bg-[#071013]"
      aria-live="polite"
      aria-label="Loading My Dollar A Day"
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-emerald-400" />
        <p className="text-sm font-medium text-gray-400">Loading…</p>
      </div>
    </div>
  );
}

/**
 * Fast path for login: only init local DB, then show UI.
 * Cloud sync / automations start after authentication (see PostAuthWorkspace).
 */
export default function DdaStorageBootstrap({ children, fallback = <StorageLoadingFallback /> }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        await initInternalDatabase();
      } catch (err) {
        console.warn("[DdaStorageBootstrap] Storage init issue, continuing:", err);
      } finally {
        if (alive) setReady(true);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  if (!ready) return fallback;
  return <div className="h-full w-full overflow-hidden">{children}</div>;
}
