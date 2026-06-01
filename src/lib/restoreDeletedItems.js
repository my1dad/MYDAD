import { normalizeCalendarEvent } from "../data/calendarData";
import { attachmentFromPortfolioFile } from "../data/filesData";
import { normalizeTask } from "../data/tasksData";
import { getDeletedItemSnapshot } from "../data/deletedItemsData";
import { isCalendarEventTask } from "./calendarTasksSync";
import { logRestoredDeletedItem } from "./workspaceActivityLog";
import {
  ensurePhases,
  normalizeProject,
  PHASE_IDS,
} from "./projectUtils";

const RESTORE_ORDER = {
  project: 0,
  member: 1,
  event: 2,
  task: 3,
  file: 4,
};

export function sortEntriesForRestore(entries) {
  return [...entries].sort(
    (a, b) => (RESTORE_ORDER[a.type] ?? 99) - (RESTORE_ORDER[b.type] ?? 99)
  );
}

function eventSnapshotFromTask(task) {
  const eventId = task.calendarEventId?.startsWith("cal-")
    ? task.calendarEventId.slice(4)
    : task.calendarEventId;
  if (!eventId) return null;

  return normalizeCalendarEvent({
    id: eventId,
    title: task.title,
    date: task.dueDateIso ?? "",
    time: task.dueTime ?? "",
    type: task.calendarEventType ?? "event",
    project: task.project ?? "",
    projectColor: task.projectColor ?? "#6366f1",
    description: task.description ?? "",
    completed: Boolean(task.completed),
    alertEnabled: Boolean(task.alertEnabled),
    preTasks: (task.preTasks ?? []).map((item) =>
      typeof item === "string" ? item : item.title
    ),
  });
}

export function reattachFileToProjects(projects, projectId, attachment, snapshot) {
  return (projects ?? []).map((project) => {
    if (project.id !== projectId) return project;

    const phases = ensurePhases(project.phases);
    const label = snapshot?.source?.label ?? "";
    const taskTitle = label.includes("·") ? label.split("·").pop()?.trim() : null;

    if (taskTitle) {
      let attached = false;
      const nextPhases = PHASE_IDS.reduce((acc, phaseId) => {
        const phase = { ...phases[phaseId] };
        phase.tasks = (phase.tasks ?? []).map((task) => {
          if (task.title !== taskTitle) return task;
          const attachments = task.attachments ?? [];
          if (attachments.some((file) => file.id === attachment.id)) return task;
          attached = true;
          return { ...task, attachments: [...attachments, attachment] };
        });
        acc[phaseId] = phase;
        return acc;
      }, {});

      if (attached) {
        return normalizeProject({ ...project, phases: nextPhases });
      }
    }

    const foundation = { ...phases.foundation };
    const attachments = foundation.attachments ?? [];
    if (!attachments.some((file) => file.id === attachment.id)) {
      foundation.attachments = [...attachments, attachment];
    }

    return normalizeProject({
      ...project,
      phases: { ...phases, foundation },
    });
  });
}

/**
 * @param {object} entry
 * @param {object} api
 * @returns {{ ok: boolean, error?: string }}
 */
export function restoreDeletedItemEntry(entry, api) {
  const snapshot = getDeletedItemSnapshot(entry);
  if (!snapshot?.id) {
    return { ok: false, error: "Missing restore data for this item." };
  }

  switch (entry.type) {
    case "project":
      return api.restoreProject(snapshot);
    case "member":
      return api.restoreMember(snapshot);
    case "event":
      return api.restoreEvent(snapshot);
    case "task":
      return api.restoreTask(snapshot);
    case "file":
      return api.restoreFile(snapshot);
    default:
      return { ok: false, error: "Unknown item type." };
  }
}

export function buildRestoreApi({
  restoreProject,
  restoreMember,
  restoreEvent,
  restoreTask,
  restoreFileToBin,
  getTasks,
  updateTask,
  getEvents,
  reattachFileToProject,
}) {
  return {
    restoreProject: (snapshot) => {
      const project = normalizeProject(snapshot);
      const ok = restoreProject(project);
      return ok
        ? { ok: true }
        : { ok: false, error: "Project already exists or could not be restored." };
    },

    restoreMember: (snapshot) => {
      const ok = restoreMember(snapshot);
      return ok
        ? { ok: true }
        : { ok: false, error: "Member already exists or could not be restored." };
    },

    restoreEvent: (snapshot) => {
      const event = normalizeCalendarEvent(snapshot);
      const ok = restoreEvent(event);
      return ok
        ? { ok: true }
        : { ok: false, error: "Event already exists or could not be restored." };
    },

    restoreTask: (snapshot) => {
      const task = normalizeTask(snapshot);

      if (isCalendarEventTask(task)) {
        const events = getEvents();
        const eventId = task.calendarEventId?.startsWith("cal-")
          ? task.calendarEventId.slice(4)
          : task.calendarEventId;
        const hasEvent = events.some((event) => event.id === eventId);
        if (!hasEvent) {
          const eventSnapshot = eventSnapshotFromTask(task);
          if (eventSnapshot) {
            const eventOk = restoreEvent(eventSnapshot);
            if (!eventOk) {
              return { ok: false, error: "Could not restore linked calendar event." };
            }
          }
        }
      }

      const ok = restoreTask(task);
      return ok
        ? { ok: true }
        : { ok: false, error: "Task already exists or could not be restored." };
    },

    restoreFile: (snapshot) => {
      const ok = restoreFileToBin(snapshot);
      if (!ok) {
        return { ok: false, error: "File already exists or could not be restored." };
      }

      const attachment = attachmentFromPortfolioFile(snapshot);
      const source = snapshot.source ?? {};

      if (source.type === "task" && source.id) {
        const task = getTasks().find((item) => item.id === source.id);
        if (task) {
          const attachments = task.attachments ?? [];
          if (!attachments.some((file) => file.id === attachment.id)) {
            updateTask(source.id, { attachments: [...attachments, attachment] });
          }
        }
      } else if (source.type === "project" && source.id) {
        reattachFileToProject(source.id, attachment, snapshot);
      }

      return { ok: true };
    },
  };
}

export function restoreDeletedItemEntries(entries, api) {
  const sorted = sortEntriesForRestore(entries);
  const restoredIds = [];
  const failures = [];

  for (const entry of sorted) {
    const result = restoreDeletedItemEntry(entry, api);
    if (result.ok) {
      restoredIds.push(entry.id);
      logRestoredDeletedItem(entry);
    } else {
      failures.push({ label: entry.label, error: result.error ?? "Restore failed." });
    }
  }

  return { restoredIds, failures };
}
