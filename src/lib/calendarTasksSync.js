import { getEventPreTasks, normalizeCalendarEvent } from "../data/calendarData";
import {
  formatTaskDueLabel,
  getTaskPreTasks,
  mergePreTasksFromTitles,
  normalizeTask,
  preTasksFromTitles,
  resolveTaskStatusFromPreTasks,
} from "../data/tasksData";

export function calendarEventTaskId(eventId) {
  return `cal-${eventId}`;
}

export function isCalendarEventTask(task) {
  return Boolean(task?.calendarEventId);
}

function priorityForEventType(type) {
  switch (type) {
    case "deadline":
      return "high";
    case "milestone":
    case "meeting":
      return "medium";
    default:
      return "low";
  }
}

function buildTaskFromEvent(event, existingTask, defaultAssignee) {
  const normalized = normalizeCalendarEvent(event);
  const preTaskTitles = getEventPreTasks(normalized);
  const preTasks = existingTask
    ? mergePreTasksFromTitles(getTaskPreTasks(existingTask), preTaskTitles)
    : preTasksFromTitles(preTaskTitles);

  const assignee = existingTask?.assignee ?? defaultAssignee;
  const dueDateIso = normalized.date ?? "";
  const dueTime = normalized.time?.trim() ?? "";

  const base = {
    id: existingTask?.id ?? calendarEventTaskId(normalized.id),
    calendarEventId: normalized.id,
    calendarEventType: normalized.type,
    title: normalized.title?.trim() || "Untitled event",
    description: normalized.description?.trim() ?? "",
    project: normalized.project?.trim() || "Unassigned",
    projectColor: normalized.projectColor ?? "#6366f1",
    dueDate: formatTaskDueLabel(dueDateIso, dueTime),
    dueDateIso,
    dueTime,
    priority: priorityForEventType(normalized.type),
    assignee,
    preTasks,
    attachments: existingTask?.attachments ?? [],
    dreamboardNoteId: existingTask?.dreamboardNoteId ?? null,
    completed: Boolean(normalized.completed),
    alertEnabled: normalized.alertEnabled ?? existingTask?.alertEnabled ?? false,
  };

  const status = base.completed
    ? "done"
    : resolveTaskStatusFromPreTasks(
        { ...base, status: existingTask?.status ?? "todo" },
        preTasks
      );

  return normalizeTask({ ...base, status });
}

function tasksEquivalent(prev, next) {
  if (prev.length !== next.length) return false;
  const nextById = new Map(next.map((task) => [task.id, task]));
  return prev.every((task) => {
    const other = nextById.get(task.id);
    return other && JSON.stringify(task) === JSON.stringify(other);
  });
}

/** Merge calendar events into the tasks list as linked tasks. */
export function syncCalendarEventsIntoTasks(tasks, events, defaultAssignee = null) {
  const normalizedEvents = events.map(normalizeCalendarEvent);
  const manualTasks = tasks.filter((task) => !task.calendarEventId);
  const existingByEventId = new Map(
    tasks
      .filter((task) => task.calendarEventId)
      .map((task) => [task.calendarEventId, task])
  );

  const syncedTasks = normalizedEvents.map((event) =>
    buildTaskFromEvent(event, existingByEventId.get(event.id), defaultAssignee)
  );

  return [...manualTasks, ...syncedTasks];
}

export function shouldReplaceTasksFromCalendarSync(prev, next) {
  return !tasksEquivalent(prev, next);
}

/** Map task edit fields back onto a calendar event update payload. */
export function taskUpdateToCalendarEventFields(fields, existingTask) {
  if (!existingTask?.calendarEventId) return null;

  const dueDateIso =
    fields.dueDate !== undefined ? fields.dueDate : (existingTask.dueDateIso ?? "");
  const dueTime =
    fields.dueTime !== undefined ? fields.dueTime.trim() : (existingTask.dueTime ?? "");

  let preTasks;
  if (fields.preTasks !== undefined) {
    preTasks = getTaskPreTasks({ preTasks: fields.preTasks }).map((item) => item.title);
  } else {
    preTasks = getTaskPreTasks(existingTask).map((item) => item.title);
  }

  return {
    title: fields.title?.trim() || existingTask.title,
    date: dueDateIso || existingTask.dueDateIso,
    time: dueTime || existingTask.dueTime,
    project: fields.project?.trim() ?? existingTask.project ?? "",
    projectColor: fields.projectColor ?? existingTask.projectColor,
    description:
      fields.description !== undefined
        ? fields.description.trim()
        : (existingTask.description ?? ""),
    preTasks,
    alertEnabled:
      fields.alertEnabled !== undefined
        ? Boolean(fields.alertEnabled)
        : Boolean(existingTask.alertEnabled),
  };
}
