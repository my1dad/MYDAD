import { useEffect, useMemo, useState } from "react";
import { BarChart3, Clock } from "lucide-react";
import {
  PHASE_THEMES,
  formatLogDateTime,
  formatPhaseTimer,
  getProjectTaskProgressLog,
  projectTaskLogHasLiveEntry,
} from "../../lib/projectUtils";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

const ON_HOLD_THEME = {
  color: "#b91c1c",
  bg: "#fef2f2",
  border: "#fca5a5",
  bar: "#ef4444",
};

const STATUS_STYLES = {
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  in_progress: "bg-indigo-50 text-indigo-700 ring-indigo-100",
  on_hold: "bg-red-50 text-red-700 ring-red-200",
  not_started: "bg-slate-100 text-slate-600 ring-slate-200",
};

function getEntryStatus(entry) {
  if (entry.completed) return "completed";
  if (entry.phaseStatus === "on_hold") return "on_hold";
  if (entry.inProgress) return "in_progress";
  if (entry.startedAt) return "in_progress";
  return "not_started";
}

function getStatusLabel(status) {
  if (status === "completed") return "Complete";
  if (status === "in_progress") return "In progress";
  if (status === "on_hold") return "On hold";
  return "Not started";
}

export default function ProjectTaskProgressLog({ project }) {
  const [now, setNow] = useState(() => Date.now());
  const hasLiveEntry = useMemo(() => projectTaskLogHasLiveEntry(project, now), [project, now]);

  useEffect(() => {
    if (!hasLiveEntry) {
      setNow(Date.now());
      return undefined;
    }
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [hasLiveEntry, project]);

  const entries = useMemo(
    () => getProjectTaskProgressLog(project, now),
    [project, now]
  );

  const summary = useMemo(() => {
    const completed = entries.filter((entry) => entry.completed).length;
    const inProgress = entries.filter((entry) => getEntryStatus(entry) === "in_progress").length;
    const totalElapsedMs = entries.reduce((sum, entry) => sum + entry.elapsedMs, 0);
    return { completed, inProgress, total: entries.length, totalElapsedMs };
  }, [entries]);

  if (entries.length === 0) return null;

  return (
    <section className="mt-5 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100/80">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-tight text-slate-900">
              Task & Phase Progress Log
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Start, finish, and elapsed time for each task across all phases.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tasks done</p>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-900">
              {summary.completed}/{summary.total}
            </p>
          </div>
          <div className="rounded-lg bg-indigo-50/70 px-3 py-2 ring-1 ring-indigo-100">
            <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">In progress</p>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-indigo-700">{summary.inProgress}</p>
          </div>
          <div className="rounded-lg bg-violet-50/70 px-3 py-2 ring-1 ring-violet-100">
            <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-violet-500">
              <Clock className="h-3 w-3" />
              Total elapsed
            </p>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-violet-700">
              {formatPhaseTimer(summary.totalElapsedMs)}
              {hasLiveEntry && (
                <span className="ml-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-violet-500 align-middle" />
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/80">
        <div className="hidden grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,0.8fr)] gap-3 border-b border-slate-200 bg-slate-50/90 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:grid">
          <span>Phase</span>
          <span>Task</span>
          <span>Started</span>
          <span>Finished</span>
          <span>Elapsed</span>
          <span>Status</span>
        </div>

        <ul>
          {entries.map((entry, index) => {
            const status = getEntryStatus(entry);
            const isOnHold = entry.phaseStatus === "on_hold";
            const theme = isOnHold
              ? ON_HOLD_THEME
              : (PHASE_THEMES[entry.phaseId] ?? PHASE_THEMES.foundation);
            const phaseRowIndex = entries
              .slice(0, index)
              .filter((item) => item.phaseId === entry.phaseId).length;
            const isEven = phaseRowIndex % 2 === 0;

            return (
              <li
                key={`${entry.phaseId}-${entry.taskId}`}
                className={cn(
                  "relative overflow-hidden transition-colors",
                  isOnHold && "ring-1 ring-inset ring-red-200/80",
                  !isOnHold &&
                    entry.isActive &&
                    entry.inProgress &&
                    "ring-1 ring-inset ring-indigo-300/80"
                )}
              >
                <div
                  aria-hidden
                  className="absolute inset-0"
                  style={{ backgroundColor: theme.bg }}
                />
                <div
                  aria-hidden
                  className={cn(
                    "absolute inset-0",
                    isOnHold
                      ? isEven
                        ? "bg-white/40"
                        : "bg-red-900/[0.04]"
                      : isEven
                        ? "bg-white/35"
                        : "bg-black/[0.045]"
                  )}
                />
                <div className="relative px-4 py-3">
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,0.8fr)] sm:items-center sm:gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:hidden">
                      Phase
                    </p>
                    <p
                      className={cn(
                        "flex items-center gap-1.5 text-xs font-semibold",
                        isOnHold ? "text-red-800" : "text-slate-800"
                      )}
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: theme.color }}
                      />
                      <span className="truncate">{entry.phaseLabel}</span>
                    </p>
                    <p className="mt-0.5 text-[10px] tabular-nums text-slate-400 sm:hidden">
                      Phase time: {formatPhaseTimer(entry.phaseElapsedMs)}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:hidden">
                      Task
                    </p>
                    <p
                      className={cn(
                        "truncate text-xs font-medium",
                        entry.completed ? "text-slate-500 line-through" : "text-slate-900"
                      )}
                    >
                      {entry.taskTitle}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:hidden">
                      Started
                    </p>
                    <p className="text-xs tabular-nums text-slate-600">
                      {formatLogDateTime(entry.startedAt) ?? "—"}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:hidden">
                      Finished
                    </p>
                    <p className="text-xs tabular-nums text-slate-600">
                      {formatLogDateTime(entry.completedAt) ?? "—"}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:hidden">
                      Elapsed
                    </p>
                    <p className="text-xs font-bold tabular-nums text-slate-800">
                      {formatPhaseTimer(entry.elapsedMs)}
                      {entry.inProgress && (
                        <span className="ml-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-500 align-middle" />
                      )}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:hidden">
                      Status
                    </p>
                    <span
                      className={cn(
                        "inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset",
                        STATUS_STYLES[status]
                      )}
                    >
                      {getStatusLabel(status)}
                    </span>
                  </div>
                </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
