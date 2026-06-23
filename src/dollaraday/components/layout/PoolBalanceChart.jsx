import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { formatPoolCurrency } from "../../data/mockData";
import { useLocale } from "../../i18n/LocaleContext";
import { useLocalizedData } from "../../i18n/localizedData";
import { usePoolState } from "../../lib/poolState";

function formatAxisValue(value) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${value}`;
}

function BalanceTooltip({ active, payload, label, t }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const value = point.balance;
  const prev = point.prevBalance;
  const delta = prev != null ? value - prev : null;

  return (
    <div className="rounded-lg border border-white/10 bg-dda-bg/95 px-3 py-2.5 text-xs shadow-xl">
      <p className="font-medium text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-bold tabular-nums text-white">
        {formatPoolCurrency(value)}
      </p>
      {delta != null ? (
        <p className={cn("mt-1 tabular-nums", delta >= 0 ? "text-dda-green-light" : "text-red-400")}>
          {t("pool.vsPriorDelta", {
            delta: `${delta >= 0 ? "+" : ""}${formatPoolCurrency(delta)}`,
          })}
        </p>
      ) : null}
    </div>
  );
}

export default function PoolBalanceChart() {
  const { t } = useLocale();
  const { poolBalanceIntervals } = useLocalizedData();
  const [interval, setInterval] = useState("1m");
  const { poolBalanceHistory, poolSummary } = usePoolState();

  const chartData = useMemo(() => {
    const points = poolBalanceHistory[interval] ?? [];
    return points.map((point, index) => ({
      ...point,
      prevBalance: index > 0 ? points[index - 1].balance : null,
    }));
  }, [interval, poolBalanceHistory]);

  const periodDelta = useMemo(() => {
    if (chartData.length < 2) return null;
    const first = chartData[0].balance;
    const last = chartData[chartData.length - 1].balance;
    const change = last - first;
    const pct = first ? (change / first) * 100 : 0;
    return { change, pct };
  }, [chartData]);

  const yDomain = useMemo(() => {
    const values = chartData.map((point) => point.balance);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = (max - min) * 0.12 || max * 0.02;
    return [Math.floor(min - padding), Math.ceil(max + padding)];
  }, [chartData]);

  return (
    <div className="dda-panel rounded-xl p-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-white">{t("pool.balanceTrend")}</p>
          {periodDelta ? (
            <p className="mt-0.5 text-xs text-gray-500">
              <span className={periodDelta.change >= 0 ? "text-dda-green-light" : "text-red-400"}>
                {periodDelta.change >= 0 ? "+" : ""}
                {formatPoolCurrency(periodDelta.change)}
              </span>{" "}
              ({periodDelta.pct >= 0 ? "+" : ""}
              {periodDelta.pct.toFixed(2)}%) {t("pool.inRange")}
            </p>
          ) : null}
        </div>

        <div className="flex gap-1 rounded-lg bg-black/30 p-1">
          {poolBalanceIntervals.map((item) => {
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
          <LineChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
            <defs>
              <linearGradient id="poolLineGlow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-dda-green-light)" stopOpacity={0.2} />
                <stop offset="100%" stopColor="var(--color-dda-green-light)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              stroke="rgba(255,255,255,0.06)"
              strokeDasharray="4 4"
              vertical={false}
            />
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
              width={52}
              tick={{ fontSize: 10, fill: "#6b7280", fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={formatAxisValue}
            />
            <Tooltip
              content={<BalanceTooltip t={t} />}
              cursor={{ stroke: "rgba(52, 211, 153, 0.35)", strokeWidth: 1 }}
            />
            <Line
              type="monotone"
              dataKey="balance"
              stroke="var(--color-dda-green-light)"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "#071013", stroke: "var(--color-dda-green-light)", strokeWidth: 2 }}
              activeDot={{ r: 5, fill: "var(--color-dda-green-light)", stroke: "#071013", strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3 text-[11px] text-gray-500">
        <span>{t("pool.currentBalance", { amount: formatPoolCurrency(poolSummary.totalBalance) })}</span>
        <span className="text-gray-600">{t("pool.hoverHint")}</span>
      </div>
    </div>
  );
}
