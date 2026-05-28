import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortfolioFile, PORTFOLIO_BIN_FOLDER_ID } from "../data/filesData";
import { removeAttachmentFromProject } from "../lib/fileRemoval";
import { loadFileBin, saveFileBin } from "../lib/filesStorage";
import { ensurePhases, PHASE_DEFS } from "../lib/projectUtils";
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

  useEffect(() => {
    saveFileBin(files);
  }, [files]);

  const registerFiles = useCallback((attachments, source = {}) => {
    if (!Array.isArray(attachments) || !attachments.length) return;
    const entries = attachments.map((att) => createPortfolioFile(att, source));
    setFiles((prev) => mergeFilesIntoBin(prev, entries));
  }, []);

  const deleteFileEverywhere = useCallback(
    (fileId) => {
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      removeAttachmentByFileId(fileId);
      onProjectsChange?.((prevProjects) =>
        (prevProjects ?? []).map((project) => removeAttachmentFromProject(project, fileId))
      );
    },
    [removeAttachmentByFileId, onProjectsChange]
  );

  const removeFile = deleteFileEverywhere;

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
      syncFromTasksAndProjects,
    }),
    [files, binFiles, registerFiles, removeFile, deleteFileEverywhere, syncFromTasksAndProjects]
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
