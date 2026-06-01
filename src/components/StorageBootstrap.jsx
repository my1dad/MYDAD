import { useEffect, useState } from "react";
import { getRoadmapSessionId } from "../data/roadmapProfileStorage";
import { ensureBlankWorkspace } from "../lib/blankWorkspace";
import { resetDeletedItemsMemoryCache } from "../lib/deletedItemsStorage";
import { initBinStorage } from "../lib/storageAdapter";

const INIT_TIMEOUT_MS = 8000;

export default function StorageBootstrap({ children, fallback = null }) {
  const [readyProfileKey, setReadyProfileKey] = useState(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        await Promise.race([
          (async () => {
            const profileId = getRoadmapSessionId();
            await initBinStorage(profileId);
            resetDeletedItemsMemoryCache();
            if (profileId) await ensureBlankWorkspace();
          })(),
          new Promise((_, reject) => {
            window.setTimeout(
              () => reject(new Error("Workspace storage init timed out")),
              INIT_TIMEOUT_MS
            );
          }),
        ]);
      } catch (err) {
        console.warn("[StorageBootstrap] Storage init issue, continuing:", err);
      } finally {
        if (alive) {
          const profileId = getRoadmapSessionId();
          setReadyProfileKey(profileId ?? "__guest__");
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  if (!readyProfileKey) return fallback;
  return <div key={readyProfileKey}>{children}</div>;
}
