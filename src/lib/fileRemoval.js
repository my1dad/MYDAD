import { ensurePhases, normalizeProject, PHASE_IDS } from "./projectUtils";

function stripAttachments(list, fileId) {
  if (!Array.isArray(list)) return { next: [], changed: false };
  const next = list.filter((file) => file.id !== fileId);
  return { next, changed: next.length !== list.length };
}

/** Remove an attachment from all phases and phase tasks on a project. */
export function removeAttachmentFromProject(project, fileId) {
  const phases = ensurePhases(project.phases);
  let changed = false;

  const nextPhases = PHASE_IDS.reduce((acc, id) => {
    const phase = { ...phases[id] };
    const phaseResult = stripAttachments(phase.attachments, fileId);
    if (phaseResult.changed) {
      changed = true;
      phase.attachments = phaseResult.next;
    }

    phase.tasks = (phase.tasks ?? []).map((task) => {
      const taskResult = stripAttachments(task.attachments, fileId);
      if (taskResult.changed) {
        changed = true;
        return { ...task, attachments: taskResult.next };
      }
      return task;
    });

    acc[id] = phase;
    return acc;
  }, {});

  if (!changed) return project;
  return normalizeProject({ ...project, phases: nextPhases });
}

/** Remove an attachment from a portfolio task record. */
export function removeAttachmentFromTask(task, fileId) {
  const { next, changed } = stripAttachments(task.attachments, fileId);
  if (!changed) return task;
  return { ...task, attachments: next };
}
