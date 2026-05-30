import { PROFILE_ENIS_URL, resolveAssetUrl } from "../lib/assetUrl";

export const TASK_ASSIGNEES = [
  { id: "enis", name: "Enis", initials: "E", color: "#6366f1", avatarUrl: PROFILE_ENIS_URL },
];

export const TASK_PRIORITY_OPTIONS = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
];

export const TASK_STATUS_OPTIONS = [
  { id: "todo", label: "To do" },
  { id: "in_progress", label: "In progress" },
];

export function formatTaskDueDate(isoDate) {
  if (!isoDate) return "";
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTaskDueLabel(isoDate, time) {
  const datePart = isoDate ? formatTaskDueDate(isoDate) : "";
  const timePart = time?.trim() ?? "";
  if (!datePart && !timePart) return "No due date";
  if (!datePart) return timePart;
  if (!timePart) return datePart;
  return `${datePart} · ${timePart}`;
}

export function getTaskDueDisplay(task) {
  if (!task) return "No due date";
  if (task.dueDateIso || task.dueTime?.trim()) {
    return formatTaskDueLabel(task.dueDateIso, task.dueTime);
  }
  return task.dueDate || "No due date";
}

export function getTaskDueParts(task) {
  const full = getTaskDueDisplay(task);
  if (!full || full === "No due date") {
    return { date: null, time: null, full: null };
  }
  if (full.includes(" · ")) {
    const [date, time] = full.split(" · ");
    return { date, time, full };
  }
  return { date: full, time: null, full };
}

function resolveAssignee(fields, fallback) {
  const assignee =
    fields.assignee ??
    TASK_ASSIGNEES.find((m) => m.id === fields.assigneeId) ??
    fallback;
  if (!assignee) return fallback ?? TASK_ASSIGNEES[0];
  return {
    name: assignee.name,
    initials: assignee.initials,
    color: assignee.color,
    ...(assignee.avatarUrl ? { avatarUrl: resolveAssetUrl(assignee.avatarUrl) } : {}),
  };
}

export function findTaskAssigneeId(assignee, assignees = TASK_ASSIGNEES) {
  if (!assignee?.name) return assignees[0]?.id ?? "enis";
  return assignees.find((m) => m.name === assignee.name)?.id ?? assignees[0]?.id ?? "enis";
}

export function createTask(fields) {
  return {
    id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: fields.title?.trim() || "Untitled task",
    description: fields.description?.trim() ?? "",
    project: fields.project?.trim() || "Unassigned",
    projectColor: fields.projectColor ?? "#6366f1",
    dueDate: formatTaskDueLabel(fields.dueDate, fields.dueTime?.trim() || ""),
    dueDateIso: fields.dueDate ?? "",
    dueTime: fields.dueTime?.trim() ?? "",
    priority: fields.priority ?? "medium",
    status: fields.status ?? "todo",
    assignee: resolveAssignee(fields),
    preTasks: Array.isArray(fields.preTasks)
      ? fields.preTasks.map((t) => t?.trim()).filter(Boolean)
      : [],
    attachments: Array.isArray(fields.attachments) ? fields.attachments : [],
    completed: false,
    dreamboardNoteId: fields.dreamboardNoteId ?? null,
  };
}

export function mergeTask(existing, fields) {
  const assignee = fields.assignee
    ? resolveAssignee(fields, existing.assignee)
    : existing.assignee;

  const dueDateIso =
    fields.dueDate !== undefined ? fields.dueDate : (existing.dueDateIso ?? "");
  const dueTime =
    fields.dueTime !== undefined ? fields.dueTime.trim() : (existing.dueTime ?? "");

  return {
    ...existing,
    title: fields.title?.trim() || existing.title,
    description:
      fields.description !== undefined ? fields.description.trim() : (existing.description ?? ""),
    project: fields.project?.trim() ?? existing.project ?? "Unassigned",
    projectColor: fields.projectColor ?? existing.projectColor,
    dueDate: formatTaskDueLabel(dueDateIso, dueTime || ""),
    dueDateIso,
    dueTime,
    priority: fields.priority ?? existing.priority,
    status: fields.status ?? existing.status,
    assignee,
    preTasks: Array.isArray(fields.preTasks)
      ? fields.preTasks.map((t) => t?.trim()).filter(Boolean)
      : (existing.preTasks ?? []),
    attachments: Array.isArray(fields.attachments)
      ? fields.attachments
      : (existing.attachments ?? []),
    dreamboardNoteId:
      fields.dreamboardNoteId !== undefined
        ? fields.dreamboardNoteId
        : (existing.dreamboardNoteId ?? null),
  };
}

export const MOCK_TASKS = [
  {
    id: "t1",
    title: "Design dashboard wireframes",
    project: "CRM System",
    projectColor: "#6366f1",
    dueDate: "May 15, 2024",
    priority: "high",
    status: "todo",
    assignee: { name: "Enis", initials: "E", color: "#6366f1", avatarUrl: PROFILE_ENIS_URL },
    completed: false,
  },
  {
    id: "t2",
    title: "Review API documentation for finance module",
    project: "Finance Integration",
    projectColor: "#06b6d4",
    dueDate: "May 18, 2024",
    priority: "medium",
    status: "done",
    assignee: { name: "Enis", initials: "E", color: "#6366f1", avatarUrl: PROFILE_ENIS_URL },
    completed: true,
  },
  {
    id: "t3",
    title: "Mobile app onboarding flow",
    project: "Mobile App",
    projectColor: "#f59e0b",
    dueDate: "May 22, 2024",
    priority: "low",
    status: "todo",
    assignee: { name: "Enis", initials: "E", color: "#6366f1", avatarUrl: PROFILE_ENIS_URL },
    completed: false,
  },
  {
    id: "t4",
    title: "Implement CRM lead scoring logic",
    project: "CRM System",
    projectColor: "#6366f1",
    dueDate: "May 25, 2024",
    priority: "high",
    status: "in_progress",
    assignee: { name: "Enis", initials: "E", color: "#6366f1", avatarUrl: PROFILE_ENIS_URL },
    completed: false,
  },
  {
    id: "t5",
    title: "Define phase 2 KPIs for analytics dashboard",
    project: "Analytics Dashboard",
    projectColor: "#10b981",
    dueDate: "May 28, 2024",
    priority: "medium",
    status: "todo",
    assignee: { name: "Enis", initials: "E", color: "#6366f1", avatarUrl: PROFILE_ENIS_URL },
    completed: false,
  },
  {
    id: "t6",
    title: "Inventory sync webhook testing",
    project: "Inventory Management",
    projectColor: "#3b82f6",
    dueDate: "May 30, 2024",
    priority: "high",
    status: "in_progress",
    assignee: { name: "Enis", initials: "E", color: "#6366f1", avatarUrl: PROFILE_ENIS_URL },
    completed: false,
  },
  {
    id: "t7",
    title: "Lead automation email sequence copy",
    project: "Lead Automation",
    projectColor: "#8b5cf6",
    dueDate: "Jun 2, 2024",
    priority: "medium",
    status: "todo",
    assignee: { name: "Enis", initials: "E", color: "#8b5cf6", avatarUrl: PROFILE_ENIS_URL },
    completed: false,
  },
  {
    id: "t8",
    title: "Stakeholder review deck for Q2 roadmap",
    project: "Analytics Dashboard",
    projectColor: "#10b981",
    dueDate: "Jun 5, 2024",
    priority: "low",
    status: "done",
    assignee: { name: "Enis", initials: "E", color: "#6366f1", avatarUrl: PROFILE_ENIS_URL },
    completed: true,
  },
];

export const TASK_STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "mine", label: "My tasks" },
  { id: "todo", label: "To Do" },
  { id: "in_progress", label: "In Progress" },
  { id: "done", label: "Completed" },
];

export const PRIORITY_TEXT_STYLES = {
  low: "text-emerald-600",
  medium: "text-amber-600",
  high: "text-red-600",
};

export const PRIORITY_BADGE_STYLES = {
  low: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  medium: "bg-amber-50 text-amber-700 ring-amber-200",
  high: "bg-red-50 text-red-700 ring-red-200",
};
