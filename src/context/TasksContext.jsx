import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createTask, mergeTask } from "../data/tasksData";
import { removeAttachmentFromTask } from "../lib/fileRemoval";
import { loadTasks, saveTasks } from "../lib/tasksStorage";

const TasksContext = createContext(null);

export function TasksProvider({ children }) {
  const [tasks, setTasks] = useState(() => loadTasks());

  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  const addTask = useCallback((fields) => {
    const task = createTask(fields);
    setTasks((prev) => [task, ...prev]);
    return task;
  }, []);

  const updateTask = useCallback((id, fields) => {
    let updated = null;
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== id) return task;
        updated = mergeTask(task, fields);
        return updated;
      })
    );
    return updated;
  }, []);

  const deleteTask = useCallback((id) => {
    setTasks((prev) => prev.filter((task) => task.id !== id));
  }, []);

  const removeAttachmentByFileId = useCallback((fileId) => {
    setTasks((prev) =>
      prev.map((task) => removeAttachmentFromTask(task, fileId))
    );
  }, []);

  const value = useMemo(
    () => ({ tasks, addTask, updateTask, deleteTask, removeAttachmentByFileId }),
    [tasks, addTask, updateTask, deleteTask, removeAttachmentByFileId]
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
