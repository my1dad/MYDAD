import { isCurrentWorkspaceVersion, WORKSPACE_VERSION } from "./workspaceConstants";
import { readBinPayload, writeBinPayload } from "./storageAdapter";

const STORAGE_KEY = "over-drive-os-project-bin";
const DRAFT_KEY = "over-drive-os-onboarding-draft";

export function loadProjectBin(fallbackProjects) {
  try {
    const data = readBinPayload(STORAGE_KEY);
    if (data && isCurrentWorkspaceVersion(data) && Array.isArray(data.projects)) {
      return {
        projects: data.projects,
        savedAt: data.savedAt ?? null,
      };
    }
  } catch (err) {
    console.warn("Could not load project bin:", err);
  }

  const projects = fallbackProjects();
  saveProjectBin(projects);
  return { projects, savedAt: new Date().toISOString() };
}

export function saveProjectBin(projects) {
  try {
    const bin = {
      version: WORKSPACE_VERSION,
      savedAt: new Date().toISOString(),
      projects,
    };
    writeBinPayload(STORAGE_KEY, bin);
    return bin;
  } catch (err) {
    console.warn("Could not save project bin:", err);
    return null;
  }
}

export function clearProjectBin() {
  writeBinPayload(STORAGE_KEY, null);
}

export function exportProjectBin(projects) {
  const bin = {
    version: 1,
    exportedAt: new Date().toISOString(),
    projects,
  };
  const blob = new Blob([JSON.stringify(bin, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `over-drive-os-projects-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export function loadOnboardingDraft() {
  try {
    const data = readBinPayload(DRAFT_KEY);
    if (data) return data;
  } catch (err) {
    console.warn("Could not load onboarding draft:", err);
  }
  return null;
}

export function saveOnboardingDraft(draft) {
  try {
    writeBinPayload(DRAFT_KEY, {
      ...draft,
      savedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("Could not save onboarding draft:", err);
  }
}

export function clearOnboardingDraft() {
  writeBinPayload(DRAFT_KEY, null);
}
