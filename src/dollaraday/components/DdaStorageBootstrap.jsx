import { useEffect, useState } from "react";
import { initInternalDatabase } from "../lib/internalDatabase";
import { getActiveDadProfile } from "../lib/dadProfileStorage";
import { dismissInitialPreloader } from "../lib/platformPreloader";

/**
 * Fast path: init local DB, then show UI.
 * Cloud sync / automations start after authentication (see PostAuthWorkspace).
 * Guests dismiss the boot shell here; returning sessions dismiss in AppReady.
 */
export default function DdaStorageBootstrap({ children }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    // Absolute failsafe — never leave a click shield after boot.
    const failsafeId = window.setTimeout(() => dismissInitialPreloader(), 4000);

    (async () => {
      try {
        await initInternalDatabase();
      } catch (err) {
        console.warn("[DdaStorageBootstrap] Storage init issue, continuing:", err);
      } finally {
        if (!alive) return;
        setReady(true);
        requestAnimationFrame(() => {
          // Guests are interactive immediately. Sessions keep shell until App mounts.
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
