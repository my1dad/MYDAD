import { phases, roadmapProjects } from "@/data/mockData";
import { Card } from "@/components/ui/Card";

function PhaseBar({
  percent,
  color,
  showBadge,
}: {
  percent: number;
  color: string;
  showBadge: boolean;
}) {
  if (percent === 0) {
    return (
      <div className="h-7 w-full rounded-lg border border-dashed border-slate-200 bg-slate-50/80" />
    );
  }

  return (
    <div className="relative h-7 w-full overflow-hidden rounded-lg bg-slate-100">
      <div
        className="absolute inset-y-0 left-0 flex items-center rounded-lg transition-all"
        style={{
          width: `${Math.max(percent, 8)}%`,
          background: `linear-gradient(90deg, ${color}, ${color}dd)`,
        }}
      >
        {showBadge && percent > 0 && (
          <span className="ml-auto mr-1.5 rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 shadow-sm">
            {percent}%
          </span>
        )}
      </div>
    </div>
  );
}

export function GanttChart() {
  return (
    <Card
      title="Product Roadmap"
      className="overflow-hidden"
      action={
        <div className="flex gap-3 text-[10px] text-slate-500">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-violet-500" />
            Active
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full border border-dashed border-slate-300 bg-slate-50" />
            Planned
          </span>
        </div>
      }
    >
      <div className="overflow-x-auto -mx-1 px-1">
        <div className="min-w-[640px]">
          {/* Phase headers */}
          <div className="mb-3 grid grid-cols-[140px_repeat(4,1fr)] gap-3">
            <div />
            {phases.map((phase) => (
              <div key={phase.id} className="text-center">
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                  {phase.label.split(":")[0]}
                </p>
                <p className="text-xs font-semibold text-slate-700">
                  {phase.shortLabel}
                </p>
              </div>
            ))}
          </div>

          {/* Project rows */}
          <div className="space-y-3">
            {roadmapProjects.map((project) => (
              <div
                key={project.id}
                className="grid grid-cols-[140px_repeat(4,1fr)] items-center gap-3"
              >
                <div className="flex items-center gap-2 pr-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: project.color }}
                  />
                  <span className="truncate text-sm font-medium text-slate-800">
                    {project.name}
                  </span>
                </div>
                {project.phases.map((phase) => (
                  <PhaseBar
                    key={phase.phaseId}
                    percent={phase.percent}
                    color={phase.color}
                    showBadge={phase.percent > 0 && phase.percent < 100}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Timeline footer */}
          <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3">
            <span className="text-[10px] text-slate-400">Jan 2026</span>
            <div className="flex flex-1 mx-4 h-1 rounded-full bg-gradient-to-r from-violet-200 via-blue-200 to-violet-200" />
            <span className="text-[10px] text-slate-400">Dec 2026</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
