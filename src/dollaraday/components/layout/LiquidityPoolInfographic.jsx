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

function PoolMetricButton({ label, value, icon: Icon, accent }) {
  return (
    <button
      type="button"
      className="dda-glass-btn group flex min-w-0 flex-col p-3.5 text-left sm:p-4"
    >
      <span className="relative flex items-center justify-between gap-2">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset transition group-hover:scale-105"
          style={{
            backgroundColor: `${accent}18`,
            color: accent,
            boxShadow: `inset 0 0 0 1px ${accent}33`,
          }}
        >
          <Icon className="h-4 w-4" strokeWidth={2.25} />
        </span>
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full opacity-80"
          style={{ backgroundColor: accent }}
          aria-hidden="true"
        />
      </span>
      <span className="relative mt-3 text-[11px] font-medium uppercase tracking-wide text-gray-500">
        {label}
      </span>
      <span className="relative mt-1 truncate text-sm font-bold tabular-nums text-white sm:text-base">
        {value}
      </span>
    </button>
  );
}

function PoolTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-lg border border-white/10 bg-[#071013]/95 px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-white">{item.name}</p>
      <p className="mt-0.5 tabular-nums text-emerald-400">
        {formatPoolCurrency(item.value)}
      </p>
    </div>
  );
}

export default function LiquidityPoolInfographic() {
  const { t } = useLocale();
  const { poolSummary, poolComposition } = usePoolState();
  const reservePct = Math.round(poolSummary.reserveRatio * 100);

  const localizedComposition = poolComposition.map((segment) => ({
    ...segment,
    name: t(`pool.${segment.key}`),
  }));

  const poolMetrics = [
    {
      key: "deployed",
      label: t("pool.deployed"),
      value: formatPoolCurrency(poolSummary.deployedCapital),
      icon: TrendingUp,
      accent: "#10b981",
    },
    {
      key: "escrow",
      label: t("pool.escrow"),
      value: formatPoolCurrency(poolSummary.escrowBalance),
      icon: Lock,
      accent: "#2563eb",
    },
    {
      key: "available",
      label: t("pool.available"),
      value: formatPoolCurrency(poolSummary.availableToDeploy),
      icon: Wallet,
      accent: "#eab308",
    },
    {
      key: "monthly",
      label: t("pool.monthlyInflow"),
      value: formatPoolCurrency(poolSummary.monthlyInflow),
      icon: ArrowDownToLine,
      accent: "#34d399",
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
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/25">
                <TrendingUp className="h-3.5 w-3.5" />
                {t("pool.ytd", { pct: poolSummary.ytdGrowthPct })}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-xs font-semibold text-gray-300 ring-1 ring-white/10">
                <Users className="h-3.5 w-3.5 text-emerald-400" />
                {poolSummary.memberCount.toLocaleString()} {t("common.members")}
              </span>
            </div>
          </div>

          <PoolBalanceChart />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
            <div className="relative h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={localizedComposition}
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={72}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="#071013"
                    strokeWidth={2}
                  >
                    {localizedComposition.map((entry) => (
                      <Cell key={entry.key} fill={entry.color} fillOpacity={1} />
                    ))}
                  </Pie>
                  <Tooltip content={<PoolTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold tabular-nums text-white">
                  {reservePct}%
                </span>
                <span className="text-[10px] text-gray-500">{t("pool.reserve")}</span>
              </div>
            </div>

            <ul className="mt-2 w-full space-y-2">
              {localizedComposition.map((segment) => {
                const pct = Math.round((segment.value / poolSummary.totalBalance) * 100);
                return (
                  <li key={segment.key} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2 text-gray-400">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: segment.color }}
                      />
                      {segment.name}
                    </span>
                    <span className="shrink-0 tabular-nums text-gray-200">
                      {pct}% · {formatPoolCurrency(segment.value)}
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
