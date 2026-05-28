import { AlertTriangle, CheckCircle2, Clock, FolderKanban } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { projectSummary } from "@/data/mockData";
import { cn } from "@/lib/utils";

const stats = [
  {
    label: "Total Projects",
    value: projectSummary.total,
    icon: FolderKanban,
    color: "text-violet-600 bg-violet-50",
  },
  {
    label: "On Track",
    value: projectSummary.onTrack,
    icon: CheckCircle2,
    color: "text-emerald-600 bg-emerald-50",
  },
  {
    label: "At Risk",
    value: projectSummary.atRisk,
    icon: AlertTriangle,
    color: "text-amber-600 bg-amber-50",
  },
  {
    label: "Behind",
    value: projectSummary.behind,
    icon: Clock,
    color: "text-red-600 bg-red-50",
  },
];

export function ProjectSummary() {
  return (
    <Card title="Project Summary">
      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3"
            >
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                  stat.color
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-900">{stat.value}</p>
                <p className="text-[10px] font-medium text-slate-500">
                  {stat.label}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
