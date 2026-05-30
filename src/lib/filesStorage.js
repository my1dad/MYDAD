import { isCurrentWorkspaceVersion, WORKSPACE_VERSION } from "./workspaceConstants";
import { hydrateAttachments, readBinPayload, writeBinPayload } from "./storageAdapter";

const STORAGE_KEY = "over-drive-os-file-bin";

export function loadFileBin() {
  try {
    const data = readBinPayload(STORAGE_KEY);
    if (data && isCurrentWorkspaceVersion(data) && Array.isArray(data.files)) {
      return {
        files: data.files,
        savedAt: data.savedAt ?? null,
      };
    }
  } catch (err) {
    console.warn("Could not load file bin:", err);
  }
  return { files: [], savedAt: null };
}

export async function loadFileBinHydrated() {
  const bin = loadFileBin();
  return {
    ...bin,
    files: await hydrateAttachments(bin.files),
  };
}

export function saveFileBin(files) {
  try {
    const bin = {
      version: WORKSPACE_VERSION,
      savedAt: new Date().toISOString(),
      files,
    };
    writeBinPayload(STORAGE_KEY, bin);
    return bin;
  } catch (err) {
    console.warn("Could not save file bin:", err);
    return null;
  }
}
