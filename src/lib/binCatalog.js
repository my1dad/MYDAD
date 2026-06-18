/**
 * Dollar A Day data bin catalog — maps logical storage keys to on-disk paths
 * relative to the bins root (./bins in dev, userData/bins when packaged).
 */

export const BINS_ROOT_LABEL = "My Dollar A Day data bins";

/** @typedef {{ id: string, path: string, label: string }} BinDefinition */

/** @type {BinDefinition[]} */
export const WORKSPACE_BINS = [
  { id: "dollar-a-day-members", path: "dollaraday/members.json", label: "Members" },
  { id: "dollar-a-day-community-posts", path: "dollaraday/community-posts.json", label: "Community posts" },
  { id: "dollar-a-day-contributions", path: "dollaraday/contributions.json", label: "Contributions" },
  { id: "dollar-a-day-allocations", path: "dollaraday/allocations.json", label: "Allocations" },
  { id: "dollar-a-day-admin-captures", path: "dollaraday/admin-captures.json", label: "Admin captures" },
  { id: "dollar-a-day-settings", path: "dollaraday/settings.json", label: "Settings" },
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
