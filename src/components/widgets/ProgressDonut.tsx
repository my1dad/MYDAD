import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { Card } from "@/components/ui/Card";
import { projectSummary } from "@/data/mockData";

const data = [
  { name: "Complete", value: projectSummary.overallProgress },
  { name: "Remaining", value: 100 - projectSummary.overallProgress },
];

const COLORS = ["#8b5cf6", "#e2e8f0"];

export function ProgressDonut() {
  return (
    <Card title="Overall Progress">
      <div className="relative flex flex-col items-center">
        <div className="h-36 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={62}
                startAngle={90}
                endAngle={-270}
                dataKey="value"
                stroke="none"
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
          <span className="text-2xl font-bold text-slate-900">
            {projectSummary.overallProgress}%
          </span>
          <span className="text-[10px] font-medium text-slate-500">
            On schedule
          </span>
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-slate-500">
        Portfolio completion across all active phases
      </p>
    </Card>
  );
}
