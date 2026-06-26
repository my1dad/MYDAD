import { useMemo } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { ArrowDownToLine, Lock, TrendingUp, Users, Wallet } from "lucide-react";
import DashboardCard from "./DashboardCard";
import PoolBalanceChart from "./PoolBalanceChart";
import { formatPoolCurrency } from "../../data/mockData";
import { useLocale } from "../../i18n/LocaleContext";
import { usePoolState } from "../../lib/poolState";
import { POOL_CAPITAL_COLORS } from "../../lib/theme";

function CapitalTag({ label, color }) {
  return (
    <span
      className="dda-pool-capital-tag inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{
        color,
        backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 30%, transparent)`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function PoolMetricButton({ label, value, icon: Icon, accent }) {
  return (
    <button
      type="button"
      title={`${label}: ${value}`}
      className="dda-pool-metric-btn dda-glass-btn group"
      style={{
        "--pool-metric-accent": accent,
      }}
    >
      <span
        className="dda-pool-metric-btn__icon"
        style={{
          backgroundColor: `color-mix(in srgb, ${accent} 14%, transparent)`,
          color: accent,
          boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${accent} 28%, transparent)`,
        }}
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
      </span>
      <span className="dda-pool-metric-btn__copy">
        <span className="dda-pool-metric-btn__label">{label}</span>
        <span className="dda-pool-metric-btn__value">{value}</span>
      </span>
    </button>
  );
}

function PoolTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  const color = item.color ?? POOL_CAPITAL_COLORS[item.key] ?? "#34d399";
  return (
    <div className="dda-chart-tooltip">
      <p className="font-semibold text-white">{item.name}</p>
      <p className="mt-0.5 tabular-nums" style={{ color }}>
        {formatPoolCurrency(item.value)}
      </p>
    </div>
  );
}

export default function LiquidityPoolInfographic() {
  const { t } = useLocale();
  const { poolSummary } = usePoolState();
  const reservePct =
    poolSummary.totalBalance > 0 ? Math.round(poolSummary.reserveRatio * 100) : 0;

  const capitalSegments = useMemo(
    () =>
      [
        {
          key: "deployed",
          value: poolSummary.deployedCapital,
          color: POOL_CAPITAL_COLORS.deployed,
        },
        {
          key: "escrow",
          value: poolSummary.escrowBalance,
          color: POOL_CAPITAL_COLORS.escrow,
        },
        {
          key: "available",
          value: poolSummary.availableToDeploy,
          color: POOL_CAPITAL_COLORS.available,
        },
      ].map((segment) => ({
        ...segment,
        name: t(`pool.${segment.key}`),
      })),
    [
      poolSummary.deployedCapital,
      poolSummary.escrowBalance,
      poolSummary.availableToDeploy,
      t,
    ],
  );

  /** Pie uses deployed + available cash only (escrow shares the same cash balance). */
  const chartSegments = useMemo(
    () => capitalSegments.filter((segment) => segment.value > 0 && segment.key !== "escrow"),
    [capitalSegments],
  );

  const allocationTotal = useMemo(
    () => chartSegments.reduce((sum, segment) => sum + segment.value, 0),
    [chartSegments],
  );

  const poolMetrics = [
    {
      key: "deployed",
      label: t("pool.deployed"),
      value: formatPoolCurrency(poolSummary.deployedCapital),
      icon: TrendingUp,
      accent: POOL_CAPITAL_COLORS.deployed,
    },
    {
      key: "escrow",
      label: t("pool.escrow"),
      value: formatPoolCurrency(poolSummary.escrowBalance),
      icon: Lock,
      accent: POOL_CAPITAL_COLORS.escrow,
    },
    {
      key: "available",
      label: t("pool.available"),
      value: formatPoolCurrency(poolSummary.availableToDeploy),
      icon: Wallet,
      accent: POOL_CAPITAL_COLORS.available,
    },
    {
      key: "monthly",
      label: t("pool.monthlyInflow"),
      value: formatPoolCurrency(poolSummary.monthlyInflow),
      icon: ArrowDownToLine,
      accent: "var(--color-dda-green-light)",
    },
  ];

  return (
    <DashboardCard noPadding>
      <div className="grid gap-5 p-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5">
          <div>
            <p className="text-sm text-gray-400">{t("pool.totalBalance")}</p>
            <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-white sm:text-4xl">
              {formatPoolCurrency(poolSummary.totalBalance)}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-dda-green/15 px-2.5 py-1 text-xs font-semibold text-dda-green-light ring-1 ring-dda-green/25">
                <TrendingUp className="h-3.5 w-3.5" />
                {t("pool.ytd", { pct: poolSummary.ytdGrowthPct })}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-xs font-semibold text-gray-300 ring-1 ring-white/10">
                <Users className="h-3.5 w-3.5 text-dda-green-light" />
                {poolSummary.memberCount.toLocaleString()} {t("common.members")}
              </span>
            </div>
          </div>

          <PoolBalanceChart />

          <div className="dda-pool-metrics">
            {poolMetrics.map((metric) => (
              <PoolMetricButton
                key={metric.key}
                label={metric.label}
                value={metric.value}
                icon={metric.icon}
                accent={metric.accent}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="dda-panel relative flex flex-1 flex-col items-center rounded-xl p-4">
            <p className="mb-2 self-start text-sm font-medium text-white">{t("pool.capitalAllocation")}</p>
            <div className="dda-donut-chart relative h-44 w-full">
              <ResponsiveContainer width="100%" height="100%" className="dda-donut-chart__plot">
                <PieChart>
                  <Pie
                    data={chartSegments}
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={72}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="#071013"
                    strokeWidth={2}
                  >
                    {chartSegments.map((entry) => (
                      <Cell key={entry.key} fill={entry.color} fillOpacity={1} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={<PoolTooltip />}
                    wrapperStyle={{ zIndex: 50, outline: "none" }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="dda-donut-chart__center pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold tabular-nums text-white">
                  {reservePct}%
                </span>
                <span className="text-[10px] text-gray-500">{t("pool.reserve")}</span>
              </div>
            </div>

            <ul className="mt-3 w-full space-y-2.5">
              {capitalSegments.map((segment) => {
                const pct =
                  allocationTotal > 0 && segment.key !== "escrow"
                    ? Math.round((segment.value / allocationTotal) * 100)
                    : segment.key === "escrow" && poolSummary.totalBalance > 0
                      ? Math.round((segment.value / poolSummary.totalBalance) * 100)
                      : 0;
                return (
                  <li key={segment.key} className="flex items-center justify-between gap-3 text-sm">
                    <CapitalTag label={segment.name} color={segment.color} />
                    <span className="shrink-0 text-right tabular-nums">
                      <span className="font-semibold" style={{ color: segment.color }}>
                        {pct}%
                      </span>
                      <span className="ml-1.5 text-gray-400">
                        · {formatPoolCurrency(segment.value)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-xs leading-relaxed text-gray-400">
            <p className="font-semibold text-gray-300">{t("pool.poolDetails")}</p>
            <p className="mt-2">
              {t("pool.lastAudit")}: <span className="text-gray-300">{poolSummary.lastAudit}</span>
            </p>
            <p className="mt-1">
              {t("pool.dailyInflowAvg", { amount: formatPoolCurrency(poolSummary.dailyInflow) })}
            </p>
          </div>
        </div>
      </div>
    </DashboardCard>
  );
}
