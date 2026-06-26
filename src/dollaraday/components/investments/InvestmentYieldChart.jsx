import { useMemo, useState, useSyncExternalStore } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { investmentIntervals } from "../../data/mockData";
import {
  buildCombinedYieldTrendHistory,
  getYieldTrendRevision,
  subscribeYieldTrend,
} from "../../lib/allocationSleeves";
import { useAllocationPositions } from "../../lib/allocationPositions";
import { useLocale } from "../../i18n/LocaleContext";

function useYieldTrendRevision() {
  return useSyncExternalStore(subscribeYieldTrend, getYieldTrendRevision, () => "");
}

const SLEEVE_SERIES = [
  { key: "treasury", color: "#86efac" },
  { key: "bonds", color: "#c4b5fd" },
  { key: "stocks", color: "#93c5fd" },
];

function YieldTrendTooltip({ active, payload, label, seriesLabels }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-white/10 bg-dda-bg/95 px-3 py-2.5 text-xs shadow-xl">
      <p className="font-medium text-gray-400">{label}</p>
      <ul className="mt-2 space-y-1">
        {payload.map((entry) => (
          <li key={entry.dataKey} className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 text-gray-400">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              {seriesLabels[entry.dataKey]}
            </span>
            <span className="font-semibold tabular-nums text-white">
              {Number(entry.value).toFixed(2)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChartLegend({ payload, seriesLabels }) {
  if (!payload?.length) return null;

  return (
    <ul className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
      {payload.map((entry) => (
        <li key={entry.value} className="inline-flex items-center gap-1.5 text-[11px] text-gray-400">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          {seriesLabels[entry.value]}
        </li>
      ))}
    </ul>
  );
}

export default function InvestmentYieldChart({ investments, blendedApy }) {
  const { t } = useLocale();
  const [interval, setInterval] = useState("1m");
  const positions = useAllocationPositions();
  const yieldTrendRevision = useYieldTrendRevision();

  const seriesLabels = useMemo(
    () =>
      Object.fromEntries(
        SLEEVE_SERIES.map(({ key }) => [
          key,
          investments.find((item) => item.key === key)?.name ?? key,
        ]),
      ),
    [investments],
  );

  const chartData = useMemo(
    () => buildCombinedYieldTrendHistory(interval, positions),
    [interval, positions, yieldTrendRevision],
  );

  const yDomain = useMemo(() => {
    const values = chartData.flatMap((point) =>
      SLEEVE_SERIES.map(({ key }) => point[key]),
    );
    if (!values.length) return [0, 1];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = (max - min) * 0.25 || 0.5;
    return [Number((min - padding).toFixed(2)), Number((max + padding).toFixed(2))];
  }, [chartData]);

  const currentBySleeve = useMemo(() => {
    const lastPoint = chartData[chartData.length - 1];
    return Object.fromEntries(
      SLEEVE_SERIES.map(({ key }) => [key, lastPoint?.[key] ?? 0]),
    );
  }, [chartData]);

  return (
    <div className="dda-panel rounded-xl p-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-white">{t("pages.investments.yieldTrend")}</p>
          <p className="mt-0.5 text-xs text-gray-500">{t("pages.investments.yieldTrendSub")}</p>
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
                    ? "bg-dda-green-light/15 text-dda-green-light shadow-sm"
                    : "text-gray-400 hover:text-white",
                )}
              >
                {t(`pages.investments.yieldInterval${item.id}`)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-52 w-full sm:h-60">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
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
              content={<YieldTrendTooltip seriesLabels={seriesLabels} />}
              cursor={{ stroke: "rgba(255,255,255,0.12)", strokeWidth: 1 }}
            />
            <Legend content={<ChartLegend seriesLabels={seriesLabels} />} />
            {SLEEVE_SERIES.map(({ key, color }) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                name={key}
                stroke={color}
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#071013", stroke: color, strokeWidth: 2 }}
                activeDot={{ r: 5, fill: color, stroke: "#071013", strokeWidth: 2 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3 text-[11px] text-gray-500">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {SLEEVE_SERIES.map(({ key, color }) => (
            <span key={key} className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
              <span>{seriesLabels[key]}:</span>
              <span className="font-semibold tabular-nums text-white">
                {currentBySleeve[key]}%
              </span>
            </span>
          ))}
        </div>
        <span className="text-gray-600">
          {t("pages.investments.yieldTrendBlended", { apy: blendedApy })}
        </span>
      </div>
    </div>
  );
}
