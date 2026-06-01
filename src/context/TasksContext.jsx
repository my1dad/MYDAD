import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createTask, isTaskComplete, mergeTask, normalizeTask } from "../data/tasksData";
import {
  isCalendarEventTask,
  shouldReplaceTasksFromCalendarSync,
  syncCalendarEventsIntoTasks,
} from "../lib/calendarTasksSync";
import { removeAttachmentFromTask } from "../lib/fileRemoval";
import { archiveDeletedItem } from "../lib/deletedItemsStorage";
import { loadTasks, saveTasks } from "../lib/tasksStorage";
import { logWorkspaceActivity } from "../lib/workspaceActivityLog";

const TasksContext = createContext(null);

function shouldLogTaskEdit(task, fields) {
  if (isCalendarEventTask(task)) return false;

  const keys = Object.keys(fields ?? {});
  if (keys.length === 0) return false;

  const attachmentOnly =
    keys.length === 1 && Object.prototype.hasOwnProperty.call(fields, "attachments");
  const completionOnly = keys.every((key) => key === "completed" || key === "status");

  return !attachmentOnly && !completionOnly;
}

export function TasksProvider({ children }) {
  const [tasks, setTasks] = useState(() => loadTasks());
  const tasksRef = useRef(tasks);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    setTasks((prev) => {
      const next = prev.map(normalizeTask);
      const changed = next.some(
        (task, index) =>
          task.status !== prev[index]?.status ||
          JSON.stringify(task.preTasks) !== JSON.stringify(prev[index]?.preTasks)
      );
      return changed ? next : prev;
    });
  }, []);

  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  const addTask = useCallback((fields) => {
    const task = createTask(fields);
    setTasks((prev) => [task, ...prev]);
    logWorkspaceActivity({
      type: "task_created",
      message: task.title || "Untitled task",
      meta: task.project || "Unassigned",
    });
    return task;
  }, []);

  const updateTask = useCallback((id, fields) => {
    let updated = null;
    let previous = null;
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== id) return task;
        previous = task;
        updated = mergeTask(task, fields);
        return updated;
      })
    );
    if (updated && previous) {
      const wasComplete = isTaskComplete(previous);
      const isNowComplete = isTaskComplete(updated);

      if (!wasComplete && isNowComplete) {
        logWorkspaceActivity({
          type: "task_completed",
          message: updated.title || "Untitled task",
          meta: updated.project || "Unassigned",
        });
      } else if (shouldLogTaskEdit(updated, fields)) {
        logWorkspaceActivity({
          type: "task_edited",
          message: updated.title || "Untitled task",
          meta: updated.project || "Unassigned",
        });
      }
    }
    return updated;
  }, []);

  const deleteTask = useCallback((id, { archive = true, snapshot = null } = {}) => {
    const deleted =
      snapshot ?? tasksRef.current.find((item) => item.id === id) ?? null;

    if (!deleted) return;

    setTasks((prev) => prev.filter((item) => item.id !== id));

    if (archive) {
      archiveDeletedItem("task", deleted);
    }
    logWorkspaceActivity({
      type: "task_deleted",
      message: deleted.title || "Untitled task",
      meta: deleted.project || "Unassigned",
    });
  }, []);

  const syncCalendarEvents = useCallback((events, defaultAssignee = null) => {
    setTasks((prev) => {
      const next = syncCalendarEventsIntoTasks(prev, events, defaultAssignee);
      return shouldReplaceTasksFromCalendarSync(prev, next) ? next : prev;
    });
  }, []);

  const removeAttachmentByFileId = useCallback((fileId) => {
    setTasks((prev) =>
      prev.map((task) => removeAttachmentFromTask(task, fileId))
    );
  }, []);

  const restoreTask = useCallback((snapshot) => {
    const task = normalizeTask(snapshot);
    if (!task?.id) return false;

    let restored = false;
    setTasks((prev) => {
      if (prev.some((item) => item.id === task.id)) return prev;
      restored = true;
      return [task, ...prev];
    });
    return restored;
  }, []);

  const value = useMemo(
    () => ({
      tasks,
      addTask,
      updateTask,
      deleteTask,
      restoreTask,
      syncCalendarEvents,
      removeAttachmentByFileId,
    }),
    [tasks, addTask, updateTask, deleteTask, restoreTask, syncCalendarEvents, removeAttachmentByFileId]
  );

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
}

export function useTasks() {
  const ctx = useContext(TasksContext);
  if (!ctx) {
    throw new Error("useTasks must be used within TasksProvider");
  }
  return ctx;
}
