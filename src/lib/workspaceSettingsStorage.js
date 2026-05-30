import { readBinPayload, writeBinPayload } from "./storageAdapter";

const STORAGE_KEY = "over-drive-os-workspace-settings";

const DEFAULT_TAGS = ["Planning", "Review", "Client", "Internal"];

export function loadWorkspaceSettings() {
  try {
    const data = readBinPayload(STORAGE_KEY);
    if (data && Array.isArray(data.eventTags)) {
      return { eventTags: data.eventTags };
    }
  } catch (err) {
    console.warn("Could not load workspace settings:", err);
  }
  return { eventTags: [...DEFAULT_TAGS] };
}

export function saveWorkspaceSettings(settings) {
  try {
    writeBinPayload(STORAGE_KEY, {
      version: 1,
      savedAt: new Date().toISOString(),
      eventTags: settings.eventTags ?? [],
    });
  } catch (err) {
    console.warn("Could not save workspace settings:", err);
  }
}
