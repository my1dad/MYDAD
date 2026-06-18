import { useMemo } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { CircleDollarSign, Shield, TrendingUp, Waves } from "lucide-react";
import { cn } from "@/lib/utils";
import DashboardCard, { ProgressBar } from "../layout/DashboardCard";
import { formatPoolCurrency } from "../../data/mockData";
import { useLocale } from "../../i18n/LocaleContext";

function AllocationTooltip({ active, payload, t }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-lg border border-white/10 bg-[#071013]/95 px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-white">{item.name}</p>
      <p className="mt-0.5 tabular-nums text-emerald-400">{formatPoolCurrency(item.allocated)}</p>
      <p className="mt-0.5 text-gray-500">{t("investmentChart.percentDeployed", { percent: item.percent })}</p>
    </div>
  );
}

const riskStyles = {
  Low: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/25",
  Medium: "bg-amber-500/15 text-amber-400 ring-amber-500/25",
  High: "bg-red-500/15 text-red-400 ring-red-500/25",
};

export default function InvestmentInfographic({
  investments,
  totalAllocated,
  poolApy,
  selectedId,
  onSelect,
}) {
  const { t } = useLocale();
  const selected = investments.find((item) => item.id === selectedId) ?? investments[0];
  const chartData = useMemo(
    () =>
      investments.map((item) => ({
        ...item,
        value: item.allocated,
      })),
    [investments]
  );

  return (
    <DashboardCard noPadding>
      <div className="grid gap-5 p-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-5">
          <div>
            <p className="text-sm text-gray-400">{t("investmentChart.totalDeployed")}</p>
            <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-white sm:text-4xl">
              {formatPoolCurrency(totalAllocated)}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/25">
                <TrendingUp className="h-3.5 w-3.5" />
                {t("investmentChart.blendedApyBadge", { apy: poolApy })}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-xs font-semibold text-gray-300 ring-1 ring-white/10">
                <Shield className="h-3.5 w-3.5 text-sky-400" />
                {t("investmentChart.sleevesBadge", { count: investments.length })}
              </span>
            </div>
          </div>

          <div className="dda-panel rounded-xl p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-white">{t("investmentChart.funnel")}</p>
              <p className="text-xs text-gray-500">{t("investmentChart.tapSegment")}</p>
            </div>

            <div className="flex h-10 overflow-hidden rounded-full ring-1 ring-white/10">
              {investments.map((item) => {
                const active = item.id === selectedId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelect(item.id)}
                    title={item.name}
                    className={cn(
                      "relative min-w-[8%] transition-all duration-300 hover:brightness-110",
                      active && "z-10 ring-2 ring-white/80 ring-offset-2 ring-offset-[#071013]"
                    )}
                    style={{
                      width: `${item.percent}%`,
                      backgroundColor: item.color,
                    }}
                  >
                    {item.percent >= 12 ? (
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-[#071013]/80">
                        {item.percent}%
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 space-y-3">
              {investments.map((item, index) => {
                const active = item.id === selectedId;
                const widthScale = 100 - index * 12;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelect(item.id)}
                    className={cn(
                      "group w-full text-left transition",
                      active ? "opacity-100" : "opacity-80 hover:opacity-100"
                    )}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                      <span className={cn("font-medium", active ? "text-white" : "text-gray-300")}>
                        {item.name}
                      </span>
                      <span className="tabular-nums text-emerald-400">
                        {item.percent}% · {formatPoolCurrency(item.allocated)}
                      </span>
                    </div>
                    <div
                      className="h-8 overflow-hidden rounded-lg bg-white/5 transition-all duration-300"
                      style={{ width: `${widthScale}%` }}
                    >
                      <div
                        className="flex h-full items-center rounded-lg px-3 text-xs font-semibold text-[#071013] transition-all duration-500"
                        style={{
                          width: `${item.percent}%`,
                          backgroundColor: item.color,
                          minWidth: active ? "100%" : undefined,
                        }}
                      >
                        {active ? item.name : null}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="dda-glass rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {t("pages.investments.selectedSleeve")}
                </p>
                <h3 className="mt-1 text-lg font-bold text-white">{selected.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-400">{selected.description}</p>
              </div>
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset"
                style={{
                  backgroundColor: `${selected.color}18`,
                  color: selected.color,
                  boxShadow: `inset 0 0 0 1px ${selected.color}33`,
                }}
              >
                <Waves className="h-5 w-5" strokeWidth={2.25} />
              </span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="dda-panel rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-wide text-gray-500">{t("investmentChart.allocated")}</p>
                <p className="mt-1 text-sm font-bold tabular-nums text-white">
                  {formatPoolCurrency(selected.allocated)}
                </p>
              </div>
              <div className="dda-panel rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-wide text-gray-500">{t("investmentChart.apy")}</p>
                <p className="mt-1 text-sm font-bold tabular-nums text-emerald-400">
                  {selected.returnPct}%
                </p>
              </div>
              <div className="dda-panel rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-wide text-gray-500">{t("investmentChart.liquidity")}</p>
                <p className="mt-1 text-sm font-bold text-white">{selected.liquidity}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span
                className={cn(
                  "inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset",
                  riskStyles[selected.riskKey] ?? riskStyles.Low
                )}
              >
                {t("investmentChart.riskBadge", { risk: selected.risk })}
              </span>
              <span className="inline-flex rounded-full bg-white/5 px-2.5 py-0.5 text-[10px] font-semibold text-gray-300 ring-1 ring-white/10">
                {selected.category}
              </span>
              <span className="inline-flex rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-400 ring-1 ring-emerald-500/20">
                {selected.status}
              </span>
            </div>

            <div className="mt-4">
              <div className="mb-1 flex justify-between text-xs text-gray-500">
                <span>{t("investmentChart.poolShare")}</span>
                <span className="font-semibold text-white">{selected.percent}%</span>
              </div>
              <ProgressBar value={selected.percent} />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="dda-panel relative flex flex-1 flex-col rounded-xl p-4">
            <p className="mb-2 text-sm font-medium text-white">{t("investmentChart.capitalMix")}</p>
            <div className="relative h-48 w-full sm:h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={82}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="#071013"
                    strokeWidth={2}
                    onClick={(data) => data?.id && onSelect(data.id)}
                    className="cursor-pointer outline-none"
                  >
                    {chartData.map((entry) => (
                      <Cell
                        key={entry.id}
                        fill={entry.color}
                        fillOpacity={entry.id === selectedId ? 1 : 0.55}
                        stroke="#071013"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<AllocationTooltip t={t} />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <CircleDollarSign className="h-5 w-5 text-emerald-400" />
                <span className="mt-1 text-xs font-bold tabular-nums text-white">
                  {selected.percent}%
                </span>
                <span className="text-[10px] text-gray-500">{t("investmentChart.selected")}</span>
              </div>
            </div>

            <ul className="mt-2 space-y-2">
              {investments.map((item) => {
                const active = item.id === selectedId;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(item.id)}
                      className={cn(
                        "dda-glass-btn flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm transition",
                        active && "border-emerald-400/25 ring-1 ring-emerald-400/15"
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2 text-gray-300">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className={cn("truncate", active && "font-semibold text-white")}>
                          {item.name}
                        </span>
                      </span>
                      <span className="shrink-0 tabular-nums text-gray-200">
                        {item.percent}% · {item.returnPct}% APY
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-xs leading-relaxed text-gray-400">
            <p className="font-semibold text-gray-300">{t("pages.investments.allocationPolicy")}</p>
            <p className="mt-2">{t("pages.investments.policyCopy1")}</p>
            <p className="mt-2">{t("investmentChart.policyRebalance")}</p>
          </div>
        </div>
      </div>
    </DashboardCard>
  );
}
