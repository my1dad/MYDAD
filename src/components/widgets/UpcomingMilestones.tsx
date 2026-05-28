import { Flag } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { milestones } from "@/data/mockData";

export function UpcomingMilestones() {
  return (
    <Card title="Upcoming Milestones">
      <ul className="space-y-3">
        {milestones.map((milestone) => (
          <li
            key={milestone.id}
            className="flex items-start gap-3 rounded-xl border border-slate-100 p-3 transition hover:border-violet-100 hover:bg-violet-50/30"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
              <Flag className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800">
                {milestone.title}
              </p>
              <p className="text-[10px] text-slate-500">{milestone.project}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-semibold text-slate-700">
                {milestone.date}
              </p>
              <p className="text-[10px] text-violet-600">
                {milestone.daysAway}d away
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
