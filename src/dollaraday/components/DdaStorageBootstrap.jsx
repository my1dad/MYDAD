import { useEffect } from "react";
import { ensureLocalBinsHydrated, initInternalDatabase } from "../lib/internalDatabase";

// Seed bins before first paint so authenticated reload doesn't flash empty balances.
ensureLocalBinsHydrated();

/**
 * Kick off full DB init in the background. Never block first paint / login / nav.
 */
export default function DdaStorageBootstrap({ children }) {
  useEffect(() => {
    void initInternalDatabase().catch((err) => {
      console.warn("[DdaStorageBootstrap] Storage init issue, continuing:", err);
    });
  }, []);

  return <div className="h-full w-full overflow-hidden">{children}</div>;
}
