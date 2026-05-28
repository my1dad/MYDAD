import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS } from "../data/calendarData";

export const PHASE_DEFS = [
  { id: "foundation", title: "Foundation", shortLabel: "Foundation" },
  { id: "core", title: "Core Features", shortLabel: "Core Features" },
  { id: "integrations", title: "Integrations", shortLabel: "Integrations" },
  { id: "scale", title: "Scale & Optimization", shortLabel: "Scale & Optimize" },
];

export const PHASE_IDS = PHASE_DEFS.map((p) => p.id);

export const PROJECT_PRIORITY_ORDER = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export const PROJECT_PRIORITY_GAUGE = {
  low: { fill: 25, color: "#10b981", label: "Low" },
  medium: { fill: 50, color: "#f59e0b", label: "Medium" },
  high: { fill: 75, color: "#ef4444", label: "High" },
  critical: { fill: 100, color: "#a855f7", label: "Critical" },
};

export function getProjectPriorityMeta(priority = "medium") {
  return PROJECT_PRIORITY_GAUGE[priority] ?? PROJECT_PRIORITY_GAUGE.medium;
}

export function compareProjectsByPriority(a, b) {
  const rankA = PROJECT_PRIORITY_ORDER[a.priority ?? "medium"] ?? 2;
  const rankB = PROJECT_PRIORITY_ORDER[b.priority ?? "medium"] ?? 2;
  if (rankA !== rankB) return rankA - rankB;
  return (b.progress ?? 0) - (a.progress ?? 0);
}

export const PROJECT_STAGE_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#ec4899",
  "#f43f5e",
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#84cc16",
  "#10b981",
  "#14b8a6",
  "#06b6d4",
  "#0ea5e9",
  "#3b82f6",
  "#64748b",
  "#0891b2",
  "#7c3aed",
  "#db2777",
  "#ca8a04",
  "#059669",
];

function hexToRgb(hex) {
  const normalized = hex.replace("#", "");
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbToHex(r, g, b) {
  const toHex = (value) =>
    Math.max(0, Math.min(255, Math.round(value)))
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hslToHex(h, s, l) {
  const sat = s / 100;
  const light = l / 100;
  const chroma = (1 - Math.abs(2 * light - 1)) * sat;
  const segment = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const match = light - chroma / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (h < 60) [r, g, b] = [chroma, segment, 0];
  else if (h < 120) [r, g, b] = [segment, chroma, 0];
  else if (h < 180) [r, g, b] = [0, chroma, segment];
  else if (h < 240) [r, g, b] = [0, segment, chroma];
  else if (h < 300) [r, g, b] = [segment, 0, chroma];
  else [r, g, b] = [chroma, 0, segment];

  return rgbToHex((r + match) * 255, (g + match) * 255, (b + match) * 255);
}

function colorHue(hex) {
  const { r, g, b } = hexToRgb(hex);
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  if (delta === 0) return 0;

  let hue = 0;
  if (max === rn) hue = ((gn - bn) / delta) % 6;
  else if (max === gn) hue = (bn - rn) / delta + 2;
  else hue = (rn - gn) / delta + 4;

  return Math.round(hue * 60);
}

export function stageColorBg(color, alpha = 0.12) {
  const { r, g, b } = hexToRgb(color);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Card theme derived from a project's roadmap stage color */
export function themeFromStageColor(color) {
  return {
    color,
    bg: stageColorBg(color, 0.12),
    border: stageColorBg(color, 0.32),
    glow: stageColorBg(color, 0.16),
  };
}

export function generateProjectStageColor(usedColors = []) {
  const used = new Set(usedColors.filter(Boolean).map((color) => color.toLowerCase()));
  const available = PROJECT_STAGE_COLORS.filter((color) => !used.has(color.toLowerCase()));
  if (available.length) return available[Math.floor(Math.random() * available.length)];

  const usedHues = [...used].map((color) => colorHue(color));

  for (let attempt = 0; attempt < 96; attempt += 1) {
    const hue = (attempt * 37 + Math.floor(Math.random() * 24)) % 360;
    const tooClose = usedHues.some(
      (existingHue) => Math.min(Math.abs(existingHue - hue), 360 - Math.abs(existingHue - hue)) < 22
    );
    if (tooClose) continue;

    const candidate = hslToHex(hue, 68, 54);
    if (!used.has(candidate.toLowerCase())) return candidate;
  }

  return hslToHex(Math.floor(Math.random() * 360), 68, 54);
}

export function getProjectStageColor(project) {
  return project?.color ?? "#6366f1";
}

export function ensureUniqueProjectColors(projects) {
  const used = [];

  return projects.map((project) => {
    const usedSet = new Set(used.map((color) => color.toLowerCase()));
    let color = project.color;

    if (!color || usedSet.has(color.toLowerCase())) {
      color = generateProjectStageColor(used);
    }

    used.push(color);

    if (color === project.color) return project;
    return { ...project, color };
  });
}

export function orderProjectsForColorGrid(projects, columns = 3) {
  if (projects.length <= 1) return [...projects];

  const remaining = [...projects];
  const ordered = [];

  while (remaining.length) {
    const leftColor =
      ordered.length > 0 ? getProjectStageColor(ordered[ordered.length - 1]) : null;
    const aboveColor =
      ordered.length >= columns
        ? getProjectStageColor(ordered[ordered.length - columns])
        : null;

    let bestIndex = 0;
    let bestScore = -1;

    for (let index = 0; index < remaining.length; index += 1) {
      const color = getProjectStageColor(remaining[index]);
      let score = 0;
      if (color.toLowerCase() !== leftColor?.toLowerCase()) score += 3;
      if (color.toLowerCase() !== aboveColor?.toLowerCase()) score += 3;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }

    ordered.push(remaining.splice(bestIndex, 1)[0]);
  }

  return ordered;
}

export const PHASE_THEMES = {
  foundation: { color: "#4f46e5", bg: "#eef2ff", border: "#c7d2fe" },
  core: { color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
  integrations: { color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  scale: { color: "#0d9488", bg: "#ecfdf5", border: "#a7f3d0" },
};

export const STATUS_LABELS = {
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
  on_hold: "On Hold",
};

export function emptyTask() {
  return {
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: "",
    details: "",
    startDate: "",
    endDate: "",
    completed: false,
    startedAt: null,
    completedAt: null,
    elapsedMs: 0,
    timerStartedAt: null,
  };
}

export function emptyPhase() {
  return {
    objective: "",
    status: "not_started",
    tasks: [],
    attachments: [],
    completion: 0,
    timerElapsedMs: 0,
    timerStartedAt: null,
    timerStopped: false,
    timerPausedByInProg: false,
    timerManuallyPaused: false,
    jobSessionActive: false,
    activeTaskId: null,
  };
}

export function calcPhaseCompletionFromTasks(tasks = []) {
  if (!tasks.length) return 0;
  const done = tasks.filter((t) => t.completed).length;
  return Math.round((done / tasks.length) * 100);
}

export function normalizePhase(phase = {}) {
  let tasks = phase.tasks ?? [];

  if (!tasks.length && phase.deliverables?.length) {
    tasks = phase.deliverables.map((item, index) => ({
      ...emptyTask(),
      id: `task-migrated-${index}`,
      title: typeof item === "string" ? item : item?.title ?? "",
    }));
  }

  tasks = tasks.map((task, index) => {
    const { attachments: _taskAttachments, ...taskData } = task;
    return {
      ...emptyTask(),
      ...taskData,
      id: task.id ?? `task-${index}`,
      startedAt: taskData.startedAt ?? null,
      completedAt: taskData.completedAt ?? null,
      elapsedMs: taskData.elapsedMs ?? 0,
      timerStartedAt: taskData.timerStartedAt ?? null,
    };
  });

  let attachments = [...(phase.attachments ?? [])];
  for (const task of phase.tasks ?? []) {
    if (task.attachments?.length) {
      attachments = [...attachments, ...task.attachments];
    }
  }

  return syncPhaseFromTasks({
    ...phase,
    tasks,
    attachments,
  });
}

export function syncPhaseFromTasks(phase) {
  const tasks = (phase.tasks ?? []).map((task) => {
    const { attachments: _taskAttachments, ...taskData } = task;
    return {
      ...emptyTask(),
      ...taskData,
      id: task.id ?? emptyTask().id,
      startedAt: taskData.startedAt ?? null,
      completedAt: taskData.completedAt ?? null,
      elapsedMs: taskData.elapsedMs ?? 0,
      timerStartedAt: taskData.timerStartedAt ?? null,
    };
  });

  const completion = tasks.length
    ? calcPhaseCompletionFromTasks(tasks)
    : (phase.completion ?? 0);

  let status = phase.status ?? "not_started";

  if (status === "on_hold") {
    // Keep on hold until user selects another status button.
  } else if (tasks.length) {
    if (completion >= 100) {
      status = "completed";
    } else if (completion > 0) {
      if (phase.jobSessionActive || status === "in_progress") {
        status = "in_progress";
      }
    } else if (
      status === "in_progress" ||
      status === "on_hold" ||
      phase.activeTaskId ||
      tasks.some(
        (task) =>
          task.timerStartedAt ||
          task.startedAt ||
          (task.elapsedMs ?? 0) > 0
      )
    ) {
      status = status === "on_hold" ? "on_hold" : "in_progress";
    } else {
      status = "not_started";
    }
  } else if (completion >= 100) {
    status = "completed";
  } else if (completion > 0 && status === "not_started") {
    status = "in_progress";
  } else if (completion === 0 && status === "completed") {
    status = "not_started";
  }

  const startDates = tasks.map((t) => t.startDate).filter(Boolean).sort();
  const endDates = tasks.map((t) => t.endDate).filter(Boolean).sort();
  const startDate = startDates[0] ?? phase.startDate ?? "";
  const endDate = endDates[endDates.length - 1] ?? phase.endDate ?? "";

  let result = {
    ...phase,
    tasks,
    attachments: phase.attachments ?? [],
    completion,
    status,
    startDate,
    endDate,
    timerElapsedMs: phase.timerElapsedMs ?? 0,
    timerStartedAt: phase.timerStartedAt ?? null,
    timerStopped: phase.timerStopped ?? false,
    timerPausedByInProg: phase.timerPausedByInProg ?? false,
    timerManuallyPaused: phase.timerManuallyPaused ?? false,
    jobSessionActive: phase.jobSessionActive ?? false,
    activeTaskId: phase.activeTaskId ?? null,
  };

  return repairPhaseTimers(result);
}

export function ensurePhases(phases = {}) {
  return PHASE_IDS.reduce((acc, id) => {
    acc[id] = normalizePhase({ ...emptyPhase(), ...(phases[id] ?? {}) });
    return acc;
  }, {});
}

export function calcProgress(phases) {
  if (!phases) return 0;
  const values = Object.values(phases);
  if (!values.length) return 0;
  const segment = 100 / values.length;
  return Math.round(
    values.reduce((sum, p) => sum + ((p.completion ?? 0) / 100) * segment, 0)
  );
}

export function phasesFromOverallProgress(progress) {
  const segmentMax = 100 / PHASE_IDS.length;
  let remaining = Math.max(0, Math.min(100, progress));
  const phases = {};

  for (const id of PHASE_IDS) {
    const segmentContribution = Math.min(segmentMax, remaining);
    const completion = Math.round((segmentContribution / segmentMax) * 100);
    remaining -= segmentContribution;

    phases[id] = {
      ...emptyPhase(),
      completion,
      status:
        completion >= 100 ? "completed" : completion > 0 ? "in_progress" : "not_started",
    };
  }

  return phases;
}

export function hasPhaseData(phases) {
  if (!phases || !Object.keys(phases).length) return false;
  return Object.values(phases).some(
    (p) =>
      (p?.completion ?? 0) > 0 ||
      (p?.status && p.status !== "not_started") ||
      p?.objective ||
      p?.tasks?.length ||
      p?.deliverables?.length
  );
}

export function syncPhaseStatus(phase) {
  if (phase.tasks?.length) {
    return syncPhaseFromTasks(phase);
  }

  const completion = phase.completion ?? 0;
  if (completion >= 100) return { ...phase, completion: 100, status: "completed" };
  if (completion > 0 && phase.status === "not_started") {
    return { ...phase, status: "in_progress" };
  }
  if (completion === 0 && phase.status === "completed") {
    return { ...phase, status: "not_started" };
  }
  return phase;
}

export function parseSequentialProjectId(id) {
  const match = String(id ?? "").trim().match(/^([NC])-(\d{4})$/i);
  if (!match) return null;
  return { prefix: match[1].toUpperCase(), number: parseInt(match[2], 10) };
}

export function formatSequentialProjectId(prefix, number) {
  return `${prefix}-${String(number).padStart(4, "0")}`;
}

export function getNextProjectId(clientType, projects = []) {
  const prefix = clientType === "client" ? "C" : "N";
  let maxNum = 0;

  for (const project of projects) {
    const parsed = parseSequentialProjectId(project.id);
    if (parsed?.prefix === prefix) {
      maxNum = Math.max(maxNum, parsed.number);
    }
  }

  return formatSequentialProjectId(prefix, maxNum + 1);
}

export function projectToForm(project) {
  const phases = PHASE_IDS.reduce((acc, id) => {
    acc[id] = normalizePhase(project.phases?.[id] ?? {});
    return acc;
  }, {});

  const teamMembers = (project.team?.teamMembers ?? [])
    .map((member) => (typeof member === "string" ? member : member?.id))
    .filter(Boolean);

  return {
    foundation: {
      projectId: project.id ?? "",
      projectName: project.projectName ?? "",
      projectType: project.projectType ?? "web_app",
      clientType: project.clientType ?? "internal",
      description: project.description ?? "",
      priority: project.priority ?? "medium",
      targetLaunchDate: project.targetLaunchDate ?? "",
    },
    phases,
    team: {
      projectOwner: project.team?.projectOwner ?? "",
      teamMembers,
      sprintLength: project.team?.sprintLength ?? "2_weeks",
      timelineType: project.team?.timelineType ?? "agile",
      estimatedBudget: project.team?.estimatedBudget ?? "",
    },
    kpis: {
      successMetrics: project.kpis?.successMetrics ?? [],
      revenueGoal: project.kpis?.revenueGoal ?? "",
      riskLevel: project.kpis?.riskLevel ?? "medium",
      expectedUserVolume: project.kpis?.expectedUserVolume ?? "1k_10k",
      notes: project.kpis?.notes ?? "",
    },
  };
}

export function normalizeProject(project) {
  let phases = project.phases ?? {};

  if (!hasPhaseData(phases) && project.progress != null) {
    phases = phasesFromOverallProgress(project.progress);
  } else {
    phases = ensurePhases(phases);
  }

  phases = PHASE_IDS.reduce((acc, id) => {
    acc[id] = syncPhaseStatus(phases[id]);
    return acc;
  }, {});

  const schedule = ensureProjectSchedule(project, phases);
  phases = schedule.phases;

  const progress = calcProgress(phases);
  const tasksComplete = isProjectTasksComplete({ ...project, phases });
  const status = tasksComplete ? "completed" : "active";

  let timelineStartedAt = project.timelineStartedAt ?? null;
  let timelineCompletedAt = project.timelineCompletedAt ?? null;

  if (tasksComplete && timelineStartedAt && !timelineCompletedAt) {
    timelineCompletedAt = new Date().toISOString();
  } else if (!tasksComplete) {
    timelineCompletedAt = null;
  }

  return {
    ...project,
    phases,
    progress,
    status,
    color: project.color,
    targetLaunchDate: schedule.targetLaunchDate ?? project.targetLaunchDate,
    timelineStartedAt,
    timelineCompletedAt,
  };
}

export function updateProjectPhase(project, phaseId, patch) {
  const phases = ensurePhases(project.phases);
  phases[phaseId] = syncPhaseStatus({ ...phases[phaseId], ...patch });
  return normalizeProject({ ...project, phases });
}

export function updateProjectTask(project, phaseId, taskId, patch) {
  const phases = ensurePhases(project.phases);
  const phase = phases[phaseId];
  phases[phaseId] = syncPhaseFromTasks({
    ...phase,
    tasks: (phase.tasks ?? []).map((task) =>
      task.id === taskId ? { ...task, ...patch } : task
    ),
  });
  return normalizeProject({ ...project, phases });
}

export function formatLogDateTime(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function pauseTaskTimer(task, now = Date.now()) {
  if (!task.timerStartedAt) return task;
  const elapsed = task.elapsedMs ?? 0;
  const sessionMs = Math.max(0, now - new Date(task.timerStartedAt).getTime());
  return {
    ...task,
    elapsedMs: elapsed + sessionMs,
    timerStartedAt: null,
  };
}

export function resumeTaskTimer(task, now = Date.now()) {
  if (task.completed || task.timerStartedAt) return task;
  const iso = new Date(now).toISOString();
  return {
    ...task,
    timerStartedAt: iso,
    startedAt: task.startedAt ?? iso,
  };
}

export function stopTaskTimer(task, now = Date.now()) {
  return pauseTaskTimer(task, now);
}

export function getTaskElapsedMs(task, now = Date.now()) {
  if (task.completed) return task.elapsedMs ?? 0;
  const elapsed = task.elapsedMs ?? 0;
  const startedAt = task.timerStartedAt;
  if (!startedAt) return elapsed;
  return elapsed + Math.max(0, now - new Date(startedAt).getTime());
}

function resetPhaseTaskTimes(phase) {
  return {
    ...phase,
    activeTaskId: null,
    timerPausedByInProg: false,
    jobSessionActive: false,
    timerManuallyPaused: false,
    tasks: (phase.tasks ?? []).map((task) => ({
      ...task,
      elapsedMs: 0,
      timerStartedAt: null,
      startedAt: null,
      completedAt: null,
    })),
  };
}

function pauseAllPhaseTaskTimers(phase, now = Date.now()) {
  return {
    ...phase,
    tasks: (phase.tasks ?? []).map((task) => pauseTaskTimer(task, now)),
  };
}

function stopAllPhaseTimers(phase, now = Date.now()) {
  return pauseAllPhaseTaskTimers(
    stopPhaseTimer(pausePhaseTimer(phase, now), now),
    now
  );
}

function phaseClockRunning(phase) {
  return !!phase.timerStartedAt && !phase.timerStopped;
}

function phaseAnyTaskClockRunning(phase) {
  return (phase.tasks ?? []).some((task) => taskTimerIsRunning(task));
}

function phaseHadTimerActivity(phase) {
  if (!phase) return false;
  const tasks = phase.tasks ?? [];
  return (
    phase.jobSessionActive ||
    !!phase.timerStartedAt ||
    (phase.timerElapsedMs ?? 0) > 0 ||
    tasks.some(
      (task) =>
        taskTimerIsRunning(task) ||
        (task.elapsedMs ?? 0) > 0 ||
        !!task.startedAt ||
        !!task.completedAt
    )
  );
}

function repairPhaseTimers(phase, now = Date.now()) {
  if (phase.status === "on_hold" || phase.timerManuallyPaused) {
    return phase;
  }

  let result = { ...phase };
  const tasks = result.tasks ?? [];
  const hasRunningTask = tasks.some((task) => taskTimerIsRunning(task));
  const activeTask = tasks.find((task) => task.id === result.activeTaskId && !task.completed);
  const shouldRunClock = phaseHadTimerActivity(result);

  if (!shouldRunClock) {
    return result;
  }

  if (!result.jobSessionActive) {
    result = { ...result, jobSessionActive: true };
  }

  if (result.timerStopped) {
    result = { ...result, timerStopped: false };
  }

  if (activeTask && !activeTask.timerStartedAt) {
    result = {
      ...result,
      tasks: tasks.map((task) => {
        if (task.completed) return task;
        if (task.id === activeTask.id) {
          return resumeTaskTimer(task, now);
        }
        return pauseTaskTimer(task, now);
      }),
    };
    return result;
  }

  if (!hasRunningTask && !result.timerStartedAt) {
    result = resumePhaseTimer(result, now);
  }

  return result;
}

function phaseTimersRunning(phase) {
  return phaseClockRunning(phase) || phaseAnyTaskClockRunning(phase);
}

export function getTaskRowControlMode(task, tasks, index, activeTaskId = null) {
  if (task.completed) return "completed";

  const isActiveTask = activeTaskId === task.id;
  const hasRunningTimer = taskTimerIsRunning(task);

  if (hasRunningTimer || isActiveTask) return "complete";

  const nextIndex = tasks.findIndex((item) => !item.completed);
  const isNext = index === nextIndex;
  const hasPriorTime = !!task.startedAt || (task.elapsedMs ?? 0) > 0;

  if (isNext || hasPriorTime) return "play";

  return "waiting";
}

function resumePhaseActiveTask(phase, now = Date.now()) {
  if (!phase.activeTaskId) return phase;
  const tasks = (phase.tasks ?? []).map((item) => {
    if (item.completed) return item;
    if (item.id === phase.activeTaskId) {
      return resumeTaskTimer(item, now);
    }
    return pauseTaskTimer(item, now);
  });
  return { ...phase, tasks, timerManuallyPaused: false };
}

function resumePhaseTimersFromPause(phase, now = Date.now()) {
  phase = resumePhaseActiveTask(phase, now);
  if (phaseClockRunning(phase) || !phase.activeTaskId) {
    phase = resumePhaseTimer({ ...phase, timerStopped: false }, now);
  }
  return phase;
}

export function pausePhaseElapsedTimer(project, phaseId, now = Date.now()) {
  const phases = ensurePhases(project.phases);
  let phase = phases[phaseId];
  if (!phase.jobSessionActive || phase.status === "on_hold") {
    return normalizeProject(project);
  }

  phase = pauseAllPhaseTaskTimers(pausePhaseTimer(phase, now), now);
  phases[phaseId] = syncPhaseFromTasks({
    ...phase,
    timerManuallyPaused: true,
    timerPausedByInProg: false,
  });
  return normalizeProject({ ...project, phases });
}

export function resumePhaseElapsedTimer(project, phaseId, now = Date.now()) {
  const phases = ensurePhases(project.phases);
  let phase = phases[phaseId];
  if (!phase.jobSessionActive || phase.status === "on_hold") {
    return normalizeProject(project);
  }

  phase = resumePhaseTimersFromPause(phase, now);

  phases[phaseId] = syncPhaseFromTasks({
    ...phase,
    status: "in_progress",
    timerManuallyPaused: false,
    timerPausedByInProg: false,
  });
  return normalizeProject({ ...project, phases });
}

export function togglePhaseElapsedPause(project, phaseId, now = Date.now()) {
  const phase = ensurePhases(project.phases)[phaseId];
  if (phase.timerManuallyPaused) {
    return resumePhaseElapsedTimer(project, phaseId, now);
  }
  if (phaseTimersRunning(phase)) {
    return pausePhaseElapsedTimer(project, phaseId, now);
  }
  return normalizeProject(project);
}

export function startProjectPhaseTask(project, phaseId, taskId, now = Date.now()) {
  const phases = ensurePhases(project.phases);
  let phase = phases[phaseId];
  const tasks = phase.tasks ?? [];
  const taskIndex = tasks.findIndex((item) => item.id === taskId);
  const task = tasks[taskIndex];
  if (!task || task.completed) return normalizeProject(project);
  if (phase.status === "on_hold") return normalizeProject(project);
  if (getTaskRowControlMode(task, tasks, taskIndex) !== "play") return normalizeProject(project);

  if (phaseClockRunning(phase)) {
    phase = pausePhaseTimer(phase, now);
  }

  const updatedTasks = tasks.map((item) => {
    if (item.completed) return item;
    if (item.id === taskId) {
      const iso = new Date(now).toISOString();
      return resumeTaskTimer(
        { ...pauseTaskTimer(item, now), startedAt: item.startedAt ?? iso },
        now
      );
    }
    return pauseTaskTimer(item, now);
  });

  phases[phaseId] = syncPhaseFromTasks({
    ...phase,
    activeTaskId: taskId,
    tasks: updatedTasks,
    status: "in_progress",
    jobSessionActive: true,
    timerPausedByInProg: false,
    timerManuallyPaused: false,
  });

  let timelineStartedAt = project.timelineStartedAt ?? null;
  if (!timelineStartedAt) {
    timelineStartedAt = new Date(now).toISOString();
  }

  return normalizeProject({ ...project, phases, timelineStartedAt });
}

export function setProjectPhaseActiveTask(project, phaseId, taskId, now = Date.now()) {
  return startProjectPhaseTask(project, phaseId, taskId, now);
}

export function toggleProjectTask(project, phaseId, taskId, now = Date.now()) {
  const phases = ensurePhases(project.phases);
  let phase = phases[phaseId];
  const tasks = phase.tasks ?? [];
  const taskIndex = tasks.findIndex((item) => item.id === taskId);
  const task = tasks[taskIndex];
  if (!task) return normalizeProject(project);

  const nextCompleted = !task.completed;

  if (nextCompleted && getTaskRowControlMode(task, tasks, taskIndex, phase.activeTaskId) !== "complete") {
    return normalizeProject(project);
  }

  let activeTaskId = phase.activeTaskId;

  const updatedTasks = tasks.map((item, index) => {
    if (item.id !== taskId) return item;

    if (nextCompleted) {
      const stopped = stopTaskTimer(item, now);
      if (activeTaskId === taskId) activeTaskId = null;
      return {
        ...stopped,
        completed: true,
        completedAt: new Date(now).toISOString(),
        timerStartedAt: null,
      };
    }

    return {
      ...pauseTaskTimer(item, now),
      completed: false,
      completedAt: null,
      startedAt: null,
      elapsedMs: 0,
      timerStartedAt: null,
    };
  });

  phases[phaseId] = syncPhaseFromTasks({
    ...phase,
    activeTaskId,
    tasks: updatedTasks,
    status: phase.status === "on_hold" ? "on_hold" : "in_progress",
    timerPausedByInProg: false,
  });
  let updated = normalizeProject({ ...project, phases });
  const updatedPhase = ensurePhases(updated.phases)[phaseId];
  const allDone =
    (updatedPhase.tasks ?? []).length > 0 &&
    (updatedPhase.tasks ?? []).every((item) => item.completed);
  if (allDone) {
    phases[phaseId] = syncPhaseFromTasks({
      ...updatedPhase,
      activeTaskId: null,
      jobSessionActive: true,
      timerStopped: false,
    });
    updated = normalizeProject({ ...project, phases });
  }
  return updated;
}

export function uncompleteProjectTask(project, phaseId, taskId, now = Date.now()) {
  const phases = ensurePhases(project.phases);
  let phase = phases[phaseId];
  const tasks = phase.tasks ?? [];
  const task = tasks.find((item) => item.id === taskId);
  if (!task?.completed) return normalizeProject(project);

  const updatedTasks = tasks.map((item) => {
    if (item.id !== taskId) return item;
    return {
      ...pauseTaskTimer(item, now),
      completed: false,
      completedAt: null,
      timerStartedAt: null,
    };
  });

  const wasAllDone = tasks.length > 0 && tasks.every((item) => item.completed);

  phase = {
    ...phase,
    tasks: updatedTasks,
    activeTaskId: null,
    jobSessionActive: true,
    timerStopped: false,
    timerManuallyPaused: false,
    timerPausedByInProg: false,
  };

  if (phase.status === "completed" || wasAllDone) {
    phase.status = phase.status === "on_hold" ? "on_hold" : "in_progress";
  }

  phases[phaseId] = syncPhaseFromTasks(phase);
  return normalizeProject({ ...project, phases });
}

function completeTasksWithTimestamps(tasks, now = Date.now()) {
  return tasks.map((task) => {
    const stopped = stopTaskTimer(task, now);
    return {
      ...stopped,
      completed: true,
      completedAt: stopped.completedAt ?? new Date(now).toISOString(),
      startedAt: stopped.startedAt ?? new Date(now).toISOString(),
      timerStartedAt: null,
    };
  });
}

export function taskTimerIsRunning(task) {
  return !!task.timerStartedAt && !task.completed;
}

export function projectHasRunningTaskTimer(project) {
  const phases = ensurePhases(project.phases);
  return PHASE_IDS.some((id) =>
    (phases[id]?.tasks ?? []).some((task) => taskTimerIsRunning(task))
  );
}

export function getProjectTaskProgressLog(project, now = Date.now()) {
  const phases = ensurePhases(project.phases);
  const entries = [];

  for (const def of PHASE_DEFS) {
    const phase = phases[def.id];
    const tasks = phase.tasks ?? [];
    const phaseElapsedMs = getPhaseTimerElapsedMs(phase, now);

    for (const task of tasks) {
      const elapsedMs = getTaskElapsedMs(task, now);
      entries.push({
        phaseId: def.id,
        phaseLabel: def.shortLabel ?? def.title,
        taskId: task.id,
        taskTitle: task.title || "Untitled",
        startedAt: task.startedAt ?? null,
        completedAt: task.completedAt ?? null,
        elapsedMs,
        completed: !!task.completed,
        inProgress: taskTimerIsRunning(task),
        isActive: phase.activeTaskId === task.id,
        phaseStatus: phase.status ?? "not_started",
        phaseElapsedMs,
      });
    }
  }

  return entries;
}

export function projectTaskLogHasLiveEntry(project, now = Date.now()) {
  if (projectHasRunningTimer(project)) return true;
  if (projectHasRunningTaskTimer(project)) return true;
  return getProjectTaskProgressLog(project, now).some((entry) => entry.inProgress);
}

export function pausePhaseTimer(phase, now = Date.now()) {
  const elapsed = phase.timerElapsedMs ?? 0;
  const startedAt = phase.timerStartedAt;
  if (!startedAt) {
    return { ...phase, timerElapsedMs: elapsed, timerStartedAt: null };
  }
  return {
    ...phase,
    timerElapsedMs: elapsed + (now - new Date(startedAt).getTime()),
    timerStartedAt: null,
  };
}

export function resumePhaseTimer(phase, now = Date.now()) {
  if (phase.timerStopped) return phase;
  if (phase.timerStartedAt) return phase;
  return {
    ...phase,
    timerStartedAt: new Date(now).toISOString(),
  };
}

export function stopPhaseTimer(phase, now = Date.now()) {
  const paused = pausePhaseTimer(phase, now);
  return { ...paused, timerStopped: true };
}

export function resetPhaseTimer(phase) {
  return {
    ...phase,
    timerElapsedMs: 0,
    timerStartedAt: null,
    timerStopped: false,
  };
}

export function getPhaseTimerElapsedMs(phase, now = Date.now()) {
  const elapsed = phase.timerElapsedMs ?? 0;
  const startedAt = phase.timerStartedAt;

  if (phase.status === "on_hold" || phase.timerManuallyPaused) {
    if (!startedAt || phase.timerStopped) return elapsed;
    return elapsed + (now - new Date(startedAt).getTime());
  }

  if (!phaseHasActiveElapsedClock(phase)) {
    return elapsed;
  }

  if (!startedAt) return elapsed;
  return elapsed + (now - new Date(startedAt).getTime());
}

export function getPhaseTasksElapsedMs(phase, now = Date.now()) {
  return (phase.tasks ?? []).reduce(
    (sum, task) => sum + getTaskElapsedMs(task, now),
    0
  );
}

export function phaseElapsedIsVisible(phase, now = Date.now()) {
  if (phase.jobSessionActive) return true;
  if (phaseTimerIsVisible(phase)) return true;
  return (phase.tasks ?? []).some(
    (task) =>
      taskTimerIsRunning(task) ||
      (task.elapsedMs ?? 0) > 0 ||
      !!task.startedAt
  );
}

export function phaseTimerIsVisible(phase) {
  return (
    !!phase.timerStartedAt ||
    !!phase.timerStopped ||
    (phase.timerElapsedMs ?? 0) > 0
  );
}

export function formatPhaseTimer(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const daySeconds = 24 * 3600;

  if (totalSeconds >= daySeconds) {
    const days = Math.floor(totalSeconds / daySeconds);
    const remainder = totalSeconds % daySeconds;
    const hours = Math.floor(remainder / 3600);
    const minutes = Math.floor((remainder % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function getProjectElapsedMs(project, now = Date.now()) {
  return getProjectElapsedBreakdown(project, now).totalMs;
}

export function formatProjectElapsedTime(ms) {
  return formatPhaseTimer(ms);
}

export function getProjectTimelineElapsedMs(project, now = Date.now()) {
  const startedAt = project.timelineStartedAt;
  if (!startedAt) return 0;

  return Math.max(0, now - new Date(startedAt).getTime());
}

export function getPhaseTotalElapsedMs(phase, now = Date.now()) {
  const phaseClockActive = phaseHasActiveElapsedClock(phase);
  return (
    getPhaseTasksElapsedMs(phase, now) +
    (phaseClockActive ? getPhaseTimerElapsedMs(phase, now) : 0)
  );
}

export function getProjectElapsedBreakdown(project, now = Date.now(), phasesInput) {
  const phases = phasesInput ?? ensurePhases(project.phases);
  const phaseTimes = PHASE_DEFS.map((def) => ({
    id: def.id,
    label: def.shortLabel,
    elapsedMs: getPhaseTotalElapsedMs(phases[def.id], now),
  }));
  const totalMs = phaseTimes.reduce((sum, phase) => sum + phase.elapsedMs, 0);
  const timelineMs = getProjectTimelineElapsedMs(project, now);
  return { phaseTimes, totalMs, timelineMs };
}

export function phaseHasActiveElapsedClock(phase) {
  if (!phase || phase.status === "on_hold" || phase.timerManuallyPaused) return false;
  if ((phase.tasks ?? []).some((task) => taskTimerIsRunning(task))) return true;
  if (phase.timerStartedAt && !phase.timerStopped) return true;
  if (
    phase.jobSessionActive &&
    (phase.status === "in_progress" || phase.status === "completed")
  ) {
    return true;
  }
  return false;
}

export function projectTimelineClockActive(project) {
  return !!project.timelineStartedAt && !isProjectOnHold(project);
}

export function projectHasRunningTimer(project) {
  if (projectHasRunningTaskTimer(project)) return true;
  const phases = ensurePhases(project.phases);
  if (PHASE_IDS.some((id) => phaseHasActiveElapsedClock(phases[id]))) return true;
  return projectTimelineClockActive(project);
}

function isPhaseCompleted(phase, tasks = phase.tasks ?? []) {
  const taskDone = tasks.filter((task) => task.completed).length;
  const taskTotal = tasks.length;
  return (
    phase.status === "completed" ||
    (taskTotal > 0 && taskDone === taskTotal) ||
    (phase.completion ?? 0) >= 100
  );
}

export function setProjectPhaseStatus(project, phaseId, status) {
  const phases = ensurePhases(project.phases);
  let phase = phases[phaseId];
  const now = Date.now();
  const prevStatus = phase.status ?? "not_started";
  const tasks = phase.tasks ?? [];

  if (status === "completed") {
    if (isPhaseCompleted(phase, tasks)) {
      if (tasks.length) {
        const uncheckedTasks = tasks.map((task) => ({
          ...pauseTaskTimer(task, now),
          completed: false,
          completedAt: null,
          startedAt: null,
          elapsedMs: 0,
          timerStartedAt: null,
        }));
        phase = syncPhaseFromTasks({
          ...resetPhaseTimer(phase),
          activeTaskId: null,
          tasks: uncheckedTasks,
          status: "not_started",
          jobSessionActive: false,
          timerPausedByInProg: false,
          timerManuallyPaused: false,
        });
      } else {
        phase = resetPhaseTimer({
          ...phase,
          activeTaskId: null,
          jobSessionActive: false,
          timerPausedByInProg: false,
          completion: 0,
          status: "not_started",
        });
      }
    } else {
      const completedTasks = completeTasksWithTimestamps(tasks, now);
      phase = syncPhaseFromTasks({
        ...phase,
        tasks: completedTasks,
        activeTaskId: null,
        status: "completed",
        timerPausedByInProg: false,
        jobSessionActive: true,
      });
      if (!tasks.length) {
        phase = { ...phase, completion: 100, status: "completed" };
      }
    }
  } else if (status === "on_hold") {
    if (prevStatus === "on_hold") {
      phase = resumePhaseTimersFromPause(
        syncPhaseFromTasks({
          ...phase,
          status: "in_progress",
        }),
        now
      );
    } else {
      phase = pauseAllPhaseTaskTimers(
        pausePhaseTimer(
          { ...syncPhaseFromTasks(phase), status: "on_hold", timerManuallyPaused: false },
          now
        ),
        now
      );
    }
  } else if (status === "in_progress") {
    if (prevStatus === "on_hold") {
      return normalizeProject(project);
    }
    if (phase.jobSessionActive) {
      phase = pauseAllPhaseTaskTimers(
        pausePhaseTimer(syncPhaseFromTasks({ ...phase, status: "not_started" }), now),
        now
      );
      phase = {
        ...phase,
        activeTaskId: null,
        jobSessionActive: false,
        timerPausedByInProg: false,
        timerManuallyPaused: false,
      };
    } else if (!isPhaseCompleted(phase, tasks)) {
      phase = resumePhaseTimersFromPause(
        syncPhaseFromTasks(
          resumePhaseTimer(
            {
              ...phase,
              status: "in_progress",
              jobSessionActive: true,
              timerPausedByInProg: false,
              timerManuallyPaused: false,
              timerStopped: false,
            },
            now
          ),
          now
        ),
        now
      );
    }
  } else {
    phase = pauseAllPhaseTaskTimers(
      pausePhaseTimer(syncPhaseFromTasks({ ...phase, status: "not_started" }), now),
      now
    );
    phase = { ...phase, activeTaskId: null, jobSessionActive: false, timerPausedByInProg: false };
  }

  phases[phaseId] = syncPhaseStatus(phase);

  return normalizeProject({ ...project, phases, timelineStartedAt: project.timelineStartedAt ?? null });
}

export function getPhaseButtonState(phase, tasks = phase.tasks ?? []) {
  const taskDone = tasks.filter((t) => t.completed).length;
  const taskTotal = tasks.length;
  const status = phase.status ?? "not_started";
  const completion = phase.completion ?? 0;

  const onHoldActive = status === "on_hold";
  const completedActive =
    status === "completed" ||
    (taskTotal > 0 && taskDone === taskTotal) ||
    completion >= 100;
  const inProgressActive =
    !onHoldActive &&
    !completedActive &&
    !!phase.jobSessionActive &&
    status === "in_progress";

  return { onHoldActive, completedActive, inProgressActive, taskDone, taskTotal };
}

export function getProjectTaskGroups(project) {
  const phases = ensurePhases(project.phases);
  return PHASE_DEFS.map((def) => ({
    id: def.id,
    title: def.title,
    tasks: phases[def.id]?.tasks ?? [],
    completion: phases[def.id]?.completion ?? 0,
  })).filter((group) => group.tasks.length > 0);
}

export function countProjectTasks(project) {
  const groups = getProjectTaskGroups(project);
  const total = groups.reduce((sum, g) => sum + g.tasks.length, 0);
  const done = groups.reduce(
    (sum, g) => sum + g.tasks.filter((t) => t.completed).length,
    0
  );
  return { total, done, groups };
}

export function projectUsesTaskProgress(project) {
  return countProjectTasks(project).total > 0;
}

export function isProjectTasksComplete(project) {
  const { total, done } = countProjectTasks(project);
  if (total === 0) return false;
  return done === total;
}

export function isProjectComplete(project) {
  return project.status === "completed" || isProjectTasksComplete(project);
}

export function filterActiveProjects(projects = []) {
  return projects.filter((project) => !isProjectComplete(project));
}

export function filterCompletedProjects(projects = []) {
  return projects.filter((project) => isProjectComplete(project));
}

export function isProjectOnHold(project) {
  const phases = ensurePhases(project.phases);
  return PHASE_IDS.some((id) => phases[id]?.status === "on_hold");
}

export function getProjectOnHoldDetails(project) {
  const phases = ensurePhases(project.phases);
  return PHASE_DEFS.filter((def) => phases[def.id]?.status === "on_hold").map((def) => {
    const phase = phases[def.id];
    const incompleteTasks = (phase.tasks ?? []).filter((task) => !task.completed);
    const taskTitles = (incompleteTasks.length ? incompleteTasks : phase.tasks ?? []).map(
      (task) => task.title || "Untitled"
    );

    return {
      phaseTitle: def.shortLabel ?? def.title,
      taskTitles,
    };
  });
}

export function formatProjectOnHoldLabel(project) {
  const holds = getProjectOnHoldDetails(project);
  if (!holds.length) return project.projectName;

  const detail = holds
    .map(({ phaseTitle, taskTitles }) => {
      if (!taskTitles.length) return phaseTitle;
      return `${phaseTitle}: ${taskTitles.join(", ")}`;
    })
    .join("; ");

  return `${project.projectName} - (${detail})`;
}

export function getOnHoldProjects(projects) {
  return projects.filter(isProjectOnHold);
}

export function getOnHoldPhasesForProject(project) {
  const phases = ensurePhases(project.phases);
  return PHASE_DEFS.filter((def) => phases[def.id]?.status === "on_hold").map((def) => {
    const phase = phases[def.id];
    const incompleteTasks = (phase.tasks ?? []).filter((task) => !task.completed);
    const allTitles = (incompleteTasks.length ? incompleteTasks : phase.tasks ?? []).map(
      (task) => task.title || "Untitled"
    );

    return {
      phaseId: def.id,
      label: def.shortLabel ?? def.title,
      completion: phase.completion ?? 0,
      taskTitles: allTitles.slice(0, 3),
      extraTasks: Math.max(0, allTitles.length - 3),
    };
  });
}

export function getOnHoldProjectsDetails(projects) {
  return filterActiveProjects(projects)
    .filter(isProjectOnHold)
    .map((project) => ({
      project,
      progress: project.progress ?? calcProgress(project.phases),
      phases: getOnHoldPhasesForProject(project),
    }));
}

export function isProjectAtRisk(project) {
  if (isProjectOnHold(project)) return false;
  const progress = project.progress ?? calcProgress(project.phases);
  return progress >= 20 && progress < 40;
}

export function getAtRiskPhasesForProject(project) {
  const phases = ensurePhases(project.phases);
  const results = [];

  for (const def of PHASE_DEFS) {
    const phase = phases[def.id];
    if (!phase) continue;

    const completion = phase.completion ?? 0;
    const status = phase.status ?? "not_started";
    const isComplete = completion >= 100 || status === "completed";
    if (isComplete) continue;

    const incompleteTasks = (phase.tasks ?? []).filter((task) => !task.completed);
    const taskTitles = incompleteTasks.map((task) => task.title || "Untitled");

    let riskReason = null;
    if (status === "on_hold") {
      riskReason = "Phase on hold";
    } else if (status === "in_progress" && completion < 50) {
      riskReason = "In progress — behind pace";
    } else if (completion > 0 && completion < 40) {
      riskReason = `Low completion (${completion}%)`;
    } else if (status === "in_progress") {
      riskReason = "Active — needs attention";
    }

    if (riskReason) {
      results.push({
        phaseId: def.id,
        label: def.shortLabel ?? def.title,
        completion,
        status,
        riskReason,
        taskTitles: taskTitles.slice(0, 3),
        extraTasks: Math.max(0, incompleteTasks.length - 3),
      });
    }
  }

  if (results.length === 0) {
    const firstIncomplete = PHASE_DEFS.find((def) => {
      const phase = phases[def.id];
      const completion = phase?.completion ?? 0;
      return completion < 100 && phase?.status !== "completed";
    });
    if (firstIncomplete) {
      const phase = phases[firstIncomplete.id];
      const completion = phase?.completion ?? 0;
      results.push({
        phaseId: firstIncomplete.id,
        label: firstIncomplete.shortLabel ?? firstIncomplete.title,
        completion,
        status: phase?.status ?? "not_started",
        riskReason: "Contributing to portfolio risk",
        taskTitles: [],
        extraTasks: 0,
      });
    }
  }

  return results;
}

export function getAtRiskProjects(projects) {
  return filterActiveProjects(projects)
    .filter(isProjectAtRisk)
    .map((project) => ({
      project,
      progress: project.progress ?? calcProgress(project.phases),
      phases: getAtRiskPhasesForProject(project),
    }));
}

export function isProjectStarted(project) {
  const phases = ensurePhases(project.phases);
  const { done, total } = countProjectTasks(project);

  if (done > 0) return true;

  if (total > 0) {
    return PHASE_IDS.some((id) => {
      const status = phases[id]?.status ?? "not_started";
      return status === "in_progress" || status === "on_hold" || status === "completed";
    });
  }

  const progress = project.progress ?? calcProgress(phases);
  return progress > 0;
}

export function getCurrentPhaseId(project) {
  const phases = ensurePhases(project.phases);
  const active = PHASE_IDS.find((id) => {
    const phase = phases[id];
    return phase.status === "in_progress" || (phase.completion > 0 && phase.completion < 100);
  });
  if (active) return active;

  const firstIncomplete = PHASE_IDS.find((id) => (phases[id].completion ?? 0) < 100);
  return firstIncomplete ?? PHASE_IDS[PHASE_IDS.length - 1];
}

export function completePhase(project, phaseId) {
  const phases = ensurePhases(project.phases);
  const phaseIndex = PHASE_IDS.indexOf(phaseId);
  if (phaseIndex === -1) return normalizeProject(project);

  phases[phaseId] = syncPhaseStatus({
    ...phases[phaseId],
    completion: 100,
    status: "completed",
  });

  const nextId = PHASE_IDS[phaseIndex + 1];
  if (nextId && (phases[nextId].completion ?? 0) === 0) {
    phases[nextId] = syncPhaseStatus({
      ...phases[nextId],
      status: "in_progress",
    });
  }

  return normalizeProject({ ...project, phases });
}

export function advanceProjectPhase(project) {
  const currentId = getCurrentPhaseId(project);
  return completePhase(project, currentId);
}

export function completeProject(project) {
  const phases = PHASE_IDS.reduce((acc, id) => {
    acc[id] = syncPhaseStatus({
      ...ensurePhases(project.phases)[id],
      completion: 100,
      status: "completed",
    });
    return acc;
  }, {});

  return normalizeProject({ ...project, phases, status: "completed" });
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDateISO(date) {
  return date.toISOString().slice(0, 10);
}

function formatMilestoneDate(dateStr) {
  const d = parseDate(dateStr);
  if (!d) return dateStr;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysUntil(from, to) {
  const ms = startOfDay(to).getTime() - startOfDay(from).getTime();
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

function ensureProjectSchedule(project, phases) {
  const today = startOfDay(new Date());
  const projectOffset = [...(project.id ?? "")].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 12;

  PHASE_IDS.forEach((id, index) => {
    const phase = phases[id];
    if ((phase.completion ?? 0) >= 100) return;

    const taskEndDates = (phase.tasks ?? []).map((t) => t.endDate).filter(Boolean);
    if (taskEndDates.length) {
      phases[id] = {
        ...phase,
        endDate: taskEndDates.sort().reverse()[0],
        startDate: (phase.tasks ?? []).map((t) => t.startDate).filter(Boolean).sort()[0] ?? phase.startDate,
      };
      return;
    }

    if (!phase.endDate) {
      const end = new Date(today);
      end.setDate(end.getDate() + projectOffset + (index + 1) * 28);
      phases[id] = { ...phase, endDate: formatDateISO(end) };
    }
  });

  let targetLaunchDate = project.targetLaunchDate;
  const launchDate = parseDate(targetLaunchDate);
  if (!launchDate || launchDate < today) {
    const futureEnds = PHASE_IDS.map((id) => phases[id].endDate)
      .filter(Boolean)
      .sort()
      .reverse();
    const lastEnd = futureEnds[0];
    if (lastEnd) {
      const launch = parseDate(lastEnd);
      launch.setDate(launch.getDate() + 14);
      targetLaunchDate = formatDateISO(launch);
    }
  }

  return { phases, targetLaunchDate };
}

export function getUpcomingMilestones(
  projects,
  { limit = 5, now = new Date(), calendarEvents = [] } = {}
) {
  const today = startOfDay(now);
  const items = [];

  for (const event of calendarEvents) {
    if (!event.date) continue;
    const eventType = event.type ?? "event";
    items.push({
      id: `cal-${event.id}`,
      projectId: event.projectId ?? null,
      projectName: event.project?.trim() || "Calendar",
      title: event.title?.trim() || "Untitled event",
      date: event.date,
      type: `calendar_${eventType}`,
      eventTypeLabel: EVENT_TYPE_LABELS[eventType] ?? "Event",
      color: event.projectColor || EVENT_TYPE_COLORS[eventType] || "#8b5cf6",
    });
  }

  for (const project of projects) {
    if (project.status === "completed") continue;

    const projectName = project.projectName ?? "Untitled Project";
    const color = getProjectStageColor(project);
    const phases = ensurePhases(project.phases);

    if (project.targetLaunchDate) {
      items.push({
        id: `${project.id}-launch`,
        projectId: project.id,
        projectName,
        title: "Target Launch",
        date: project.targetLaunchDate,
        type: "launch",
        color,
      });
    }

    for (const phaseDef of PHASE_DEFS) {
      const phase = phases[phaseDef.id];
      const completion = phase.completion ?? 0;
      if (completion >= 100) continue;

      if (phase.endDate) {
        items.push({
          id: `${project.id}-${phaseDef.id}-end`,
          projectId: project.id,
          projectName,
          title: `${phaseDef.title} complete`,
          date: phase.endDate,
          type: "phase_end",
          color,
        });
      }

      if (phase.startDate && phase.status === "not_started") {
        items.push({
          id: `${project.id}-${phaseDef.id}-start`,
          projectId: project.id,
          projectName,
          title: `${phaseDef.title} kickoff`,
          date: phase.startDate,
          type: "phase_start",
          color,
        });
      }

      for (const task of phase.tasks ?? []) {
        if (task.completed || !task.endDate) continue;
        items.push({
          id: `${project.id}-${phaseDef.id}-task-${task.id}`,
          projectId: project.id,
          projectName,
          title: task.title || "Untitled task",
          date: task.endDate,
          type: "task_due",
          color,
        });
      }
    }
  }

  const seen = new Set();

  return items
    .filter((item) => {
      const date = parseDate(item.date);
      if (!date || date < today) return false;
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .sort((a, b) => parseDate(a.date) - parseDate(b.date))
    .slice(0, limit)
    .map((item) => ({
      ...item,
      dateLabel: formatMilestoneDate(item.date),
      daysAway: daysUntil(today, parseDate(item.date)),
    }));
}
