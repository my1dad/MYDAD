import { MOCK_TASKS } from "../data/tasksData";

const STORAGE_KEY = "over-drive-os-tasks";

export function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data.tasks)) {
        return data.tasks;
      }
    }
  } catch (err) {
    console.warn("Could not load tasks:", err);
  }
  return [...MOCK_TASKS];
}

export function saveTasks(tasks) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, savedAt: new Date().toISOString(), tasks })
    );
  } catch (err) {
    console.warn("Could not save tasks:", err);
  }
}
