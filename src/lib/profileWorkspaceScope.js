import { WORKSPACE_BIN_IDS } from "./binCatalog";
import { LEGACY_LOCAL_STORAGE_KEYS, WORKSPACE_VERSION } from "./workspaceConstants";

const MIGRATION_BIN_ID = "over-drive-os-workspace-migration";
const DEFAULT_EVENT_TAGS = ["Planning", "Review", "Client", "Internal"];

export function isValidProfileScopeId(profileId) {
  return typeof profileId === "string" && /^[a-zA-Z0-9-]+$/.test(profileId);
}

export function getProfileWorkspaceSegment(profileId) {
  if (!isValidProfileScopeId(profileId)) return null;
  return `profiles/${profileId}`;
}

export function getScopedLocalStorageKey(profileId, binId) {
  if (!isValidProfileScopeId(profileId)) return binId;
  return `${profileId}::${binId}`;
}

/** @param {string} profileId @param {string} relativePath */
export function getProfileScopedRelativePath(profileId, relativePath) {
  const segment = getProfileWorkspaceSegment(profileId);
  if (!segment) return relativePath;
  return `${segment}/${relativePath}`;
}

export function createEmptyWorkspaceBins() {
  const savedAt = new Date().toISOString();
  const versioned = (payload) => ({ version: WORKSPACE_VERSION, savedAt, ...payload });

  return {
    "over-drive-os-project-bin": versioned({ projects: [] }),
    "over-drive-os-tasks": versioned({ tasks: [] }),
    "over-drive-os-calendar-events": versioned({ events: [] }),
    "over-drive-os-team-members": versioned({ members: [] }),
    "over-drive-os-file-bin": versioned({ files: [] }),
    "over-drive-os-dreamboard": { version: 1, savedAt, items: [] },
    "over-drive-os-workspace-settings": versioned({ eventTags: [...DEFAULT_EVENT_TAGS] }),
    "over-drive-os-deleted-items": versioned({ items: [] }),
    "over-drive-os-onboarding-draft": null,
    "over-drive-os-workspace-migration": {
      version: WORKSPACE_VERSION,
      resetAt: savedAt,
    },
    "over-drive-os-dreamboard-export-seq": {
      date: savedAt.slice(0, 10),
      seq: 1,
    },
  };
}

export function getEmptyWorkspaceBinIds() {
  return WORKSPACE_BIN_IDS.filter((binId) => binId !== MIGRATION_BIN_ID);
}

/**
 * One-time migration: move unscoped legacy localStorage bins into the active profile,
 * then delete the shared legacy keys so other profiles never inherit that data.
 */
export function migrateLegacyLocalStorageToProfile(profileId) {
  if (!isValidProfileScopeId(profileId)) return;

  for (const binId of LEGACY_LOCAL_STORAGE_KEYS) {
    const scopedKey = getScopedLocalStorageKey(profileId, binId);

    try {
      if (localStorage.getItem(scopedKey)) {
        localStorage.removeItem(binId);
        continue;
      }

      const legacyRaw = localStorage.getItem(binId);
      if (!legacyRaw) continue;

      localStorage.setItem(scopedKey, legacyRaw);
      localStorage.removeItem(binId);
    } catch (err) {
      console.warn(`Could not migrate legacy storage for ${binId}:`, err);
    }
  }
}
