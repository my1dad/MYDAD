import { EVENT_TYPE_LABELS, isEventComplete } from "../data/calendarData";
import { getTaskDueDisplay, isTaskComplete } from "../data/tasksData";

function parseTimeParts(timeStr) {
  const match = timeStr?.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return { hours: 9, minutes: 0 };

  let hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  const period = match[3].toUpperCase();

  if (period === "AM" && hours === 12) hours = 0;
  if (period === "PM" && hours !== 12) hours += 12;

  return { hours, minutes };
}

function timestampFromDateAndTime(isoDate, timeStr) {
  if (!isoDate) return null;
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;

  const { hours, minutes } = parseTimeParts(timeStr);
  date.setHours(hours, minutes, 0, 0);
  return date.getTime();
}

export function getTaskAlertTimestamp(task) {
  return timestampFromDateAndTime(task?.dueDateIso, task?.dueTime);
}

export function getEventAlertTimestamp(event) {
  return timestampFromDateAndTime(event?.date, event?.time);
}

export function formatAlertWhenLabel(whenLabel) {
  if (!whenLabel || whenLabel === "No due date") return "No schedule set";
  return whenLabel;
}

export function buildDashboardAlerts({ tasks = [], events = [] } = {}) {
  const items = [];

  for (const task of tasks) {
    if (!task.alertEnabled || isTaskComplete(task)) continue;

    items.push({
      id: `alert-task-${task.id}`,
      sourceId: task.id,
      sourceType: "task",
      title: task.title || "Untitled task",
      subtitle: task.project || "Unassigned",
      whenLabel: formatAlertWhenLabel(getTaskDueDisplay(task)),
      at: getTaskAlertTimestamp(task) ?? Number.MAX_SAFE_INTEGER,
      color: task.projectColor ?? "#6366f1",
      badge: "Alert",
    });
  }

  for (const event of events) {
    if (!event.alertEnabled || isEventComplete(event)) continue;

    const typeLabel = EVENT_TYPE_LABELS[event.type] ?? "Event";
    items.push({
      id: `alert-event-${event.id}`,
      sourceId: event.id,
      sourceType: "event",
      title: event.title || "Untitled event",
      subtitle: event.project?.trim() || typeLabel,
      whenLabel: formatAlertWhenLabel(
        event.date ? `${event.date}${event.time ? ` · ${event.time}` : ""}` : "No date set"
      ),
      at: getEventAlertTimestamp(event) ?? Number.MAX_SAFE_INTEGER,
      color: event.projectColor ?? "#8b5cf6",
      badge: "Alert",
    });
  }

  return items.sort((a, b) => a.at - b.at);
}
