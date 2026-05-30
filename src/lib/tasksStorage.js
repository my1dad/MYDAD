import { isCurrentWorkspaceVersion, WORKSPACE_VERSION } from "./workspaceConstants";
import { readBinPayload, writeBinPayload } from "./storageAdapter";

const STORAGE_KEY = "over-drive-os-tasks";

export function loadTasks() {
  try {
    const data = readBinPayload(STORAGE_KEY);
    if (data && isCurrentWorkspaceVersion(data) && Array.isArray(data.tasks)) {
      return data.tasks;
    }
  } catch (err) {
    console.warn("Could not load tasks:", err);
  }
  return [];
}

export function saveTasks(tasks) {
  try {
    writeBinPayload(STORAGE_KEY, {
      version: WORKSPACE_VERSION,
      savedAt: new Date().toISOString(),
      tasks,
    });
  } catch (err) {
    console.warn("Could not save tasks:", err);
  }
}
