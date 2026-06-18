import { Lock } from "lucide-react";
import PageHeader from "../components/layout/PageHeader";
import DashboardCard, { PoolSecondaryStats, ProgressBar } from "../components/layout/DashboardCard";
import LiquidityPoolInfographic from "../components/layout/LiquidityPoolInfographic";
import { formatPoolCurrency } from "../data/mockData";
import { useLocale } from "../i18n/LocaleContext";
import { useLocalizedData } from "../i18n/localizedData";
import { usePoolState } from "../lib/poolState";

export default function LiquidityPoolPage() {
  const { t } = useLocale();
  const { escrowLedger, dashboardStatsLabels, statHints } = useLocalizedData();
  const { poolSummary, dashboardStats } = usePoolState();

  const localizedStats = {
    escrow: { ...dashboardStats.escrow, label: dashboardStatsLabels.escrow },
    daily: { ...dashboardStats.daily, label: dashboardStatsLabels.daily },
    apy: { ...dashboardStats.apy, label: dashboardStatsLabels.apy },
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title={t("pages.poolPage.title")}
        description={t("pages.poolPage.description")}
      />

      <LiquidityPoolInfographic />

      <PoolSecondaryStats stats={localizedStats} hints={statHints} />

      <DashboardCard title={t("pages.poolPage.escrowVisibility")}>
        <div className="flex items-start gap-3 rounded-xl bg-black/20 p-4 ring-1 ring-white/10">
          <Lock className="h-5 w-5 shrink-0 text-emerald-400" />
          <p className="text-sm leading-relaxed text-gray-400">
            {t("pages.poolPage.escrowCopy", { date: poolSummary.lastAudit })}
          </p>
        </div>
        <p className="mt-4 text-sm text-gray-400">
          {t("pages.poolPage.availableDeploy")}:{" "}
          <span className="font-semibold text-white">
            {formatPoolCurrency(poolSummary.availableToDeploy)}
          </span>
        </p>
      </DashboardCard>

      <DashboardCard title={t("pages.poolPage.escrowLedger")} subtitle={t("pages.poolPage.escrowLedgerSub")}>
        <ul className="space-y-2">
          {escrowLedger.map((entry) => (
            <li
              key={entry.id}
              className="dda-panel flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm"
            >
              <span className="min-w-0 truncate text-gray-400">{entry.label}</span>
              <span
                className={`shrink-0 font-semibold tabular-nums ${
                  entry.type === "inflow" ? "text-emerald-400" : "text-gray-400"
                }`}
              >
                {entry.type === "inflow" ? "+" : entry.type === "outflow" ? "−" : ""}
                {formatPoolCurrency(Math.abs(entry.amount))}
              </span>
            </li>
          ))}
        </ul>
      </DashboardCard>

      <DashboardCard title={t("pages.poolPage.contributionVelocity")}>
        <div className="mb-2 flex justify-between text-sm">
          <span className="text-gray-400">{t("pages.poolPage.dailyCompliance")}</span>
          <span className="font-medium text-emerald-400">96.8%</span>
        </div>
        <ProgressBar value={96.8} />
      </DashboardCard>
    </div>
  );
}
