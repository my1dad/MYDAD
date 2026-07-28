import { useEffect, useState } from "react";
import { initInternalDatabase } from "../lib/internalDatabase";
import { getDadSessionId } from "../lib/dadProfileStorage";
import { dismissInitialPreloader } from "../lib/platformPreloader";

/**
 * Fast path for login: only init local DB, then show UI.
 * Cloud sync / automations start after authentication (see PostAuthWorkspace).
 * The HTML shell preloader stays up until login is interactive, or until the
 * authenticated app mounts for returning sessions.
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
          requestAnimationFrame(() => {
            // Returning sessions keep the shell preloader until App mounts.
            if (!getDadSessionId()) dismissInitialPreloader();
          });
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
