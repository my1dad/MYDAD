import { EVENT_TYPE_LABELS } from "../data/calendarData";
import { formatFileSourceLabel } from "../data/filesData";
import { getRoadmapProfileEmail, getRoadmapProfileFullName, getRoadmapProfileRole } from "../data/roadmapProfileStorage";
import { getPhaseTitle, PHASE_DEFS } from "./projectUtils";

/** @typedef {"project"|"task"|"file"|"image"|"team_member"|"calendar_event"|"dreamboard_item"|"profile"} SearchResultKind */

/**
 * @typedef {{
 *   id: string;
 *   kind: SearchResultKind;
 *   title: string;
 *   subtitle?: string;
 *   haystack: string;
 *   page: string;
 *   pageOptions?: object;
 * }} SearchResult
 */

function joinParts(parts) {
  return parts
    .flatMap((part) => {
      if (part == null || part === "") return [];
      if (Array.isArray(part)) return part;
      if (typeof part === "object") return Object.values(part);
      return [String(part)];
    })
    .filter(Boolean)
    .join(" ");
}

function buildHaystack(...parts) {
  return joinParts(parts).toLowerCase();
}

function isImageFile(file) {
  const type = file?.type ?? "";
  if (type.startsWith("image/")) return true;
  const name = (file?.name ?? "").toLowerCase();
  return /\.(png|jpe?g|gif|webp|svg|bmp|ico|heic|avif)$/.test(name);
}

function collectProjectText(project) {
  const parts = [
    project.projectName,
    project.name,
    project.description,
    project.projectType,
    project.clientType,
    project.priority,
    project.status,
    project.targetLaunchDate,
    project.team?.projectOwner,
    project.team?.sprintLength,
    project.team?.timelineType,
    project.team?.estimatedBudget,
    project.kpis?.notes,
    project.kpis?.revenueGoal,
    project.kpis?.riskLevel,
    project.kpis?.expectedUserVolume,
    ...(project.kpis?.successMetrics ?? []),
  ];

  for (const member of project.team?.teamMembers ?? []) {
    if (typeof member === "string") parts.push(member);
    else parts.push(member?.name, member?.role, member?.id);
  }

  for (const def of PHASE_DEFS) {
    const phase = project.phases?.[def.id];
    if (!phase) continue;
    parts.push(getPhaseTitle(def.id, project.phases), phase.notes, phase.status);
    for (const task of phase.tasks ?? []) {
      parts.push(
        task.title,
        task.description,
        task.notes,
        task.status,
        ...(task.tags ?? [])
      );
      for (const file of task.attachments ?? []) {
        parts.push(file.name, file.type);
      }
    }
    for (const file of phase.attachments ?? []) {
      parts.push(file.name, file.type);
    }
  }

  return parts;
}

/** @returns {SearchResult[]} */
export function buildProjectSearchResults(projects = []) {
  return projects.map((project) => {
    const title = project.projectName?.trim() || "Untitled project";
    const text = collectProjectText(project);
    return {
      id: `project-${project.id}`,
      kind: "project",
      title,
      subtitle: project.description?.trim() || project.status || "Project",
      haystack: buildHaystack(...text),
      page: "projects",
    };
  });
}

/** @returns {SearchResult[]} */
export function buildTaskSearchResults(tasks = []) {
  return tasks.map((task) => {
    const title = task.title?.trim() || "Untitled task";
    const assigneeName = task.assignee?.name ?? "";
    return {
      id: `task-${task.id}`,
      kind: "task",
      title,
      subtitle: [task.project, assigneeName, task.status, task.priority].filter(Boolean).join(" · "),
      haystack: buildHaystack(
        task.title,
        task.description,
        task.notes,
        task.project,
        assigneeName,
        task.status,
        task.priority,
        task.dueDate,
        task.dueDateIso,
        task.dueTime,
        ...(task.preTasks ?? []).map((item) => item?.title ?? item?.label ?? item),
        ...(task.tags ?? []),
        ...(task.attachments ?? []).map((file) => [file.name, file.type])
      ),
      page: "tasks",
    };
  });
}

/** @returns {SearchResult[]} */
export function buildFileSearchResults(files = []) {
  const results = [];
  for (const file of files) {
    const title = file.name?.trim() || "Untitled file";
    const sourceLabel = formatFileSourceLabel(file);
    const image = isImageFile(file);
    results.push({
      id: `${image ? "image" : "file"}-${file.id}`,
      kind: image ? "image" : "file",
      title,
      subtitle: [sourceLabel, file.type].filter(Boolean).join(" · "),
      haystack: buildHaystack(file.name, sourceLabel, file.type, file.source?.type, file.source?.label),
      page: "file-manager",
    });
  }
  return results;
}

/** @returns {SearchResult[]} */
export function buildTeamSearchResults(members = []) {
  return members.map((member) => ({
    id: `team-${member.id}`,
    kind: "team_member",
    title: member.name?.trim() || "Team member",
    subtitle: [member.role, member.department, member.email].filter(Boolean).join(" · "),
    haystack: buildHaystack(
      member.name,
      member.role,
      member.department,
      member.email,
      member.phoneNumber,
      member.notes,
      member.status,
      member.initials
    ),
    page: "team",
  }));
}

/** @returns {SearchResult[]} */
export function buildCalendarSearchResults(events = []) {
  return events.map((event) => {
    const typeLabel = EVENT_TYPE_LABELS[event.type] ?? event.type;
    return {
      id: `calendar-${event.id}`,
      kind: "calendar_event",
      title: event.title?.trim() || "Calendar event",
      subtitle: [typeLabel, event.project, event.date, event.time].filter(Boolean).join(" · "),
      haystack: buildHaystack(
        event.title,
        event.description,
        event.project,
        event.date,
        event.time,
        typeLabel,
        event.type,
        ...(event.tags ?? [])
      ),
      page: "calendar",
    };
  });
}

/** @returns {SearchResult[]} */
export function buildDreamboardSearchResults(items = []) {
  return items.map((item) => {
    const fallbackTitle =
      item.type === "text" || item.type === "sticky"
        ? "Dreamboard note"
        : item.type === "image"
          ? "Dreamboard image"
          : "Dreamboard item";
    const title = item.content?.trim()?.slice(0, 80) || fallbackTitle;
    return {
      id: `dreamboard-${item.id}`,
      kind: "dreamboard_item",
      title,
      subtitle: item.type ? `Dreamboard · ${item.type}` : "Dreamboard",
      haystack: buildHaystack(item.content, item.type, item.textColor, item.shape),
      page: "dreamboard",
    };
  });
}

/** @returns {SearchResult[]} */
export function buildProfileSearchResults(profile) {
  if (!profile) return [];
  const fullName = getRoadmapProfileFullName(profile);
  const role = getRoadmapProfileRole(profile);
  const email = getRoadmapProfileEmail(profile);
  const title = fullName || `@${profile.username ?? "profile"}`;
  return [
    {
      id: `profile-${profile.id}`,
      kind: "profile",
      title,
      subtitle: [role, email, profile.workspaceName].filter(Boolean).join(" · "),
      haystack: buildHaystack(
        fullName,
        profile.username,
        role,
        email,
        profile.phoneNumber,
        profile.timezone,
        profile.workspaceName
      ),
      page: "account",
    },
  ];
}

export const SEARCH_KIND_LABELS = {
  project: "Projects",
  task: "Tasks",
  file: "Files",
  image: "Images",
  team_member: "Team",
  calendar_event: "Calendar",
  dreamboard_item: "Dreamboard",
  profile: "Profile",
};

export const SEARCH_KIND_ORDER = [
  "project",
  "task",
  "file",
  "image",
  "team_member",
  "calendar_event",
  "dreamboard_item",
  "profile",
];

/**
 * @param {string} query
 * @param {SearchResult[]} index
 * @param {{ limit?: number }} [options]
 */
export function searchDashboardIndex(query, index, { limit = 60 } = {}) {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const scored = index
    .filter((entry) => entry.haystack.includes(q))
    .map((entry) => {
      const title = entry.title.toLowerCase();
      let score = 0;
      if (title === q) score += 100;
      else if (title.startsWith(q)) score += 50;
      else if (title.includes(q)) score += 20;
      if (entry.subtitle?.toLowerCase().includes(q)) score += 5;
      return { entry, score };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.entry.title.localeCompare(b.entry.title);
    })
    .slice(0, limit)
    .map(({ entry }) => entry);

  return scored;
}

/** @param {SearchResult[]} results */
export function groupSearchResults(results) {
  /** @type {Record<string, SearchResult[]>} */
  const groups = {};
  for (const kind of SEARCH_KIND_ORDER) {
    groups[kind] = [];
  }
  for (const result of results) {
    if (!groups[result.kind]) groups[result.kind] = [];
    groups[result.kind].push(result);
  }
  return SEARCH_KIND_ORDER.filter((kind) => groups[kind]?.length > 0).map((kind) => ({
    kind,
    label: SEARCH_KIND_LABELS[kind] ?? kind,
    items: groups[kind],
  }));
}

/** @param {SearchResult[]} results */
export function buildDashboardSearchIndex({
  projects = [],
  tasks = [],
  files = [],
  members = [],
  events = [],
  dreamboardItems = [],
  profile = null,
} = {}) {
  return [
    ...buildProjectSearchResults(projects),
    ...buildTaskSearchResults(tasks),
    ...buildFileSearchResults(files),
    ...buildTeamSearchResults(members),
    ...buildCalendarSearchResults(events),
    ...buildDreamboardSearchResults(dreamboardItems),
    ...buildProfileSearchResults(profile),
  ];
}
