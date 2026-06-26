import { Lock } from "lucide-react";
import PageHeader from "../components/layout/PageHeader";
import DashboardCard, { PoolSecondaryStats, ProgressBar } from "../components/layout/DashboardCard";
import LiquidityPoolInfographic from "../components/layout/LiquidityPoolInfographic";
import { useDadAuth } from "../context/DadAuthContext";
import { formatPoolCurrency } from "../data/mockData";
import { useLocale } from "../i18n/LocaleContext";
import { useLocalizedData } from "../i18n/localizedData";
import { useEscrowLedgerEntries, useLiveInvestmentFunnel } from "../lib/allocationSleeves";
import { usePoolState } from "../lib/poolState";

export default function LiquidityPoolPage() {
  const { t } = useLocale();
  const { isAdmin } = useDadAuth();
  const { investmentFunnel, dashboardStatsLabels, statHints } = useLocalizedData();
  const { poolSummary, dashboardStats } = usePoolState();
  const liveFunnel = useLiveInvestmentFunnel(investmentFunnel);
  const escrowLedger = useEscrowLedgerEntries();

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

      {isAdmin ? (
        <PoolSecondaryStats stats={localizedStats} hints={statHints} />
      ) : null}

      {isAdmin ? (
        <DashboardCard title={t("pages.dashboard.investmentFunnel")} noPadding>
          <div className="space-y-4 p-5 pt-0">
            {liveFunnel.map((item) => (
              <div key={item.key}>
                <div className="mb-1 flex justify-between gap-3 text-sm">
                  <span className="text-gray-200">{item.name}</span>
                  <span className="shrink-0 text-right">
                    <span className="font-medium text-dda-green-light">{item.percent}%</span>
                    {item.allocated > 0 ? (
                      <span className="ml-2 text-xs tabular-nums text-gray-500">
                        {formatPoolCurrency(item.allocated)}
                      </span>
                    ) : null}
                  </span>
                </div>
                <ProgressBar value={item.percent} />
              </div>
            ))}
          </div>
        </DashboardCard>
      ) : null}

      <DashboardCard title={t("pages.poolPage.escrowVisibility")}>
        <div className="flex items-start gap-3 rounded-xl bg-black/20 p-4 ring-1 ring-white/10">
          <Lock className="h-5 w-5 shrink-0 text-dda-green-light" />
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
        {escrowLedger.length ? (
          <ul className="space-y-2">
            {escrowLedger.map((entry) => (
              <li
                key={entry.id}
                className="dda-panel flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm"
              >
                <span className="min-w-0 truncate text-gray-400">{entry.label}</span>
                <span
                  className={`shrink-0 font-semibold tabular-nums ${
                    entry.type === "inflow" ? "text-dda-green-light" : "text-gray-400"
                  }`}
                >
                  {entry.type === "inflow" ? "+" : entry.type === "outflow" ? "−" : ""}
                  {formatPoolCurrency(Math.abs(entry.amount))}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">{t("pages.poolPage.escrowLedgerEmpty")}</p>
        )}
      </DashboardCard>

      {isAdmin ? (
        <DashboardCard title={t("pages.poolPage.contributionVelocity")}>
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-gray-400">{t("pages.poolPage.dailyCompliance")}</span>
            <span className="font-medium text-dda-green-light">96.8%</span>
          </div>
          <ProgressBar value={96.8} />
        </DashboardCard>
      ) : null}
    </div>
  );
}
