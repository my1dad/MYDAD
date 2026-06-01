import { useCallback, useMemo } from "react";
import { useCalendarEvents } from "../../context/CalendarEventsContext";
import { useDeletedItems } from "../../context/DeletedItemsContext";
import { useFiles } from "../../context/FilesContext";
import { useTasks } from "../../context/TasksContext";
import { useTeam } from "../../context/TeamContext";
import {
  buildRestoreApi,
  reattachFileToProjects,
  restoreDeletedItemEntries,
} from "../../lib/restoreDeletedItems";

export function useDeletedItemsActions({ restoreProject, updateProjects } = {}) {
  const { items, removeItems } = useDeletedItems();
  const { tasks, updateTask, restoreTask } = useTasks();
  const { events, restoreEvent } = useCalendarEvents();
  const { restoreMember } = useTeam();
  const { restoreFileToBin } = useFiles();

  const reattachFileToProject = useCallback(
    (projectId, attachment, snapshot) => {
      updateProjects?.((projects) =>
        reattachFileToProjects(projects, projectId, attachment, snapshot)
      );
    },
    [updateProjects]
  );

  const restoreApi = useMemo(
    () =>
      buildRestoreApi({
        restoreProject: (project) => {
          if (!restoreProject) return false;
          return restoreProject(project);
        },
        restoreMember,
        restoreEvent,
        restoreTask,
        restoreFileToBin,
        getTasks: () => tasks,
        updateTask,
        getEvents: () => events,
        reattachFileToProject,
      }),
    [
      restoreProject,
      restoreMember,
      restoreEvent,
      restoreTask,
      restoreFileToBin,
      tasks,
      updateTask,
      events,
      reattachFileToProject,
    ]
  );

  const restoreEntries = useCallback(
    (entries) => {
      const { restoredIds, failures } = restoreDeletedItemEntries(entries, restoreApi);
      if (restoredIds.length > 0) {
        removeItems(restoredIds);
      }
      return { restoredIds, failures };
    },
    [restoreApi, removeItems]
  );

  return { items, restoreEntries, removeItems };
}
