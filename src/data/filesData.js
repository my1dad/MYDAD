export const PORTFOLIO_BIN_FOLDER_ID = "portfolio-bin";

export const FILE_SOURCE_LABELS = {
  "file-manager": "File Manager",
  task: "Task",
  project: "Project",
  dashboard: "Dashboard",
  upload: "Upload",
};

/** @typedef {{ type: string, id?: string, label?: string }} FileSource */

/**
 * @param {object} attachment
 * @param {FileSource} [source]
 */
export function createPortfolioFile(attachment, source = {}) {
  const now = new Date().toISOString();
  return {
    id: attachment.id,
    name: attachment.name,
    size: attachment.size,
    type: attachment.type || "application/octet-stream",
    dataUrl: attachment.dataUrl ?? null,
    folderId: PORTFOLIO_BIN_FOLDER_ID,
    source: {
      type: source.type ?? "upload",
      id: source.id ?? null,
      label: source.label ?? null,
    },
    uploadedAt: attachment.uploadedAt ?? now,
  };
}

export function formatFileSourceLabel(file) {
  const type = file?.source?.type ?? "upload";
  const base = FILE_SOURCE_LABELS[type] ?? "File";
  const label = file?.source?.label?.trim();
  if (label) return `${base}: ${label}`;
  return base;
}

export function attachmentFromPortfolioFile(file) {
  return {
    id: file.id,
    name: file.name,
    size: file.size,
    type: file.type,
    dataUrl: file.dataUrl,
  };
}
