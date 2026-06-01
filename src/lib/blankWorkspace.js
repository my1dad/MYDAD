import { WORKSPACE_BIN_IDS } from "./binCatalog";
import { createEmptyWorkspaceBins, getEmptyWorkspaceBinIds, getScopedLocalStorageKey } from "./profileWorkspaceScope";
import { isCurrentWorkspaceVersion, LEGACY_LOCAL_STORAGE_KEYS, WORKSPACE_VERSION } from "./workspaceConstants";
import { getActiveProfileId, readBinPayload, resetWorkspaceBinsOnDisk, writeBinPayloadImmediate } from "./storageAdapter";
import { clearWorkspaceActivityLog } from "./workspaceActivityLog";

const MIGRATION_BIN_ID = "over-drive-os-workspace-migration";

export { WORKSPACE_VERSION, isCurrentWorkspaceVersion };

export function clearProfileScopedLocalStorage(profileId) {
  if (!profileId) return;

  for (const binId of WORKSPACE_BIN_IDS) {
    localStorage.removeItem(getScopedLocalStorageKey(profileId, binId));
  }

  for (const key of LEGACY_LOCAL_STORAGE_KEYS) {
    localStorage.removeItem(key);
    localStorage.removeItem(getScopedLocalStorageKey(profileId, key));
  }
}

function hasStaleVersionedData() {
  return getEmptyWorkspaceBinIds().some((binId) => {
    const payload = readBinPayload(binId);
    return payload != null && !isCurrentWorkspaceVersion(payload);
  });
}

async function seedEmptyProfileWorkspace({ force = false } = {}) {
  const seeds = createEmptyWorkspaceBins();

  for (const binId of getEmptyWorkspaceBinIds()) {
    if (!force && readBinPayload(binId) != null) continue;
    const payload = seeds[binId];
    if (payload != null) {
      await writeBinPayloadImmediate(binId, payload);
    }
  }
}

/** Wipes workspace bins and re-seeds an empty dashboard for the signed-in profile. */
export async function resetActiveProfileWorkspace() {
  const profileId = getActiveProfileId();
  if (!profileId) {
    throw new Error("Sign in to reset your workspace.");
  }

  await resetWorkspaceBinsOnDisk();
  clearProfileScopedLocalStorage(profileId);
  clearWorkspaceActivityLog(profileId);
  await seedEmptyProfileWorkspace({ force: true });

  await writeBinPayloadImmediate(MIGRATION_BIN_ID, {
    version: WORKSPACE_VERSION,
    resetAt: new Date().toISOString(),
  });
}

/** Ensures the active profile has an empty workspace when first opened. */
export async function ensureBlankWorkspace() {
  const profileId = getActiveProfileId();
  if (!profileId) return false;

  try {
    const marker = readBinPayload(MIGRATION_BIN_ID);
    if (marker?.version === WORKSPACE_VERSION) {
      return false;
    }
  } catch {
    // Corrupt marker — rewrite below.
  }

  if (hasStaleVersionedData()) {
    await resetWorkspaceBinsOnDisk();
  }

  await seedEmptyProfileWorkspace();

  await writeBinPayloadImmediate(MIGRATION_BIN_ID, {
    version: WORKSPACE_VERSION,
    resetAt: new Date().toISOString(),
  });
  return true;
}
