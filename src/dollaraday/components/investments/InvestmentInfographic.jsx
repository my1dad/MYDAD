import { useMemo, useState } from "react";
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
import {
  formatPositionMaturity,
  getPositionsForSleeve,
  ALLOCATION_SLEEVE_META,
} from "../../lib/allocationSleeves";
import { getSleeveRoi } from "../../lib/allocationRoi";
import AllocationStatsGrid from "./AllocationStatsGrid";
import { isStockPosition } from "../../lib/stockAllocations";
import { computeStockPositionMetrics, formatQuotePrice } from "../../lib/massiveMarket";
import { resolveMemberProfileId, useMemberAccounts } from "../../lib/memberAccounts";
import AllocationSleeveModal from "./AllocationSleeveModal";
import AllocationPositionModal from "./AllocationPositionModal";
import AllocationEntityModal from "./AllocationEntityModal";
import StockAllocationModal from "./StockAllocationModal";
import { ALLOCATION_SLEEVE_OPTIONS } from "./allocationSleeveOptions";

function AllocationTooltip({ active, payload, t }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="dda-chart-tooltip">
      <p className="font-semibold text-white">{item.name}</p>
      <p className="mt-0.5 tabular-nums text-dda-green-light">{formatPoolCurrency(item.allocated)}</p>
      <p className="mt-0.5 text-gray-400">{t("investmentChart.percentDeployed", { percent: item.percent })}</p>
    </div>
  );
}

const riskStyles = {
  Low: "bg-dda-green/15 text-dda-green-light ring-dda-green/25",
  Medium: "bg-dda-gold/15 text-dda-gold-light ring-dda-gold/25",
  High: "bg-red-500/15 text-red-400 ring-red-500/25",
};

export default function InvestmentInfographic({
  investments,
  positions,
  totalAllocated,
  poolApy,
  selectedId,
  onSelect,
}) {
  const { t } = useLocale();
  const profileId = resolveMemberProfileId();
  const ledger = useMemberAccounts(profileId);
  const availableBalance = ledger.escrowBalance;

  const [sleeveModalItem, setSleeveModalItem] = useState(null);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [activeSleeveId, setActiveSleeveId] = useState(null);
  const [entityInitialMode, setEntityInitialMode] = useState("buy");
  const [entityInitialSellId, setEntityInitialSellId] = useState("");

  const activeSleeve = ALLOCATION_SLEEVE_OPTIONS.find((item) => item.id === activeSleeveId);

  const openBuyModal = (sleeveId, { mode = "buy", sellPositionId = "" } = {}) => {
    setEntityInitialMode(mode);
    setEntityInitialSellId(sellPositionId);
    setActiveSleeveId(sleeveId);
  };

  const closeBuyModal = () => {
    setActiveSleeveId(null);
    setEntityInitialMode("buy");
    setEntityInitialSellId("");
  };

  const openSleeveModal = (item) => {
    onSelect(item.id);
    setSleeveModalItem(item);
  };

  const handlePositionClick = (position) => {
    setSleeveModalItem(null);
    setSelectedPosition(position);
  };

  const selected = investments.find((item) => item.id === selectedId) ?? investments[0];
  const sleeveModalPositions = sleeveModalItem?.key
    ? getPositionsForSleeve(sleeveModalItem.key, positions)
    : [];
  const selectedPositions = selected?.key
    ? getPositionsForSleeve(selected.key, positions)
    : [];
  const selectedSleeveRoi = getSleeveRoi(selectedPositions);
  const hasDeployedCapital = totalAllocated > 0;
  const chartData = useMemo(
    () =>
      investments.map((item) => ({
        ...item,
        value: item.allocated,
      })),
    [investments]
  );

  return (
    <>
    <DashboardCard noPadding>
      <div className="grid gap-5 p-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-5">
          <DashboardCard
            title={t("investmentChart.totalDeployed")}
            subtitle={formatPoolCurrency(totalAllocated)}
            compact
            collapsible
            defaultCollapsed
            collapseAriaLabel={t("pages.investments.collapseTotalDeployed")}
            expandAriaLabel={t("pages.investments.expandTotalDeployed")}
          >
            <p className="text-3xl font-bold tabular-nums tracking-tight text-white sm:text-4xl">
              {formatPoolCurrency(totalAllocated)}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-dda-green/15 px-2.5 py-1 text-xs font-semibold text-dda-green-light ring-1 ring-dda-green/25">
                <TrendingUp className="h-3.5 w-3.5" />
                {t("investmentChart.blendedApyBadge", { apy: poolApy })}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-xs font-semibold text-gray-300 ring-1 ring-white/10">
                <Shield className="h-3.5 w-3.5 text-sky-400" />
                {t("investmentChart.sleevesBadge", { count: investments.length })}
              </span>
            </div>

            <div className="dda-panel mt-5 rounded-xl p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-white">{t("investmentChart.funnel")}</p>
                <p className="text-xs text-gray-500">{t("investmentChart.tapSegment")}</p>
              </div>

              <div className="flex h-10 overflow-hidden rounded-full bg-white/5 ring-1 ring-white/10">
                {hasDeployedCapital ? (
                  investments.map((item) => {
                    const active = item.id === selectedId;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => openSleeveModal(item)}
                        title={item.name}
                        className={cn(
                          "relative transition-all duration-300 hover:brightness-110",
                          active && "z-10 ring-2 ring-white/80 ring-offset-2 ring-offset-[#071013]",
                        )}
                        style={{
                          width: `${item.percent}%`,
                          backgroundColor: item.color,
                        }}
                      >
                        {item.percent >= 12 ? (
                          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-dda-ink/80">
                            {item.percent}%
                          </span>
                        ) : null}
                      </button>
                    );
                  })
                ) : (
                  <div className="flex h-full w-full items-center justify-center px-3 text-[11px] text-gray-500">
                    {t("investmentChart.noDeployment")}
                  </div>
                )}
              </div>

              <div className="mt-4 space-y-3">
                {investments.map((item) => {
                  const active = item.id === selectedId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openSleeveModal(item)}
                      className={cn(
                        "group w-full text-left transition",
                        active ? "opacity-100" : "opacity-80 hover:opacity-100"
                      )}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                        <span className={cn("font-medium", active ? "text-white" : "text-gray-300")}>
                          {item.name}
                        </span>
                        <span className="tabular-nums text-dda-green-light">
                          {item.percent}% · {formatPoolCurrency(item.allocated)}
                        </span>
                      </div>
                      <div className="h-8 w-full overflow-hidden rounded-lg bg-white/5 transition-all duration-300">
                        <div
                          className={cn(
                            "flex h-full items-center rounded-lg px-3 text-xs font-semibold text-dda-ink transition-all duration-500",
                            item.allocated <= 0 && "bg-transparent",
                          )}
                          style={{
                            width: item.allocated > 0 ? `${item.percent}%` : "0%",
                            backgroundColor: item.allocated > 0 ? item.color : undefined,
                          }}
                        >
                          {active && item.allocated > 0 ? item.name : null}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </DashboardCard>

          <DashboardCard
            title={t("pages.investments.selectedSleeve")}
            subtitle={selected.name}
            compact
            collapsible
            defaultCollapsed
            collapseAriaLabel={t("pages.investments.collapseSelectedSleeve")}
            expandAriaLabel={t("pages.investments.expandSelectedSleeve")}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-white">{selected.name}</h3>
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

            <div className="mt-4">
              <AllocationStatsGrid
                allocated={selected.allocated}
                apy={selected.returnPct}
                liquidity={selected.liquidity}
                roiAmount={selectedSleeveRoi.amount}
                roiPct={selectedSleeveRoi.pct}
                t={t}
              />
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
              <span className="inline-flex rounded-full bg-dda-green/10 px-2.5 py-0.5 text-[10px] font-semibold text-dda-green-light ring-1 ring-dda-green/20">
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

            {selectedPositions.length ? (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                  {t("pages.investments.sleeveAllocations")}
                </p>
                <ul className="space-y-2">
                  {selectedPositions.map((position) => {
                    const stock = isStockPosition(position);
                    const entry =
                      position.entryPrice ??
                      (position.contracts > 0 ? position.principal / position.contracts : 0);
                    const market = position.marketPrice ?? entry;
                    const stockMetrics = stock
                      ? computeStockPositionMetrics(position.contracts, entry, market)
                      : null;
                    const gain = stockMetrics ? stockMetrics.pnl >= 0 : true;

                    return (
                    <li key={position.id}>
                      <button
                        type="button"
                        onClick={() => handlePositionClick(position)}
                        className="dda-glass-btn flex w-full items-start justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition hover:border-white/15"
                      >
                      <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-white">{position.contractLabel}</p>
                          <p className="mt-0.5 text-xs text-gray-500">
                            {stock
                              ? `${position.contracts} ${t("pages.investments.stockSharesUnit")} · ${t("pages.investments.stockCostBasis")} ${formatQuotePrice(entry)}`
                              : t("pages.investments.positionMaturity", {
                                  date: formatPositionMaturity(position.maturityDate),
                                })}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-bold tabular-nums text-white">
                            {formatPoolCurrency(stockMetrics?.marketValue ?? position.principal)}
                          </p>
                          <p
                            className={cn(
                              "mt-0.5 text-xs tabular-nums",
                              stock
                                ? gain
                                  ? "text-dda-green-light"
                                  : "text-red-400"
                                : "text-dda-green-light",
                            )}
                          >
                            {stock && stockMetrics
                              ? `${gain ? "+" : ""}${formatPoolCurrency(stockMetrics.pnl)} (${gain ? "+" : ""}${stockMetrics.pnlPct.toFixed(2)}%)`
                              : `${position.annualYieldPct}% APR`}
                          </p>
                        </div>
                      </div>
                      </button>
                    </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <p className="mt-4 text-xs text-gray-500">{t("pages.investments.noSleeveAllocations")}</p>
            )}
          </DashboardCard>
        </div>

        <div className="flex flex-col gap-4">
          <div className="dda-panel relative flex flex-1 flex-col rounded-xl p-4">
            <p className="mb-2 text-sm font-medium text-white">{t("investmentChart.capitalMix")}</p>
            <div className="dda-donut-chart relative h-48 w-full sm:h-52">
              <ResponsiveContainer width="100%" height="100%" className="dda-donut-chart__plot">
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
                    onClick={(slice) => {
                      const entry = slice?.payload ?? slice;
                      if (!entry?.id) return;
                      const item = investments.find((inv) => inv.id === entry.id) ?? entry;
                      openSleeveModal(item);
                    }}
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
                  <Tooltip
                    content={<AllocationTooltip t={t} />}
                    wrapperStyle={{ zIndex: 50, outline: "none" }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="dda-donut-chart__center pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <CircleDollarSign className="h-5 w-5 text-dda-green-light" />
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
                      onClick={() => openSleeveModal(item)}
                      className={cn(
                        "dda-glass-btn flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm transition",
                        active && "border-dda-green-light/25 ring-1 ring-dda-green-light/15"
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
        </div>
      </div>
    </DashboardCard>

    <AllocationSleeveModal
      investment={sleeveModalItem}
      positions={sleeveModalPositions}
      accent={
        sleeveModalItem?.color ??
        (sleeveModalItem?.key
          ? (ALLOCATION_SLEEVE_META[sleeveModalItem.key]?.color ?? "#38bdf8")
          : "#38bdf8")
      }
      open={Boolean(sleeveModalItem)}
      onClose={() => setSleeveModalItem(null)}
      onPositionClick={handlePositionClick}
      onBuy={(sleeveKey) => openBuyModal(sleeveKey, { mode: "buy" })}
      onSell={(sleeveKey) => openBuyModal(sleeveKey, { mode: "sell" })}
    />

    <AllocationPositionModal
      position={selectedPosition}
      accent={
        selectedPosition
          ? (ALLOCATION_SLEEVE_META[selectedPosition.sleeveKey]?.color ?? "#38bdf8")
          : "#38bdf8"
      }
      open={Boolean(selectedPosition)}
      onClose={() => setSelectedPosition(null)}
      onBuyMore={(sleeveKey) => openBuyModal(sleeveKey, { mode: "buy" })}
      onSell={(position) =>
        openBuyModal(position.sleeveKey, { mode: "sell", sellPositionId: position.id })
      }
    />

    {activeSleeve?.id === "stocks" ? (
      <StockAllocationModal
        sleeve={activeSleeve}
        open={Boolean(activeSleeveId)}
        availableBalance={availableBalance}
        onClose={closeBuyModal}
        initialMode={entityInitialMode}
        initialSellPositionId={entityInitialSellId}
      />
    ) : activeSleeve ? (
      <AllocationEntityModal
        sleeve={activeSleeve}
        open={Boolean(activeSleeveId)}
        availableBalance={availableBalance}
        onClose={closeBuyModal}
        initialMode={entityInitialMode}
        initialSellPositionId={entityInitialSellId}
      />
    ) : null}
    </>
  );
}
