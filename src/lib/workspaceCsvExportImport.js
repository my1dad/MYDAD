import { getRoadmapProfileEmail } from "../data/roadmapProfileStorage";
import { normalizeTask } from "../data/tasksData";
import { normalizeProject } from "./projectUtils";
import { loadFileBinHydrated } from "./filesStorage";
import { parseCsv, rowToCsv, downloadTextFile } from "./csvUtils";
import { getActiveProfileId, readBinPayload, writeBinPayloadImmediate } from "./storageAdapter";
import { WORKSPACE_VERSION } from "./workspaceConstants";
import { logWorkspaceActivity } from "./workspaceActivityLog";

const EXPORT_FORMAT_VERSION = "1";

const BIN_KEYS = {
  projects: "over-drive-os-project-bin",
  tasks: "over-drive-os-tasks",
  calendar: "over-drive-os-calendar-events",
  team: "over-drive-os-team-members",
  files: "over-drive-os-file-bin",
  dreamboard: "over-drive-os-dreamboard",
  workspaceSettings: "over-drive-os-workspace-settings",
  onboardingDraft: "over-drive-os-onboarding-draft",
};

const PROFILE_IMPORT_FIELDS = new Set([
  "fullName",
  "role",
  "email",
  "phoneNumber",
  "timezone",
  "workspaceName",
  "profilePicture",
]);

function pushRow(rows, type, id, data) {
  rows.push([type, id, typeof data === "string" ? data : JSON.stringify(data)]);
}

function readJsonCell(value) {
  if (value == null || value === "") return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function buildExportRows(profile) {
  const rows = [["type", "id", "data"]];

  pushRow(rows, "meta", "formatVersion", EXPORT_FORMAT_VERSION);
  pushRow(rows, "meta", "workspaceVersion", String(WORKSPACE_VERSION));
  pushRow(rows, "meta", "exportedAt", new Date().toISOString());
  pushRow(rows, "meta", "profileId", profile?.id ?? "");
  pushRow(rows, "meta", "username", profile?.username ?? "");

  if (profile) {
    pushRow(rows, "profile", "fullName", profile.fullName?.trim() ?? "");
    pushRow(rows, "profile", "role", profile.role?.trim() ?? "");
    pushRow(rows, "profile", "email", getRoadmapProfileEmail(profile));
    pushRow(rows, "profile", "phoneNumber", profile.phoneNumber?.trim() ?? "");
    pushRow(rows, "profile", "timezone", profile.timezone?.trim() ?? "");
    pushRow(rows, "profile", "workspaceName", profile.workspaceName?.trim() ?? "");
    if (profile.profilePicture) {
      pushRow(rows, "profile", "profilePicture", profile.profilePicture);
    }
  }

  const projectBin = readBinPayload(BIN_KEYS.projects);
  for (const project of projectBin?.projects ?? []) {
    pushRow(rows, "project", project.id ?? `project-${rows.length}`, project);
  }

  const taskBin = readBinPayload(BIN_KEYS.tasks);
  for (const task of taskBin?.tasks ?? []) {
    pushRow(rows, "task", task.id ?? `task-${rows.length}`, task);
  }

  const teamBin = readBinPayload(BIN_KEYS.team);
  for (const member of teamBin?.members ?? []) {
    pushRow(rows, "team_member", member.id ?? `member-${rows.length}`, member);
  }

  const calendarBin = readBinPayload(BIN_KEYS.calendar);
  for (const event of calendarBin?.events ?? []) {
    pushRow(rows, "calendar_event", event.id ?? `event-${rows.length}`, event);
  }

  const dreamboardBin = readBinPayload(BIN_KEYS.dreamboard);
  for (const item of dreamboardBin?.items ?? []) {
    pushRow(rows, "dreamboard_item", item.id ?? `dreamboard-${rows.length}`, item);
  }

  const settingsBin = readBinPayload(BIN_KEYS.workspaceSettings);
  if (settingsBin) {
    pushRow(rows, "workspace_settings", "payload", settingsBin);
  }

  const draftBin = readBinPayload(BIN_KEYS.onboardingDraft);
  if (draftBin) {
    pushRow(rows, "onboarding_draft", "payload", draftBin);
  }

  return rows;
}

export async function exportWorkspaceCsv(profile) {
  if (!getActiveProfileId()) {
    throw new Error("Sign in to export your workspace.");
  }

  const fileBin = await loadFileBinHydrated();
  const rows = buildExportRows(profile);

  for (const file of fileBin.files ?? []) {
    pushRow(rows, "file", file.id ?? `file-${rows.length}`, file);
  }

  const csv = rows.map(rowToCsv).join("\n");
  const username = profile?.username?.trim() || "workspace";
  const date = new Date().toISOString().slice(0, 10);
  const filename = `overdrive-${username}-${date}.csv`;
  downloadTextFile(csv, filename);
  logWorkspaceActivity({
    type: "file_exported",
    message: filename,
    meta: "Workspace backup",
  });
}

function groupImportRows(rows) {
  const grouped = {
    meta: {},
    profile: {},
    projects: [],
    tasks: [],
    teamMembers: [],
    calendarEvents: [],
    files: [],
    dreamboardItems: [],
    workspaceSettings: null,
    onboardingDraft: null,
  };

  for (const row of rows) {
    if (!row || row.length < 3) continue;
    const [type, id, data] = row;
    if (!type || type === "type") continue;

    if (type === "meta") {
      grouped.meta[id] = data;
      continue;
    }

    if (type === "profile") {
      grouped.profile[id] = data;
      continue;
    }

    const parsed = readJsonCell(data);

    switch (type) {
      case "project":
        grouped.projects.push(typeof parsed === "object" && parsed ? parsed : { id, data: parsed });
        break;
      case "task":
        grouped.tasks.push(typeof parsed === "object" && parsed ? parsed : { id, data: parsed });
        break;
      case "team_member":
        grouped.teamMembers.push(typeof parsed === "object" && parsed ? parsed : { id, data: parsed });
        break;
      case "calendar_event":
        grouped.calendarEvents.push(typeof parsed === "object" && parsed ? parsed : { id, data: parsed });
        break;
      case "file":
        grouped.files.push(typeof parsed === "object" && parsed ? parsed : { id, data: parsed });
        break;
      case "dreamboard_item":
        grouped.dreamboardItems.push(typeof parsed === "object" && parsed ? parsed : { id, data: parsed });
        break;
      case "workspace_settings":
        grouped.workspaceSettings = parsed;
        break;
      case "onboarding_draft":
        grouped.onboardingDraft = parsed;
        break;
      default:
        break;
    }
  }

  return grouped;
}

export async function importWorkspaceCsv(csvText, { updateProfile } = {}) {
  if (!getActiveProfileId()) {
    throw new Error("Sign in to import a workspace backup.");
  }

  const parsedRows = parseCsv(csvText);
  if (parsedRows.length < 2) {
    throw new Error("That CSV file looks empty.");
  }

  const grouped = groupImportRows(parsedRows);
  const formatVersion = grouped.meta.formatVersion;

  if (formatVersion !== EXPORT_FORMAT_VERSION) {
    throw new Error("Unsupported backup format. Export a new CSV from Settings.");
  }

  const now = new Date().toISOString();

  if (updateProfile) {
    const profileUpdates = {};
    for (const [field, value] of Object.entries(grouped.profile)) {
      if (!PROFILE_IMPORT_FIELDS.has(field)) continue;
      if (field === "fullName" || field === "role" || field === "phoneNumber") {
        profileUpdates[field] = value?.trim() ? value.trim() : null;
      } else if (field === "profilePicture") {
        profileUpdates.profilePicture = value?.trim() ? value.trim() : null;
      } else if (value?.trim()) {
        profileUpdates[field] = value.trim();
      }
    }

    if (Object.keys(profileUpdates).length > 0) {
      const result = updateProfile(profileUpdates);
      if (!result.ok) {
        throw new Error(result.error);
      }
    }
  }

  const projects = grouped.projects.map((project) => normalizeProject(project));
  await writeBinPayloadImmediate(BIN_KEYS.projects, {
    version: WORKSPACE_VERSION,
    savedAt: now,
    projects,
  });

  const tasks = grouped.tasks.map((task) => normalizeTask(task));
  await writeBinPayloadImmediate(BIN_KEYS.tasks, {
    version: WORKSPACE_VERSION,
    savedAt: now,
    tasks,
  });

  await writeBinPayloadImmediate(BIN_KEYS.team, {
    version: WORKSPACE_VERSION,
    savedAt: now,
    members: grouped.teamMembers,
  });

  await writeBinPayloadImmediate(BIN_KEYS.calendar, {
    version: WORKSPACE_VERSION,
    savedAt: now,
    events: grouped.calendarEvents,
  });

  await writeBinPayloadImmediate(BIN_KEYS.files, {
    version: WORKSPACE_VERSION,
    savedAt: now,
    files: grouped.files,
  });

  await writeBinPayloadImmediate(BIN_KEYS.dreamboard, {
    version: 1,
    savedAt: now,
    items: grouped.dreamboardItems,
  });

  const workspaceSettings =
    grouped.workspaceSettings && typeof grouped.workspaceSettings === "object"
      ? {
          version: grouped.workspaceSettings.version ?? WORKSPACE_VERSION,
          savedAt: now,
          eventTags: Array.isArray(grouped.workspaceSettings.eventTags)
            ? grouped.workspaceSettings.eventTags
            : [],
        }
      : {
          version: WORKSPACE_VERSION,
          savedAt: now,
          eventTags: [],
        };

  await writeBinPayloadImmediate(BIN_KEYS.workspaceSettings, workspaceSettings);

  if (grouped.onboardingDraft) {
    await writeBinPayloadImmediate(BIN_KEYS.onboardingDraft, grouped.onboardingDraft);
  } else {
    await writeBinPayloadImmediate(BIN_KEYS.onboardingDraft, null);
  }

  await writeBinPayloadImmediate("over-drive-os-workspace-migration", {
    version: WORKSPACE_VERSION,
    resetAt: now,
    importedAt: now,
  });

  return {
    counts: {
      projects: projects.length,
      tasks: tasks.length,
      teamMembers: grouped.teamMembers.length,
      calendarEvents: grouped.calendarEvents.length,
      files: grouped.files.length,
      dreamboardItems: grouped.dreamboardItems.length,
    },
  };
}
