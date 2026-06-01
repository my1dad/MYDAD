import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createPortfolioFile,
  formatFileSourceLabel,
  PORTFOLIO_BIN_FOLDER_ID,
} from "../data/filesData";
import { removeAttachmentFromProject } from "../lib/fileRemoval";
import { archiveDeletedItem } from "../lib/deletedItemsStorage";
import { loadFileBin, loadFileBinHydrated, saveFileBin } from "../lib/filesStorage";
import { ensurePhases, PHASE_DEFS } from "../lib/projectUtils";
import { logWorkspaceActivity } from "../lib/workspaceActivityLog";
import { useTasks } from "./TasksContext";

const FilesContext = createContext(null);

function collectProjectAttachments(projects) {
  const items = [];
  for (const project of projects ?? []) {
    const projectLabel = project.projectName ?? project.name ?? "Project";
    const phases = ensurePhases(project.phases);
    for (const def of PHASE_DEFS) {
      const phase = phases[def.id];
      if (!phase) continue;
      for (const file of phase.attachments ?? []) {
        items.push(
          createPortfolioFile(file, {
            type: "project",
            id: project.id,
            label: `${projectLabel} · ${def.title}`,
          })
        );
      }
      for (const task of phase.tasks ?? []) {
        for (const file of task.attachments ?? []) {
          items.push(
            createPortfolioFile(file, {
              type: "project",
              id: project.id,
              label: `${projectLabel} · ${task.title ?? def.title}`,
            })
          );
        }
      }
    }
  }
  return items;
}

function mergeFilesIntoBin(existing, incoming) {
  const safeExisting = Array.isArray(existing) ? existing : [];
  const safeIncoming = Array.isArray(incoming) ? incoming : [];
  const byId = new Map(safeExisting.map((f) => [f.id, f]));
  for (const file of safeIncoming) {
    const prev = byId.get(file.id);
    if (!prev) {
      byId.set(file.id, file);
      continue;
    }
    byId.set(file.id, {
      ...prev,
      ...file,
      source: file.source?.label ? file.source : prev.source,
      uploadedAt: prev.uploadedAt ?? file.uploadedAt,
    });
  }
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)
  );
}

export function FilesProvider({ children, projects = [], onProjectsChange }) {
  const { tasks, removeAttachmentByFileId } = useTasks();
  const [files, setFiles] = useState(() => {
    const loaded = loadFileBin().files;
    return Array.isArray(loaded) ? loaded : [];
  });
  const didInitialSync = useRef(false);
  const didHydrate = useRef(false);

  useEffect(() => {
    if (didHydrate.current) return;
    didHydrate.current = true;
    loadFileBinHydrated()
      .then(({ files: hydrated }) => {
        if (!Array.isArray(hydrated) || hydrated.length === 0) return;
        setFiles((prev) => mergeFilesIntoBin(prev, hydrated));
      })
      .catch((err) => console.warn("Could not hydrate file bin:", err));
  }, []);

  useEffect(() => {
    saveFileBin(files);
  }, [files]);

  const registerFiles = useCallback((attachments, source = {}) => {
    if (!Array.isArray(attachments) || !attachments.length) return;
    const entries = attachments.map((att) => createPortfolioFile(att, source));
    let newFiles = [];

    setFiles((prev) => {
      const existingIds = new Set(prev.map((file) => file.id));
      newFiles = entries.filter((file) => !existingIds.has(file.id));
      return mergeFilesIntoBin(prev, entries);
    });

    for (const file of newFiles) {
      logWorkspaceActivity({
        type: "file_uploaded",
        message: file.name || "Untitled file",
        meta: formatFileSourceLabel(file),
      });
    }
  }, []);

  const deleteFileEverywhere = useCallback(
    (fileId) => {
      let deleted = null;

      setFiles((prev) => {
        deleted = prev.find((item) => item.id === fileId) ?? null;
        return prev.filter((item) => item.id !== fileId);
      });

      if (deleted) {
        archiveDeletedItem("file", deleted);
        logWorkspaceActivity({
          type: "file_deleted",
          message: deleted.name || "Untitled file",
          meta: formatFileSourceLabel(deleted),
        });
      }

      removeAttachmentByFileId(fileId);
      onProjectsChange?.((prevProjects) =>
        (prevProjects ?? []).map((project) => removeAttachmentFromProject(project, fileId))
      );
    },
    [removeAttachmentByFileId, onProjectsChange]
  );

  const removeFile = deleteFileEverywhere;

  const restoreFileToBin = useCallback((snapshot) => {
    if (!snapshot?.id) return false;

    let restored = false;
    setFiles((prev) => {
      if (prev.some((item) => item.id === snapshot.id)) return prev;
      restored = true;
      return mergeFilesIntoBin(prev, [snapshot]);
    });
    return restored;
  }, []);

  const syncFromTasksAndProjects = useCallback(() => {
    const fromTasks = (tasks ?? []).flatMap((task) =>
      (task.attachments ?? []).map((att) =>
        createPortfolioFile(att, {
          type: "task",
          id: task.id,
          label: task.title,
        })
      )
    );
    const fromProjects = collectProjectAttachments(projects);
    setFiles((prev) => mergeFilesIntoBin(prev, [...fromTasks, ...fromProjects]));
  }, [tasks, projects]);

  useEffect(() => {
    if (didInitialSync.current) return;
    didInitialSync.current = true;
    syncFromTasksAndProjects();
  }, [syncFromTasksAndProjects]);

  useEffect(() => {
    if (!didInitialSync.current) return;
    const fromTasks = (tasks ?? []).flatMap((task) =>
      (task.attachments ?? []).map((att) =>
        createPortfolioFile(att, {
          type: "task",
          id: task.id,
          label: task.title,
        })
      )
    );
    if (fromTasks.length === 0) return;
    setFiles((prev) => mergeFilesIntoBin(prev, fromTasks));
  }, [tasks]);

  useEffect(() => {
    if (!didInitialSync.current) return;
    const fromProjects = collectProjectAttachments(projects);
    if (fromProjects.length === 0) return;
    setFiles((prev) => mergeFilesIntoBin(prev, fromProjects));
  }, [projects]);

  const binFiles = useMemo(
    () => files.filter((f) => f.folderId === PORTFOLIO_BIN_FOLDER_ID),
    [files]
  );

  const value = useMemo(
    () => ({
      files,
      binFiles,
      registerFiles,
      removeFile,
      deleteFileEverywhere,
      restoreFileToBin,
      syncFromTasksAndProjects,
    }),
    [files, binFiles, registerFiles, removeFile, deleteFileEverywhere, restoreFileToBin, syncFromTasksAndProjects]
  );

  return <FilesContext.Provider value={value}>{children}</FilesContext.Provider>;
}

export function useFiles() {
  const ctx = useContext(FilesContext);
  if (!ctx) {
    throw new Error("useFiles must be used within FilesProvider");
  }
  return ctx;
}

export function useFilesOptional() {
  return useContext(FilesContext);
}
