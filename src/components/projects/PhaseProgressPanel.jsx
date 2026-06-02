import { CheckCircle2, FastForward } from "lucide-react";
import {
  PHASE_DEFS,
  STATUS_LABELS,
  calcProgress,
  completeProject,
  advanceProjectPhase,
  getPhaseTitle,
  isProjectTasksComplete,
  updateProjectPhase,
} from "../../lib/projectUtils";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default function PhaseProgressPanel({ project, onUpdate, compact = false }) {
  const phases = project.phases ?? {};
  const progress = project.progress ?? calcProgress(phases);
  const isComplete = isProjectTasksComplete(project);

  const handlePhaseChange = (phaseId, patch) => {
    onUpdate(updateProjectPhase(project, phaseId, patch));
  };

  const handleAdvance = () => {
    onUpdate(advanceProjectPhase(project));
  };

  const handleCompleteAll = () => {
    onUpdate(completeProject(project));
  };

  return (
    <div className={cn("space-y-4", compact ? "" : "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm")}>
      {!compact && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Roadmap Progression</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Update phase completion to drive roadmap progress
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-slate-900">{progress}%</p>
            <p className="text-xs text-slate-500">Overall</p>
          </div>
        </div>
      )}

      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-indigo-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className={cn("grid gap-3", compact ? "grid-cols-1" : "sm:grid-cols-2 lg:grid-cols-4")}>
        {PHASE_DEFS.map((phaseDef) => {
          const phase = phases[phaseDef.id] ?? { completion: 0, status: "not_started" };
          const completion = phase.completion ?? 0;

          return (
            <div
              key={phaseDef.id}
              className={cn(
                "rounded-xl border p-3 transition-colors",
                completion >= 100
                  ? "border-emerald-200 bg-emerald-50/50"
                  : completion > 0
                    ? "border-indigo-200 bg-indigo-50/30"
                    : "border-slate-100 bg-slate-50/50"
              )}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-slate-800">
                  {getPhaseTitle(phaseDef.id, phases)}
                </h3>
                <span className="text-xs font-bold text-indigo-600">{completion}%</span>
              </div>

              <select
                value={phase.status ?? "not_started"}
                onChange={(e) =>
                  handlePhaseChange(phaseDef.id, { status: e.target.value })
                }
                className="mb-2 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-700"
              >
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>

              <input
                type="range"
                min={0}
                max={100}
                value={completion}
                onChange={(e) =>
                  handlePhaseChange(phaseDef.id, {
                    completion: Number(e.target.value),
                  })
                }
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-indigo-600"
                aria-label={`${getPhaseTitle(phaseDef.id, phases)} completion`}
              />
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleAdvance}
          disabled={isComplete}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FastForward className="h-3.5 w-3.5" />
          Complete Current Phase
        </button>
        <button
          type="button"
          onClick={handleCompleteAll}
          disabled={isComplete}
          className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Mark Project Complete
        </button>
        {isComplete && (
          <span className="flex items-center gap-1 rounded-lg bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Project completed
          </span>
        )}
      </div>
    </div>
  );
}
