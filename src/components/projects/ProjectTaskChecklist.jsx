import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  PHASE_DEFS,
  countProjectTasks,
  ensurePhases,
  formatLogDateTime,
  formatPhaseTimer,
  getPhaseButtonState,
  getProjectElapsedBreakdown,
  getProjectStageColor,
  projectHasRunningTimer,
  setProjectPhaseStatus,
  startProjectPhaseTask,
  themeFromStageColor,
  togglePhaseElapsedPause,
  toggleProjectTask,
  uncompleteProjectTask,
} from "../../lib/projectUtils";
import PhaseDeckCard from "./PhaseDeckCard";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function formatTaskDate(dateStr) {
  if (!dateStr) return null;
  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function TaskDetailsTooltip({ anchor, task }) {
  if (!anchor || !task) return null;

  const details = task.details?.trim();
  const startDate = formatTaskDate(task.startDate);
  const endDate = formatTaskDate(task.endDate);
  const startedAt = formatLogDateTime(task.startedAt);
  const completedAt = formatLogDateTime(task.completedAt);
  const elapsed = (task.elapsedMs ?? 0) > 0 ? formatPhaseTimer(task.elapsedMs) : null;

  const cardRect = anchor.cardRect;
  const gap = 12;
  const style = cardRect
    ? cardRect.left - gap >= 240
      ? {
          left: cardRect.left - gap,
          top: anchor.y,
          transform: "translate(-100%, -50%)",
        }
      : {
          left: cardRect.right + gap,
          top: anchor.y,
          transform: "translateY(-50%)",
        }
    : {
        left: anchor.x,
        top: anchor.y,
        transform: "translate(-50%, calc(-100% - 10px))",
      };

  return createPortal(
    <div
      role="tooltip"
      className="pointer-events-none fixed z-[100] w-max max-w-[min(280px,calc(100vw-2rem))] rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-xl ring-1 ring-slate-100"
      style={style}
    >
      <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-600">
        Task Details
      </p>
      <p className="mt-1 text-xs font-semibold text-slate-900">{task.title || "Untitled"}</p>
      {details ? (
        <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{details}</p>
      ) : (
        <p className="mt-1.5 text-xs italic text-slate-400">No additional details.</p>
      )}
      {(startDate || endDate) && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 border-t border-slate-100 pt-2 text-[10px] text-slate-500">
          {startDate && <span>Planned start: {startDate}</span>}
          {endDate && <span>Planned end: {endDate}</span>}
        </div>
      )}
      {(startedAt || completedAt || elapsed) && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 border-t border-slate-100 pt-2 text-[10px] text-slate-500">
          {startedAt && <span>Started: {startedAt}</span>}
          {completedAt && <span>Finished: {completedAt}</span>}
          {elapsed && <span>Elapsed: {elapsed}</span>}
        </div>
      )}
    </div>,
    document.body
  );
}

const PROGRESS_TABS = [
  { id: "progress", label: "Phase progress" },
  { id: "elapsed", label: "Elapsed time" },
];

function ProjectElapsedTimePanel({ phaseTimes, totalMs, timelineMs, hasRunningTimer, hasTimeline }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 text-center">
        <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
          Total elapsed
        </p>
        <p className="mt-2 text-5xl font-extrabold tabular-nums tracking-tight text-slate-900">
          {formatPhaseTimer(totalMs)}
          {hasRunningTimer && (
            <span className="ml-1.5 inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-indigo-500 align-middle" />
          )}
        </p>
        <p className="mt-1 text-xs font-semibold text-slate-500">
          Sum of all phase times
        </p>
        {hasTimeline && (
          <p className="mt-3 text-xs font-medium text-slate-500">
            Project duration (start to finish):{" "}
            <span className="text-sm font-extrabold tabular-nums text-slate-900">
              {formatPhaseTimer(timelineMs)}
            </span>
          </p>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3.5">
        <p className="mb-3 text-xs font-extrabold uppercase tracking-wider text-slate-500">
          Phase times
        </p>
        <ul className="space-y-2">
          {phaseTimes.map((phaseTime) => (
            <li
              key={phaseTime.id}
              className="flex items-center justify-between gap-3 text-sm text-slate-700"
            >
              <span className="min-w-0 truncate font-semibold">{phaseTime.label}</span>
              <span className="shrink-0 text-base font-extrabold tabular-nums text-slate-900">
                {formatPhaseTimer(phaseTime.elapsedMs)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between gap-3 border-t-2 border-slate-200 pt-3 text-sm">
          <span className="font-extrabold uppercase tracking-wide text-slate-800">Project total</span>
          <span className="text-xl font-extrabold tabular-nums text-slate-900">
            {formatPhaseTimer(totalMs)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ProjectTaskChecklist({
  project,
  onUpdate,
  embedded = false,
  zebraTaskRows = false,
}) {
  const phases = ensurePhases(project.phases);
  const stageColor = getProjectStageColor(project);
  const { total, done, groups } = countProjectTasks(project);
  const [activeTab, setActiveTab] = useState("progress");
  const hasRunningTimer = projectHasRunningTimer(project);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!hasRunningTimer) {
      setNow(Date.now());
      return undefined;
    }
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [hasRunningTimer, project]);

  const { phaseTimes, totalMs, timelineMs } = getProjectElapsedBreakdown(project, now, phases);
  const hasTimeline = !!project.timelineStartedAt;
  const [taskTooltip, setTaskTooltip] = useState(null);

  useEffect(() => {
    if (!taskTooltip) return undefined;
    const hide = () => setTaskTooltip(null);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [taskTooltip]);

  const handlePlayTask = (phaseId, taskId) => {
    if (!onUpdate) return;
    onUpdate(startProjectPhaseTask(project, phaseId, taskId));
  };

  const handleCompleteTask = (phaseId, taskId) => {
    if (!onUpdate) return;
    onUpdate(toggleProjectTask(project, phaseId, taskId));
  };

  const handleStatus = (phaseId, status) => {
    if (!onUpdate) return;
    onUpdate(setProjectPhaseStatus(project, phaseId, status));
  };

  const handleTogglePause = (phaseId) => {
    if (!onUpdate) return;
    onUpdate(togglePhaseElapsedPause(project, phaseId));
  };

  const handleUncompleteTask = (phaseId, taskId) => {
    if (!onUpdate) return;
    onUpdate(uncompleteProjectTask(project, phaseId, taskId));
  };

  return (
    <div className={cn(embedded ? "" : "mt-4 border-t border-slate-100 pt-4")}>
      <TaskDetailsTooltip anchor={taskTooltip} task={taskTooltip?.task} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {PROGRESS_TABS.map((tab) => {
            const isElapsedTab = tab.id === "elapsed";
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition",
                  isActive
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                {tab.id === "progress" ? "Tasks" : "Time"}
                {isElapsedTab && totalMs > 0 && (
                  <span className="ml-1 tabular-nums text-slate-500">
                    {formatPhaseTimer(totalMs)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {total > 0 && (
          <span className="text-xs font-medium text-slate-500">
            {done} of {total} complete
          </span>
        )}
      </div>

      {activeTab === "elapsed" ? (
        <ProjectElapsedTimePanel
          phaseTimes={phaseTimes}
          totalMs={totalMs}
          timelineMs={timelineMs}
          hasRunningTimer={hasRunningTimer}
          hasTimeline={hasTimeline}
        />
      ) : (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {PHASE_DEFS.map((phaseDef) => {
          const phase = phases[phaseDef.id];
          const group = groups.find((g) => g.id === phaseDef.id);
          const tasks = group?.tasks ?? phase.tasks ?? [];
          const completion = phase?.completion ?? 0;
          const buttonState = getPhaseButtonState(phase, tasks);
          const isOnHold = buttonState.onHoldActive;
          const phaseReadyForTasks = !isOnHold && !buttonState.completedActive;
          const theme = themeFromStageColor(isOnHold ? "#ef4444" : stageColor);

          const barColor = isOnHold
            ? "#ef4444"
            : buttonState.completedActive
              ? "#059669"
              : buttonState.inProgressActive
                ? "#2563eb"
                : stageColor;

          return (
            <PhaseDeckCard
              key={phaseDef.id}
              phaseDef={phaseDef}
              phase={phase}
              tasks={tasks}
              completion={completion}
              buttonState={buttonState}
              isOnHold={isOnHold}
              phaseReadyForTasks={phaseReadyForTasks}
              theme={theme}
              barColor={barColor}
              now={now}
              canTogglePause={!!onUpdate}
              onTogglePause={() => handleTogglePause(phaseDef.id)}
              onStatus={onUpdate ? (status) => handleStatus(phaseDef.id, status) : undefined}
              onPlayTask={onUpdate ? (taskId) => handlePlayTask(phaseDef.id, taskId) : undefined}
              onCompleteTask={onUpdate ? (taskId) => handleCompleteTask(phaseDef.id, taskId) : undefined}
              onUncompleteTask={onUpdate ? (taskId) => handleUncompleteTask(phaseDef.id, taskId) : undefined}
              onShowDetails={setTaskTooltip}
              onHideDetails={() => setTaskTooltip(null)}
              actionsDisabled={!onUpdate}
              zebraTaskRows={zebraTaskRows}
            />
          );
        })}
      </div>
      )}
    </div>
  );
}
