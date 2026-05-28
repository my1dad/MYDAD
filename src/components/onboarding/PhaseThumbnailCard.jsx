import { Layers, Link2, Rocket, TrendingUp } from "lucide-react";

const PHASE_META = {
  foundation: { icon: Rocket, color: "#4338ca", label: "Phase 1" },
  core: { icon: Layers, color: "#1d4ed8", label: "Phase 2" },
  integrations: { icon: Link2, color: "#6d28d9", label: "Phase 3" },
  scale: { icon: TrendingUp, color: "#047857", label: "Phase 4" },
};

const STATUS_LABELS = {
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
  on_hold: "On Hold",
};

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default function PhaseThumbnailCard({ phase, data, selected, incomplete, onSelect }) {
  const meta = PHASE_META[phase.id] ?? PHASE_META.foundation;
  const Icon = meta.icon;
  const tasks = data.tasks ?? [];
  const attachments = data.attachments?.length ?? 0;
  const status = STATUS_LABELS[data.status] ?? "Not Started";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex min-h-[168px] w-full flex-col rounded-2xl border bg-white p-4 text-left shadow-sm transition",
        selected
          ? "border-indigo-700 ring-2 ring-indigo-300 shadow-md"
          : incomplete
            ? "border-amber-500 hover:border-amber-600 hover:shadow-md"
            : "border-slate-400 hover:border-indigo-600 hover:shadow-md"
      )}
    >
      <div className="flex flex-1 flex-col items-center text-center">
        <div
          className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ backgroundColor: `${meta.color}22`, color: meta.color }}
        >
          <Icon className="h-7 w-7" strokeWidth={2.25} />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-600">
          {meta.label}
        </p>
        <h4 className="mt-0.5 text-sm font-bold leading-tight text-slate-950">{phase.title}</h4>
        <span
          className="mt-2 rounded-full px-2.5 py-0.5 text-[10px] font-bold capitalize text-slate-900"
          style={{ backgroundColor: `${meta.color}18` }}
        >
          {status}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-center gap-3 border-t border-slate-200 pt-3 text-[10px] font-semibold text-slate-700">
        <span className={cn(incomplete && tasks.length === 0 && "font-bold text-amber-700")}>
          {tasks.length} task{tasks.length !== 1 ? "s" : ""}
        </span>
        <span className="h-1 w-1 rounded-full bg-slate-400" />
        <span>{attachments} file{attachments !== 1 ? "s" : ""}</span>
      </div>
    </button>
  );
}
