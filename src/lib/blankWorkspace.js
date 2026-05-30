import { isCurrentWorkspaceVersion, WORKSPACE_VERSION } from "./workspaceConstants";
import {
  readBinPayload,
  resetWorkspaceBinsOnDisk,
  writeBinPayload,
} from "./storageAdapter";

const MIGRATION_BIN_ID = "over-drive-os-workspace-migration";

export { WORKSPACE_VERSION, isCurrentWorkspaceVersion };

/** Clears stale workspace data when the blank version changes. Call after initBinStorage(). */
export async function ensureBlankWorkspace() {
  try {
    const marker = readBinPayload(MIGRATION_BIN_ID);
    if (marker?.version === WORKSPACE_VERSION) {
      return false;
    }
  } catch {
    // Corrupt marker — reset below.
  }

  await resetWorkspaceBinsOnDisk();
  writeBinPayload(MIGRATION_BIN_ID, {
    version: WORKSPACE_VERSION,
    resetAt: new Date().toISOString(),
  });
  return true;
}
