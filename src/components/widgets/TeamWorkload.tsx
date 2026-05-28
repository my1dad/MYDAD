import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/Card";
import { workloadData } from "@/data/mockData";

export function TeamWorkload() {
  return (
    <Card
      title="Team Workload"
      action={
        <span className="text-[10px] font-medium text-emerald-600">+12% vs last week</span>
      }
    >
      <div className="mb-2 flex items-baseline justify-between">
        <div>
          <p className="text-2xl font-bold text-slate-900">196h</p>
          <p className="text-[10px] text-slate-500">Total hours this week</p>
        </div>
      </div>
      <div className="h-24 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={workloadData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="workloadGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: "#94a3b8" }}
            />
            <YAxis hide domain={[0, 50]} />
            <Tooltip
              contentStyle={{
                fontSize: 11,
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)",
              }}
              formatter={(value: number) => [`${value}h`, "Hours"]}
            />
            <Area
              type="monotone"
              dataKey="hours"
              stroke="#8b5cf6"
              strokeWidth={2}
              fill="url(#workloadGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
