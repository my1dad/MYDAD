import { useEffect } from "react";
import { initInternalDatabase } from "../lib/internalDatabase";

/**
 * Kick off local DB in the background. Never block first paint / login / nav.
 */
export default function DdaStorageBootstrap({ children }) {
  useEffect(() => {
    void initInternalDatabase().catch((err) => {
      console.warn("[DdaStorageBootstrap] Storage init issue, continuing:", err);
    });
  }, []);

  return <div className="h-full w-full overflow-hidden">{children}</div>;
}
