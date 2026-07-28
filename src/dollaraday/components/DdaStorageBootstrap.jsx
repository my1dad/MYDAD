import { useEffect, useState } from "react";
import { initInternalDatabase } from "../lib/internalDatabase";
import { dismissInitialPreloader } from "../lib/platformPreloader";
import PlatformPreloader from "./layout/PlatformPreloader";

/**
 * Fast path for login: only init local DB, then show UI.
 * Cloud sync / automations start after authentication (see PostAuthWorkspace).
 * The HTML shell preloader stays up until this marks ready.
 */
export default function DdaStorageBootstrap({ children }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        await initInternalDatabase();
      } catch (err) {
        console.warn("[DdaStorageBootstrap] Storage init issue, continuing:", err);
      } finally {
        if (alive) {
          setReady(true);
          // Next frame so login paints before shell preloader fades out.
          requestAnimationFrame(() => dismissInitialPreloader());
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  if (!ready) {
    // HTML #initial-preloader is still visible; keep React root empty/cheap.
    return null;
  }

  return <div className="h-full w-full overflow-hidden">{children}</div>;
}

export function BootstrapPreloader() {
  return <PlatformPreloader kicker="Loading" />;
}
