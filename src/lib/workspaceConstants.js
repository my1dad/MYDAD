/** Bump to force a one-time wipe of all persisted demo / legacy workspace data. */
export const WORKSPACE_VERSION = 3;

/** Legacy localStorage keys migrated into on-disk bins. */
export const LEGACY_LOCAL_STORAGE_KEYS = [
  "over-drive-os-project-bin",
  "over-drive-os-tasks",
  "over-drive-os-calendar-events",
  "over-drive-os-file-bin",
  "over-drive-os-onboarding-draft",
  "over-drive-os-dreamboard",
  "over-drive-os-team-members",
  "over-drive-os-workspace-settings",
];

export function isCurrentWorkspaceVersion(data) {
  return data?.version === WORKSPACE_VERSION;
}
