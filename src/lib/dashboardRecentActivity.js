import { formatLogDateTime } from "./projectUtils";
import {
  loadWorkspaceActivityLog,
  WORKSPACE_ACTIVITY_TYPES,
} from "./workspaceActivityLog";

export function formatActivityTime(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return formatLogDateTime(iso) ?? "";
}

export const ACTIVITY_FILTERS = [
  { id: "all", label: "All" },
  { id: "projects", label: "Projects" },
  { id: "files", label: "Files" },
  { id: "tasks", label: "Tasks" },
  { id: "events", label: "Events" },
  { id: "profile", label: "Profile" },
  { id: "team", label: "Team" },
];

export function getActivityCategory(entry) {
  if (entry.category) return entry.category;
  const definition = WORKSPACE_ACTIVITY_TYPES[entry.type];
  if (definition?.category) return definition.category;
  return "all";
}

export function filterDashboardActivity(activity, filterId = "all") {
  if (filterId === "all") return activity;
  return activity.filter((entry) => getActivityCategory(entry) === filterId);
}

export function countDashboardActivity(activity) {
  return ACTIVITY_FILTERS.reduce((counts, filter) => {
    counts[filter.id] =
      filter.id === "all"
        ? activity.length
        : activity.filter((entry) => getActivityCategory(entry) === filter.id).length;
    return counts;
  }, {});
}

export function buildDashboardRecentActivity({ limit = 30 } = {}) {
  const log = loadWorkspaceActivityLog();

  return log.slice(0, limit).map((entry) => {
    const definition = WORKSPACE_ACTIVITY_TYPES[entry.type] ?? {};

    return {
      id: entry.id,
      at: entry.at,
      type: entry.type,
      category: definition.category ?? entry.category ?? "all",
      tone: definition.tone ?? entry.tone ?? "indigo",
      title: definition.title ?? entry.title ?? "Activity",
      message: entry.message ?? "",
      meta: entry.meta ?? "",
      timeLabel: formatActivityTime(entry.at),
    };
  });
}
