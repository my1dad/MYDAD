import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import PageHeader from "../components/layout/PageHeader";
import InvestmentHighlights from "../components/investments/InvestmentHighlights";
import BuyAllocationsCard from "../components/investments/BuyAllocationsCard";
import InvestmentInfographic from "../components/investments/InvestmentInfographic";
import InvestmentYieldChart from "../components/investments/InvestmentYieldChart";
import DashboardCard from "../components/layout/DashboardCard";
import { formatPoolCurrency } from "../data/mockData";
import { useLocale } from "../i18n/LocaleContext";
import { useLocalizedData } from "../i18n/localizedData";
import {
  buildLiveInvestmentHighlights,
  summarizeSleeveAllocations,
  useLiveSleeveInvestments,
} from "../lib/allocationSleeves";
import { useAllocationPositions } from "../lib/allocationPositions";
import { isStockPosition, syncStockMarketPrices } from "../lib/stockAllocations";
import { useStockQuotes } from "../hooks/useStockMarketData";
import { usePoolState } from "../lib/poolState";

function InvestmentSheetStats({ rows, metricLabel, valueLabel }) {
  return (
    <div className="dda-sheet-table">
      <table className="dda-sheet-table__grid">
        <thead>
          <tr>
            <th scope="col" className="dda-sheet-table__head">
              {metricLabel}
            </th>
            <th scope="col" className="dda-sheet-table__head dda-sheet-table__head--value">
              {valueLabel}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={row.key}
              className={cn(
                index % 2 === 0 ? "dda-sheet-table__row--even" : "dda-sheet-table__row--odd",
              )}
            >
              <td className="dda-sheet-table__label">{row.title}</td>
              <td className="dda-sheet-table__value" data-metric={row.key}>
                {row.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function InvestmentsPage() {
  const { t } = useLocale();
  const { investments, investmentHighlights } = useLocalizedData();
  const { poolSummary } = usePoolState();
  const positions = useAllocationPositions();
  const stockSymbols = useMemo(
    () =>
      positions
        .filter((position) => isStockPosition(position) && !position.matured)
        .map((position) => position.marketSymbol ?? position.contractId),
    [positions],
  );
  const { quotes: stockQuotes } = useStockQuotes(stockSymbols, stockSymbols.length > 0);
  const stockQuotesFingerprint = useMemo(
    () =>
      Object.entries(stockQuotes)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([symbol, quote]) => `${symbol}:${quote.price}`)
        .join("|"),
    [stockQuotes],
  );

  useEffect(() => {
    if (!stockQuotesFingerprint) return;
    syncStockMarketPrices(stockQuotes);
  }, [stockQuotesFingerprint, stockQuotes]);

  const sleeveInvestments = useLiveSleeveInvestments(investments);
  const sleeveSummaries = useMemo(
    () => summarizeSleeveAllocations(positions),
    [positions],
  );

  const [selectedId, setSelectedId] = useState(sleeveInvestments[0]?.id);

  useEffect(() => {
    const current = sleeveInvestments.find((item) => item.id === selectedId);
    if (current?.allocated > 0) return;
    const withAllocation = sleeveInvestments.find((item) => item.allocated > 0);
    if (withAllocation) {
      setSelectedId(withAllocation.id);
    }
  }, [sleeveInvestments, selectedId]);

  const totalAllocated = sleeveSummaries.reduce((sum, item) => sum + item.principal, 0);

  const liveHighlights = useMemo(
    () => buildLiveInvestmentHighlights(investmentHighlights, sleeveSummaries),
    [investmentHighlights, sleeveSummaries],
  );

  const activeSleeveCount = sleeveSummaries.filter((item) => item.positionCount > 0).length;

  const heroStats = [
    {
      key: "deployed",
      title: t("pages.investments.totalDeployed"),
      value: formatPoolCurrency(totalAllocated),
    },
    {
      key: "apy",
      title: t("pages.investments.blendedApy"),
      value: `${poolSummary.poolApy}%`,
    },
    {
      key: "sleeves",
      title: t("pages.investments.allocationSleeves"),
      value: String(activeSleeveCount || sleeveInvestments.length),
    },
    {
      key: "growth",
      title: t("pages.investments.ytdGrowth"),
      value: totalAllocated > 0
        ? `${poolSummary.ytdGrowthPct >= 0 ? "+" : ""}${poolSummary.ytdGrowthPct}%`
        : "+0%",
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title={t("pages.investments.title")}
        description={t("pages.investments.description")}
        highlights={t("pages.investments.highlights")}
        variant="hero"
      />

      <InvestmentSheetStats
        rows={heroStats}
        metricLabel={t("pages.investments.sheetMetric")}
        valueLabel={t("pages.investments.sheetValue")}
      />

      <BuyAllocationsCard />

      <InvestmentInfographic
        investments={sleeveInvestments}
        positions={positions}
        totalAllocated={totalAllocated}
        poolApy={poolSummary.poolApy}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <InvestmentYieldChart
          investments={sleeveInvestments}
          blendedApy={poolSummary.poolApy}
        />

        <DashboardCard
          title={t("pages.investments.sleeveComparison")}
          subtitle={t("pages.investments.sleeveComparisonSub")}
          compact
          collapsible
          defaultCollapsed
          collapseAriaLabel={t("pages.investments.collapseSleeveComparison")}
          expandAriaLabel={t("pages.investments.expandSleeveComparison")}
        >
          <ul className="space-y-2">
            {[...sleeveInvestments]
              .sort((a, b) => b.allocated - a.allocated)
              .map((item, index) => {
                const active = item.id === selectedId;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className={cn(
                        "dda-glass-btn flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition",
                        active && "border-dda-green-light/25 ring-1 ring-dda-green-light/15"
                      )}
                    >
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-dda-ink"
                        style={{ backgroundColor: item.color }}
                      >
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-white">{item.name}</span>
                        <span className="mt-0.5 block text-xs text-gray-500">
                          {t("pages.investments.riskLiquidity", {
                            risk: item.risk,
                            liquidity: item.liquidity,
                          })}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-sm font-bold tabular-nums text-dda-green-light">
                          {item.returnPct}%
                        </span>
                        <span className="block text-[11px] tabular-nums text-gray-500">
                          {formatPoolCurrency(item.allocated)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
          </ul>
        </DashboardCard>
      </div>

      <InvestmentHighlights highlights={liveHighlights} />
    </div>
  );
}
