const STORAGE_KEY = "over-drive-os-project-bin";
const DRAFT_KEY = "over-drive-os-onboarding-draft";

export function loadProjectBin(fallbackProjects) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data.projects)) {
        return {
          projects: data.projects,
          savedAt: data.savedAt ?? null,
        };
      }
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
      version: 1,
      savedAt: new Date().toISOString(),
      projects,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bin));
    return bin;
  } catch (err) {
    console.warn("Could not save project bin:", err);
    return null;
  }
}

export function clearProjectBin() {
  localStorage.removeItem(STORAGE_KEY);
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
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.warn("Could not load onboarding draft:", err);
  }
  return null;
}

export function saveOnboardingDraft(draft) {
  try {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ ...draft, savedAt: new Date().toISOString() })
    );
  } catch (err) {
    console.warn("Could not save onboarding draft:", err);
  }
}

export function clearOnboardingDraft() {
  localStorage.removeItem(DRAFT_KEY);
}
