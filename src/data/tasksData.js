import { PROFILE_ENIS_URL, resolveAssetUrl } from "../lib/assetUrl";

export const TASK_ASSIGNEES = [];

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
    (fields.assigneeId
      ? TASK_ASSIGNEES.find((m) => m.id === fields.assigneeId)
      : null) ??
    fallback;
  if (!assignee) return fallback ?? null;
  return {
    ...(assignee.id ? { id: assignee.id } : {}),
    name: assignee.name,
    initials: assignee.initials,
    color: assignee.color,
    ...(assignee.avatarUrl ? { avatarUrl: resolveAssetUrl(assignee.avatarUrl) } : {}),
  };
}

export function findTaskAssigneeId(assignee, assignees = TASK_ASSIGNEES) {
  if (!assignees.length) return "";
  if (assignee?.id) {
    const byId = assignees.find((member) => member.id === assignee.id);
    if (byId) return byId.id;
  }
  if (assignee?.name) {
    const byName = assignees.find((member) => member.name === assignee.name);
    if (byName) return byName.id;
  }
  return assignees[0]?.id ?? "";
}

export function createPreTask(title) {
  const trimmed = title?.trim() ?? "";
  return {
    id: `pt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: trimmed,
    completed: false,
  };
}

export function normalizePreTaskItem(item, index = 0) {
  if (typeof item === "string") {
    const trimmed = item.trim();
    if (!trimmed) return null;
    const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return {
      id: `pt-legacy-${index}-${slug}`,
      title: trimmed,
      completed: false,
    };
  }
  if (item && typeof item === "object") {
    const title = (item.title ?? item.label ?? "").trim();
    if (!title) return null;
    return {
      id: item.id ?? `pt-legacy-${index}`,
      title,
      completed: Boolean(item.completed),
    };
  }
  return null;
}

export function getTaskPreTasks(task) {
  if (!task) return [];
  if (Array.isArray(task.preTasks) && task.preTasks.length > 0) {
    return task.preTasks.map(normalizePreTaskItem).filter(Boolean);
  }
  if (task.preTask?.trim()) {
    return [createPreTask(task.preTask)];
  }
  return [];
}

export function preTasksFromTitles(titles = []) {
  return titles.map((title) => title?.trim()).filter(Boolean).map(createPreTask);
}

export function mergePreTasksFromTitles(existingPreTasks, titles = []) {
  const normalized = getTaskPreTasks({ preTasks: existingPreTasks });
  const byTitle = new Map(normalized.map((item) => [item.title.toLowerCase(), item]));
  return titles
    .map((title) => title?.trim())
    .filter(Boolean)
    .map((title) => {
      const match = byTitle.get(title.toLowerCase());
      return match ? { ...match, title } : createPreTask(title);
    });
}

function resolvePreTasks(existing, fields) {
  if (fields.preTasks === undefined) return getTaskPreTasks(existing);
  if (!Array.isArray(fields.preTasks)) return getTaskPreTasks(existing);

  const hasStructuredItems = fields.preTasks.some(
    (item) => item && typeof item === "object" && ("completed" in item || "id" in item)
  );
  if (hasStructuredItems) {
    return fields.preTasks.map(normalizePreTaskItem).filter(Boolean);
  }

  return mergePreTasksFromTitles(existing.preTasks ?? [], fields.preTasks);
}

export function getPreTaskProgress(preTasks = []) {
  const items = Array.isArray(preTasks)
    ? preTasks.every((item) => typeof item === "object")
      ? preTasks.map(normalizePreTaskItem).filter(Boolean)
      : getTaskPreTasks({ preTasks })
    : [];

  const total = items.length;
  const completed = items.filter((item) => item.completed).length;
  const percent = total === 0 ? 100 : Math.round((completed / total) * 100);

  return {
    total,
    completed,
    percent,
    allComplete: total === 0 || completed === total,
  };
}

export function canCompleteTask(task) {
  return getPreTaskProgress(getTaskPreTasks(task)).allComplete;
}

export function isTaskComplete(task) {
  return Boolean(task?.completed) || task?.status === "done";
}

export function togglePreTaskInList(preTasks, preTaskId) {
  return getTaskPreTasks({ preTasks }).map((item) =>
    item.id === preTaskId ? { ...item, completed: !item.completed } : item
  );
}

/** Derive task status from pre-task progress when appropriate. */
export function resolveTaskStatusFromPreTasks(task, preTasks, { toggledOn = false, toggledOff = false } = {}) {
  const progress = getPreTaskProgress(preTasks);
  const currentStatus = task.status ?? "todo";

  if (isTaskComplete(task)) {
    return currentStatus;
  }

  if (progress.completed > 0 && (currentStatus === "todo" || !task.status)) {
    return "in_progress";
  }

  if (toggledOff && progress.completed === 0 && currentStatus === "in_progress") {
    return "todo";
  }

  if (toggledOn && progress.completed === 0 && currentStatus === "in_progress") {
    return "todo";
  }

  return currentStatus;
}

/** Status + completion updates when a pre-task checkbox is toggled. */
export function getPreTaskToggleUpdates(task, preTaskId) {
  const previousPreTasks = getTaskPreTasks(task);
  const preTasks = togglePreTaskInList(previousPreTasks, preTaskId);
  const prevItem = previousPreTasks.find((item) => item.id === preTaskId);
  const nextItem = preTasks.find((item) => item.id === preTaskId);
  const toggledOn = Boolean(prevItem && nextItem && !prevItem.completed && nextItem.completed);
  const toggledOff = Boolean(prevItem && nextItem && prevItem.completed && !nextItem.completed);
  const fields = { preTasks };

  fields.status = resolveTaskStatusFromPreTasks(task, preTasks, { toggledOn, toggledOff });

  if (isTaskComplete(task) && !getPreTaskProgress(preTasks).allComplete) {
    fields.completed = false;
    if (fields.status === "done") {
      fields.status = "in_progress";
    }
  }

  return fields;
}

export function normalizeTask(task) {
  const preTasks = getTaskPreTasks(task);
  const status = resolveTaskStatusFromPreTasks(task, preTasks);

  return {
    ...task,
    preTasks,
    status,
  };
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
    preTasks: preTasksFromTitles(Array.isArray(fields.preTasks) ? fields.preTasks : []),
    attachments: Array.isArray(fields.attachments) ? fields.attachments : [],
    completed: false,
    dreamboardNoteId: fields.dreamboardNoteId ?? null,
    alertEnabled: Boolean(fields.alertEnabled),
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

  const preTasks = resolvePreTasks(existing, fields);
  const status =
    fields.status !== undefined
      ? fields.status
      : fields.preTasks !== undefined
        ? resolveTaskStatusFromPreTasks(existing, preTasks)
        : existing.status;

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
    status,
    assignee,
    preTasks,
    attachments: Array.isArray(fields.attachments)
      ? fields.attachments
      : (existing.attachments ?? []),
    dreamboardNoteId:
      fields.dreamboardNoteId !== undefined
        ? fields.dreamboardNoteId
        : (existing.dreamboardNoteId ?? null),
    completed: fields.completed !== undefined ? fields.completed : existing.completed,
    alertEnabled:
      fields.alertEnabled !== undefined ? Boolean(fields.alertEnabled) : Boolean(existing.alertEnabled),
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
  { id: "events", label: "Events" },
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
