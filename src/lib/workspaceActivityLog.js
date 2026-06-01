import { getScopedLocalStorageKey } from "./profileWorkspaceScope";
import { getActiveProfileId } from "./storageAdapter";

export const ACTIVITY_LOG_BIN_ID = "over-drive-os-activity-log";
export const ACTIVITY_UPDATED_EVENT = "workspace-activity-updated";
const MAX_ENTRIES = 100;
const DEDUPE_WINDOW_MS = 3000;

export const WORKSPACE_ACTIVITY_TYPES = {
  project_created: { category: "projects", title: "Project created", tone: "indigo" },
  project_edited: { category: "projects", title: "Project edited", tone: "indigo" },
  project_completed: { category: "projects", title: "Project completed", tone: "emerald" },
  project_deleted: { category: "projects", title: "Project deleted", tone: "rose" },
  project_restored: { category: "projects", title: "Project restored", tone: "emerald" },
  project_permanently_deleted: {
    category: "projects",
    title: "Project permanently deleted",
    tone: "rose",
  },
  file_uploaded: { category: "files", title: "File uploaded", tone: "amber" },
  file_deleted: { category: "files", title: "File deleted", tone: "rose" },
  file_restored: { category: "files", title: "File restored", tone: "emerald" },
  file_permanently_deleted: {
    category: "files",
    title: "File permanently deleted",
    tone: "rose",
  },
  file_exported: { category: "files", title: "File exported", tone: "amber" },
  file_downloaded: { category: "files", title: "File downloaded", tone: "sky" },
  task_created: { category: "tasks", title: "Task added", tone: "indigo" },
  task_edited: { category: "tasks", title: "Task edited", tone: "indigo" },
  task_completed: { category: "tasks", title: "Task completed", tone: "emerald" },
  task_deleted: { category: "tasks", title: "Task deleted", tone: "rose" },
  task_restored: { category: "tasks", title: "Task restored", tone: "emerald" },
  task_permanently_deleted: {
    category: "tasks",
    title: "Task permanently deleted",
    tone: "rose",
  },
  event_added: { category: "events", title: "Event added", tone: "violet" },
  event_edited: { category: "events", title: "Event edited", tone: "violet" },
  event_completed: { category: "events", title: "Event completed", tone: "emerald" },
  event_deleted: { category: "events", title: "Event deleted", tone: "rose" },
  event_restored: { category: "events", title: "Event restored", tone: "emerald" },
  event_permanently_deleted: {
    category: "events",
    title: "Event permanently deleted",
    tone: "rose",
  },
  timezone_changed: { category: "profile", title: "Time zone changed", tone: "slate" },
  full_name_edited: { category: "profile", title: "Full name edited", tone: "slate" },
  email_edited: { category: "profile", title: "Email edited", tone: "slate" },
  workspace_name_edited: {
    category: "profile",
    title: "Workspace name edited",
    tone: "slate",
  },
  phone_number_edited: { category: "profile", title: "Phone number edited", tone: "slate" },
  account_connected: { category: "profile", title: "Account connected", tone: "emerald" },
  password_changed: { category: "profile", title: "Password changed", tone: "slate" },
  team_member_added: { category: "team", title: "Team member added", tone: "cyan" },
  team_member_edited: { category: "team", title: "Team member edited", tone: "cyan" },
  team_member_deleted: { category: "team", title: "Team member deleted", tone: "rose" },
  team_member_restored: { category: "team", title: "Team member restored", tone: "emerald" },
  team_member_permanently_deleted: {
    category: "team",
    title: "Team member permanently deleted",
    tone: "rose",
  },
};

const SOCIAL_PROVIDER_LABELS = {
  google: "Google",
  apple: "Apple",
  slack: "Slack",
  discord: "Discord",
};

function getActivityLogStorageKey(profileId = getActiveProfileId()) {
  return getScopedLocalStorageKey(profileId, ACTIVITY_LOG_BIN_ID);
}

function notifyActivityUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ACTIVITY_UPDATED_EVENT));
  }
}

function normalizeString(value) {
  return (value ?? "").trim();
}

function isDuplicateEntry(log, entry) {
  const recent = log[0];
  if (!recent) return false;

  const delta = new Date(entry.at).getTime() - new Date(recent.at).getTime();
  if (delta > DEDUPE_WINDOW_MS) return false;

  return (
    recent.type === entry.type &&
    recent.message === entry.message &&
    recent.meta === entry.meta
  );
}

export function loadWorkspaceActivityLog(profileId = getActiveProfileId()) {
  if (!profileId) return [];

  try {
    const raw = localStorage.getItem(getActivityLogStorageKey(profileId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveWorkspaceActivityLog(entries, profileId = getActiveProfileId()) {
  if (!profileId) return;
  localStorage.setItem(getActivityLogStorageKey(profileId), JSON.stringify(entries));
}

export function clearWorkspaceActivityLog(profileId = getActiveProfileId()) {
  if (!profileId) return;
  localStorage.removeItem(getActivityLogStorageKey(profileId));
  notifyActivityUpdated();
}

export function logWorkspaceActivity(
  { type, message = "", meta = "" },
  profileId = getActiveProfileId()
) {
  if (!profileId || !type) return null;

  const definition = WORKSPACE_ACTIVITY_TYPES[type];
  if (!definition) return null;

  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    type,
    category: definition.category,
    title: definition.title,
    tone: definition.tone,
    message,
    meta,
  };

  const log = loadWorkspaceActivityLog(profileId);
  if (isDuplicateEntry(log, entry)) {
    return null;
  }

  log.unshift(entry);
  if (log.length > MAX_ENTRIES) {
    log.length = MAX_ENTRIES;
  }
  saveWorkspaceActivityLog(log, profileId);
  notifyActivityUpdated();
  return entry;
}

export function logFileDownloaded(file, meta) {
  logWorkspaceActivity({
    type: "file_downloaded",
    message: file?.name || "Untitled file",
    meta: meta ?? file?.source?.label ?? "",
  });
}

const RESTORE_ACTIVITY_BY_DELETED_TYPE = {
  project: "project_restored",
  task: "task_restored",
  event: "event_restored",
  member: "team_member_restored",
  file: "file_restored",
};

export function logRestoredDeletedItem(entry) {
  const type = RESTORE_ACTIVITY_BY_DELETED_TYPE[entry?.type];
  if (!type) return null;

  return logWorkspaceActivity({
    type,
    message: entry?.label || "Restored item",
    meta: entry?.meta || "",
  });
}

const PERMANENT_DELETE_ACTIVITY_BY_DELETED_TYPE = {
  project: "project_permanently_deleted",
  task: "task_permanently_deleted",
  event: "event_permanently_deleted",
  member: "team_member_permanently_deleted",
  file: "file_permanently_deleted",
};

export function logPermanentlyDeletedItem(entry) {
  const type = PERMANENT_DELETE_ACTIVITY_BY_DELETED_TYPE[entry?.type];
  if (!type) return null;

  return logWorkspaceActivity({
    type,
    message: entry?.label || "Deleted item",
    meta: entry?.meta || "",
  });
}

export function logProfileFieldChanges(before, input) {
  if (!before || !input) return;

  if (
    input.fullName !== undefined &&
    normalizeString(input.fullName) !== normalizeString(before.fullName)
  ) {
    logWorkspaceActivity({
      type: "full_name_edited",
      message: normalizeString(input.fullName) || before.username || "Profile",
    });
  }

  if (
    input.email !== undefined &&
    normalizeString(input.email) !== normalizeString(before.email)
  ) {
    logWorkspaceActivity({
      type: "email_edited",
      message: normalizeString(input.email) || "Removed",
    });
  }

  if (
    input.workspaceName !== undefined &&
    normalizeString(input.workspaceName) !== normalizeString(before.workspaceName)
  ) {
    logWorkspaceActivity({
      type: "workspace_name_edited",
      message: normalizeString(input.workspaceName) || "Workspace",
    });
  }

  if (
    input.phoneNumber !== undefined &&
    normalizeString(input.phoneNumber) !== normalizeString(before.phoneNumber)
  ) {
    logWorkspaceActivity({
      type: "phone_number_edited",
      message: normalizeString(input.phoneNumber) || "Removed",
    });
  }

  if (input.timezone !== undefined && input.timezone !== before.timezone) {
    logWorkspaceActivity({
      type: "timezone_changed",
      message: input.timezone || "Default",
    });
  }
}

export function logConnectedAccount(provider) {
  const label =
    SOCIAL_PROVIDER_LABELS[provider] ??
    (typeof provider === "string"
      ? provider.charAt(0).toUpperCase() + provider.slice(1)
      : "Account");

  logWorkspaceActivity({
    type: "account_connected",
    message: label,
  });
}
