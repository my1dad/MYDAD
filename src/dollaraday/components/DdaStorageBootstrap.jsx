import { useEffect, useState } from "react";
import { initInternalDatabase } from "../lib/internalDatabase";
import { getActiveDadProfile } from "../lib/dadProfileStorage";
import { dismissInitialPreloader } from "../lib/platformPreloader";

/**
 * Fast path for login: only init local DB, then show UI.
 * Cloud sync / automations start after authentication (see PostAuthWorkspace).
 * The HTML shell preloader stays up only for a real returning session until App mounts.
 */
export default function DdaStorageBootstrap({ children }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    // Hard failsafe for guests stuck under the boot shell — skip if a real session is opening.
    const failsafeId = window.setTimeout(() => {
      if (!getActiveDadProfile()) dismissInitialPreloader();
    }, 3500);

    (async () => {
      try {
        await initInternalDatabase();
      } catch (err) {
        console.warn("[DdaStorageBootstrap] Storage init issue, continuing:", err);
      } finally {
        if (!alive) return;
        setReady(true);
        requestAnimationFrame(() => {
          // Guests (or orphan sessions cleared by getActiveDadProfile) must be interactive now.
          if (!getActiveDadProfile()) dismissInitialPreloader();
        });
      }
    })();

    return () => {
      alive = false;
      window.clearTimeout(failsafeId);
    };
  }, []);

  if (!ready) {
    // HTML #initial-preloader is still visible; keep React root empty/cheap.
    return null;
  }

  return <div className="h-full w-full overflow-hidden">{children}</div>;
}
