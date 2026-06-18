import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { investmentIntervals, investmentYieldHistory } from "../../data/mockData";

function YieldTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const prev = point.prevApy;
  const delta = prev != null ? point.apy - prev : null;

  return (
    <div className="rounded-lg border border-white/10 bg-[#071013]/95 px-3 py-2.5 text-xs shadow-xl">
      <p className="font-medium text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-bold tabular-nums text-white">{point.apy.toFixed(2)}% APY</p>
      {delta != null ? (
        <p className={cn("mt-1 tabular-nums", delta >= 0 ? "text-emerald-400" : "text-red-400")}>
          {delta >= 0 ? "+" : ""}
          {delta.toFixed(2)}% vs prior
        </p>
      ) : null}
    </div>
  );
}

export default function InvestmentYieldChart({ selectedInvestment, blendedApy }) {
  const [interval, setInterval] = useState("1m");

  const chartData = useMemo(() => {
    const base = investmentYieldHistory[interval] ?? [];
    const yieldOffset = (selectedInvestment.returnPct - blendedApy) * 0.35;
    return base.map((point, index) => ({
      ...point,
      apy: Number((point.apy + yieldOffset).toFixed(2)),
      prevApy: index > 0 ? Number((base[index - 1].apy + yieldOffset).toFixed(2)) : null,
    }));
  }, [interval, selectedInvestment.returnPct, blendedApy]);

  const periodDelta = useMemo(() => {
    if (chartData.length < 2) return null;
    const first = chartData[0].apy;
    const last = chartData[chartData.length - 1].apy;
    return { change: last - first, pct: first ? ((last - first) / first) * 100 : 0 };
  }, [chartData]);

  const yDomain = useMemo(() => {
    const values = chartData.map((point) => point.apy);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = (max - min) * 0.25 || 0.2;
    return [Number((min - padding).toFixed(2)), Number((max + padding).toFixed(2))];
  }, [chartData]);

  return (
    <div className="dda-panel rounded-xl p-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-white">Yield trend · {selectedInvestment.name}</p>
          {periodDelta ? (
            <p className="mt-0.5 text-xs text-gray-500">
              <span className={periodDelta.change >= 0 ? "text-emerald-400" : "text-red-400"}>
                {periodDelta.change >= 0 ? "+" : ""}
                {periodDelta.change.toFixed(2)}%
              </span>{" "}
              ({periodDelta.pct >= 0 ? "+" : ""}
              {periodDelta.pct.toFixed(2)}%) in selected range
            </p>
          ) : null}
        </div>

        <div className="flex gap-1 rounded-lg bg-black/30 p-1">
          {investmentIntervals.map((item) => {
            const active = interval === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setInterval(item.id)}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition sm:px-3 sm:text-xs",
                  active
                    ? "bg-emerald-400/15 text-emerald-400 shadow-sm"
                    : "text-gray-400 hover:text-white"
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-48 w-full sm:h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
            <defs>
              <linearGradient id="yieldAreaGlow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={selectedInvestment.color} stopOpacity={0.28} />
                <stop offset="100%" stopColor={selectedInvestment.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "#6b7280", fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
              dy={6}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              domain={yDomain}
              width={42}
              tick={{ fontSize: 10, fill: "#6b7280", fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip
              content={<YieldTooltip />}
              cursor={{ stroke: "rgba(52, 211, 153, 0.35)", strokeWidth: 1 }}
            />
            <Area
              type="monotone"
              dataKey="apy"
              stroke="none"
              fill="url(#yieldAreaGlow)"
            />
            <Line
              type="monotone"
              dataKey="apy"
              stroke={selectedInvestment.color}
              strokeWidth={2.5}
              dot={{ r: 3, fill: "#071013", stroke: selectedInvestment.color, strokeWidth: 2 }}
              activeDot={{ r: 5, fill: selectedInvestment.color, stroke: "#071013", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3 text-[11px] text-gray-500">
        <span>
          Current sleeve APY:{" "}
          <span className="font-semibold text-emerald-400">{selectedInvestment.returnPct}%</span>
        </span>
        <span className="text-gray-600">Interactive range · hover for detail</span>
      </div>
    </div>
  );
}
