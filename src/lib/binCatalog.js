/**
 * Workspace bin catalog — maps logical storage keys to on-disk paths
 * relative to the bins root (./bins in dev, userData/bins when packaged).
 */

export const BINS_ROOT_LABEL = "Over Drive OS workspace bins";

/** @typedef {{ id: string, path: string, label: string }} BinDefinition */

/** @type {BinDefinition[]} */
export const WORKSPACE_BINS = [
  { id: "over-drive-os-project-bin", path: "projects/project-bin.json", label: "Projects" },
  { id: "over-drive-os-tasks", path: "tasks/tasks.json", label: "Tasks" },
  { id: "over-drive-os-calendar-events", path: "calendar/events.json", label: "Calendar" },
  { id: "over-drive-os-team-members", path: "team/members.json", label: "Team" },
  { id: "over-drive-os-file-bin", path: "files/file-bin.json", label: "File index" },
  { id: "over-drive-os-dreamboard", path: "dreamboard/items.json", label: "Dreamboard" },
  { id: "over-drive-os-workspace-settings", path: "settings/workspace.json", label: "Settings" },
  { id: "over-drive-os-onboarding-draft", path: "drafts/onboarding.json", label: "Project draft" },
  { id: "over-drive-os-workspace-migration", path: "settings/migration.json", label: "Migration" },
  { id: "over-drive-os-dreamboard-export-seq", path: "dreamboard/export-seq.json", label: "Export sequence" },
];

export const ATTACHMENTS_BIN_DIR = "files/attachments";

/** @type {Record<string, string>} */
export const BIN_PATH_BY_ID = Object.fromEntries(WORKSPACE_BINS.map((b) => [b.id, b.path]));

/** @type {string[]} */
export const WORKSPACE_BIN_IDS = WORKSPACE_BINS.map((b) => b.id);

export function getBinRelativePath(binId) {
  return BIN_PATH_BY_ID[binId] ?? null;
}

export function sanitizeAttachmentFilename(name) {
  return (name || "attachment")
    .replace(/[^\w.\-()+ ]+/g, "_")
    .replace(/\s+/g, "-")
    .slice(0, 120);
}

export function buildAttachmentRelativePath(fileId, fileName) {
  return `${ATTACHMENTS_BIN_DIR}/${fileId}-${sanitizeAttachmentFilename(fileName)}`;
}
