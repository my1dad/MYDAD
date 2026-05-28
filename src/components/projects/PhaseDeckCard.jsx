import { useEffect, useState } from "react";
import { Check, Layers, Link2, Pause, Play, Rocket, TrendingUp } from "lucide-react";
import RoadmapProgressBar from "../roadmap/RoadmapProgressBar";
import { PHASE_THEMES } from "../../lib/projectUtils";
import {
  formatPhaseTimer,
  getPhaseTotalElapsedMs,
  getTaskElapsedMs,
  getTaskRowControlMode,
  phaseElapsedIsVisible,
  phaseHasActiveElapsedClock,
  taskTimerIsRunning,
} from "../../lib/projectUtils";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

const PHASE_ICONS = {
  foundation: Rocket,
  core: Layers,
  integrations: Link2,
  scale: TrendingUp,
};

const PHASE_NUMBERS = {
  foundation: "01",
  core: "02",
  integrations: "03",
  scale: "04",
};

function DeckKey({ label, active, tone = "default", disabled, onClick, className }) {
  const tones = {
    default: {
      active: "border-slate-400 bg-gradient-to-b from-white to-slate-100 text-slate-900 shadow-[0_4px_0_#cbd5e1,inset_0_1px_0_rgba(255,255,255,0.9)]",
      idle: "border-slate-200/90 bg-gradient-to-b from-slate-50 to-slate-100 text-slate-500 shadow-[0_3px_0_#e2e8f0,inset_0_1px_0_rgba(255,255,255,0.8)] hover:from-white hover:to-slate-50 hover:text-slate-700",
    },
    prog: {
      active:
        "border-blue-400 bg-gradient-to-b from-blue-50 to-blue-100 text-blue-800 shadow-[0_0_6px_rgba(59,130,246,0.2),0_4px_0_#2563eb,inset_0_1px_0_rgba(255,255,255,0.9)]",
      idle: "border-slate-200/90 bg-gradient-to-b from-slate-50 to-slate-100 text-slate-500 shadow-[0_3px_0_#e2e8f0,inset_0_1px_0_rgba(255,255,255,0.8)] hover:from-blue-50/80 hover:to-blue-100/50 hover:text-blue-700",
    },
    done: {
      active:
        "border-emerald-400 bg-gradient-to-b from-emerald-50 to-emerald-100 text-emerald-800 shadow-[0_0_6px_rgba(16,185,129,0.18),0_4px_0_#059669,inset_0_1px_0_rgba(255,255,255,0.9)]",
      idle: "border-slate-200/90 bg-gradient-to-b from-slate-50 to-slate-100 text-slate-500 shadow-[0_3px_0_#e2e8f0,inset_0_1px_0_rgba(255,255,255,0.8)] hover:from-emerald-50/80 hover:to-emerald-100/40 hover:text-emerald-700",
    },
    hold: {
      active:
        "border-red-400 bg-gradient-to-b from-red-50 to-red-100 text-red-800 shadow-[0_0_6px_rgba(239,68,68,0.18),0_4px_0_#dc2626,inset_0_1px_0_rgba(255,255,255,0.9)]",
      idle: "border-slate-200/90 bg-gradient-to-b from-slate-50 to-slate-100 text-slate-500 shadow-[0_3px_0_#e2e8f0,inset_0_1px_0_rgba(255,255,255,0.8)] hover:from-red-50/80 hover:to-red-100/40 hover:text-red-700",
    },
  };

  const palette = tones[tone] ?? tones.default;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "min-h-[2.25rem] flex-1 rounded-lg border px-1 py-2 text-[10px] font-extrabold uppercase tracking-[0.14em] transition-all duration-150 active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:opacity-40",
        active ? palette.active : palette.idle,
        className
      )}
    >
      {label}
    </button>
  );
}

function PhaseTaskRow({
  task,
  tasks,
  index,
  activeTaskId,
  barColor,
  disabled,
  elapsedMs,
  phaseReady,
  isActive,
  zebraRow,
  onPlay,
  onComplete,
  onUncomplete,
  onShowDetails,
  onHideDetails,
}) {
  const isRunning = taskTimerIsRunning(task);
  const controlMode = getTaskRowControlMode(task, tasks, index, activeTaskId);

  return (
    <li>
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg px-2 py-2",
          zebraRow
            ? cn(index % 2 === 0 ? "bg-white/90" : "bg-slate-100/90", isActive && "ring-1 ring-inset ring-blue-300/80")
            : isActive && "bg-white/60",
          disabled && "opacity-70"
        )}
        onMouseEnter={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const phaseCard = event.currentTarget.closest("[data-phase-card]");
          const cardRect = phaseCard?.getBoundingClientRect() ?? null;
          onShowDetails({
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
            cardRect,
            task,
          });
        }}
        onMouseLeave={onHideDetails}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center">
          {controlMode === "play" && (
            <button
              type="button"
              disabled={disabled || !phaseReady}
              onClick={(e) => {
                e.stopPropagation();
                onPlay?.();
              }}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-gradient-to-b from-slate-800 to-slate-900 text-white shadow-[0_3px_0_#0f172a,inset_0_1px_0_rgba(255,255,255,0.15)] transition hover:brightness-110 active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:opacity-35"
              aria-label={`Start: ${task.title || "Untitled"}`}
            >
              <Play className="h-3.5 w-3.5 fill-current" strokeWidth={0} />
            </button>
          )}
          {controlMode === "complete" && (
            <button
              type="button"
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation();
                onComplete?.();
              }}
              className="flex h-9 w-9 items-center justify-center rounded-lg border-2 bg-white shadow-[0_2px_0_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.9)] transition hover:bg-slate-50 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-35"
              style={{ borderColor: disabled ? undefined : barColor }}
              aria-label={`Complete: ${task.title || "Untitled"}`}
            />
          )}
          {controlMode === "completed" && (
            <button
              type="button"
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation();
                onUncomplete?.();
              }}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-500 bg-gradient-to-b from-emerald-500 to-emerald-600 text-white shadow-[0_3px_0_#047857,inset_0_1px_0_rgba(255,255,255,0.2)] transition hover:brightness-110 active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:opacity-35"
              aria-label={`Reopen: ${task.title || "Untitled"}`}
            >
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
          )}
          {controlMode === "waiting" && (
            <span
              className="h-9 w-9 rounded-lg border border-dashed border-slate-300/80 bg-slate-200/40"
              aria-hidden
            />
          )}
        </div>

        <span
          className={cn(
            "min-w-0 flex-1 text-xs leading-snug",
            task.completed ? "text-slate-400 line-through" : "font-semibold text-slate-800"
          )}
        >
          {task.title || "Untitled"}
        </span>

        {(elapsedMs > 0 || isRunning) && (
          <span
            className={cn(
              "shrink-0 rounded-md bg-slate-900/90 px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums text-emerald-300",
              isRunning && "animate-pulse"
            )}
          >
            {formatPhaseTimer(elapsedMs)}
          </span>
        )}
      </div>
    </li>
  );
}

export default function PhaseDeckCard({
  phaseDef,
  phase,
  tasks,
  completion,
  buttonState,
  isOnHold,
  phaseReadyForTasks,
  theme,
  barColor,
  now,
  canTogglePause,
  onTogglePause,
  onStatus,
  onPlayTask,
  onCompleteTask,
  onUncompleteTask,
  onShowDetails,
  onHideDetails,
  actionsDisabled = false,
  zebraTaskRows = false,
}) {
  const phaseTheme = PHASE_THEMES[phaseDef.id] ?? PHASE_THEMES.foundation;
  const PhaseIcon = PHASE_ICONS[phaseDef.id] ?? Layers;
  const phaseNumber = PHASE_NUMBERS[phaseDef.id] ?? "00";

  const phaseClockActive = phaseHasActiveElapsedClock(phase);
  const taskRunning = tasks.some((t) => taskTimerIsRunning(t));
  const timerRunning = phaseClockActive || taskRunning;
  const isManuallyPaused = !!phase.timerManuallyPaused;
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!timerRunning) return undefined;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [timerRunning, phase.timerStartedAt, tasks]);

  const showTimer = phaseElapsedIsVisible(phase, now);
  const elapsed = getPhaseTotalElapsedMs(phase, now);
  const showPause = canTogglePause && phase.jobSessionActive && !isOnHold;

  const outerShadow = isOnHold
    ? "0 0 0 1px rgba(252, 165, 165, 0.55), 0 6px 18px rgba(239, 68, 68, 0.08)"
    : buttonState.inProgressActive
      ? `0 0 0 1px rgba(148, 163, 184, 0.35), 0 6px 20px ${theme.glow ?? "rgba(59, 130, 246, 0.12)"}`
      : buttonState.completedActive
        ? "0 0 0 1px rgba(167, 243, 208, 0.55), 0 6px 18px rgba(16, 185, 129, 0.08)"
        : "0 4px 18px rgba(15, 23, 42, 0.07)";

  const iconGlow = buttonState.inProgressActive
    ? `0 0 8px ${phaseTheme.color}44`
    : buttonState.completedActive
      ? "0 0 6px rgba(16, 185, 129, 0.2)"
      : isOnHold
        ? "0 0 6px rgba(239, 68, 68, 0.18)"
        : undefined;

  return (
    <div
      data-phase-card
      className={cn(
        "flex min-h-[280px] flex-col rounded-2xl border bg-gradient-to-b p-[3px] transition-all duration-300",
        isOnHold ? "border-red-200 from-red-100/40 to-red-50/20" : "border-slate-200/90 from-slate-100 to-slate-200/60"
      )}
      style={{ boxShadow: outerShadow }}
    >
      <div
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[13px] border border-white/80 bg-gradient-to-b from-white to-slate-50/90"
        style={{ backgroundColor: isOnHold ? "#fef2f2" : phaseTheme.bg }}
      >
        <div className="border-b border-slate-200/80 px-3 pt-3 pb-2.5">
          <div className="flex items-start gap-2.5">
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-100 shadow-[0_3px_0_#e2e8f0,inset_0_1px_0_rgba(255,255,255,0.95)]",
                buttonState.inProgressActive && "ring-1 ring-blue-300/35"
              )}
              style={{ boxShadow: iconGlow ? `${iconGlow}, 0 3px 0 #e2e8f0` : undefined }}
            >
              <PhaseIcon className="h-5 w-5" style={{ color: phaseTheme.color }} strokeWidth={2.25} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                  Phase {phaseNumber}
                </p>
                <span className="text-lg font-bold tabular-nums text-slate-900">{completion}%</span>
              </div>
              <h3 className="text-sm font-bold leading-tight text-slate-900">{phaseDef.shortLabel}</h3>
              <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                {tasks.length > 0
                  ? `${buttonState.taskDone}/${buttonState.taskTotal} tasks`
                  : "No tasks"}
              </p>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            <RoadmapProgressBar
              progress={completion}
              color={barColor}
              showBadge
              heightClass="h-8"
              variant="heatmap"
            />
            <RoadmapProgressBar
              progress={completion}
              color={barColor}
              showBadge={false}
              heightClass="h-3"
              variant="classic"
            />
          </div>
        </div>

        {showTimer && (
          <div className="mx-3 mb-2 flex items-center gap-2 rounded-lg border border-slate-700/20 bg-gradient-to-b from-slate-800 to-slate-900 px-2.5 py-1.5 shadow-inner">
            {showPause && (
              <button
                type="button"
                onClick={onTogglePause}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-600 bg-slate-700 text-slate-100 shadow-[0_2px_0_#0f172a] transition hover:bg-slate-600 active:translate-y-px"
                aria-label={isManuallyPaused ? "Resume timer" : "Pause timer"}
              >
                {isManuallyPaused ? (
                  <Play className="h-3 w-3 fill-current" />
                ) : (
                  <Pause className="h-3 w-3 fill-current" />
                )}
              </button>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">Elapsed</p>
              <p
                className={cn(
                  "font-mono text-sm font-bold tabular-nums tracking-wide",
                  isOnHold ? "text-red-300" : "text-emerald-300",
                  timerRunning && !isManuallyPaused && "animate-pulse"
                )}
              >
                {formatPhaseTimer(elapsed)}
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-1.5 px-3 pb-2">
          <DeckKey
            label="In Prog"
            tone="prog"
            active={buttonState.inProgressActive}
            disabled={!onStatus || isOnHold || buttonState.completedActive}
            onClick={() => onStatus?.("in_progress")}
          />
          <DeckKey
            label="Done"
            tone="done"
            active={buttonState.completedActive}
            disabled={!onStatus}
            onClick={() => onStatus?.("completed")}
          />
          <DeckKey
            label={buttonState.onHoldActive ? "Resume" : "Hold"}
            tone="hold"
            active={buttonState.onHoldActive}
            disabled={!onStatus}
            onClick={() => onStatus?.("on_hold")}
          />
        </div>

        {tasks.length > 0 ? (
          <div className="mx-3 mb-3 min-h-0 flex-1 rounded-xl border border-slate-200/90 bg-gradient-to-b from-slate-100/90 to-slate-200/50 p-1.5 shadow-inner">
            <ul className="max-h-[168px] space-y-1 overflow-y-auto">
              {tasks.map((task, index) => (
                <PhaseTaskRow
                  key={task.id}
                  task={task}
                  tasks={tasks}
                  index={index}
                  activeTaskId={phase.activeTaskId}
                  barColor={barColor}
                  elapsedMs={getTaskElapsedMs(task, now)}
                  isActive={phase.activeTaskId === task.id}
                  phaseReady={phaseReadyForTasks}
                  zebraRow={zebraTaskRows}
                  disabled={actionsDisabled}
                  onPlay={() => onPlayTask?.(task.id)}
                  onComplete={() => onCompleteTask?.(task.id)}
                  onUncomplete={() => onUncompleteTask?.(task.id)}
                  onShowDetails={onShowDetails}
                  onHideDetails={onHideDetails}
                />
              ))}
            </ul>
          </div>
        ) : (
          <p className="mx-3 mb-4 text-center text-[11px] text-slate-400">Add tasks in project setup</p>
        )}
      </div>
    </div>
  );
}
