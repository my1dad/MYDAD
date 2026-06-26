import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import DashboardCard from "../layout/DashboardCard";
import { formatPoolCurrency } from "../../data/mockData";
import { resolveMemberProfileId, useMemberAccounts } from "../../lib/memberAccounts";
import { useLocale } from "../../i18n/LocaleContext";
import { useAllocationPositions } from "../../lib/allocationPositions";
import { isStockPosition } from "../../lib/stockAllocations";
import { computeStockPositionMetrics } from "../../lib/massiveMarket";
import { ALLOCATION_SLEEVE_META, formatPositionMaturity } from "../../lib/allocationSleeves";
import AllocationEntityModal from "./AllocationEntityModal";
import AllocationPositionModal from "./AllocationPositionModal";
import StockAllocationModal from "./StockAllocationModal";
import { ALLOCATION_SLEEVE_OPTIONS } from "./allocationSleeveOptions";

const ALLOCATION_OPTIONS = ALLOCATION_SLEEVE_OPTIONS;

function getPositionValue(position) {
  if (position.sleeveKey === "stocks") {
    const shares = position.contracts;
    const entry = position.entryPrice ?? (shares > 0 ? position.principal / shares : 0);
    const market = position.marketPrice ?? entry;
    return shares * market;
  }
  return position.principal;
}

function getPositionReturnLabel(position, t) {
  if (isStockPosition(position)) {
    const entry =
      position.entryPrice ??
      (position.contracts > 0 ? position.principal / position.contracts : 0);
    const market = position.marketPrice ?? entry;
    const metrics = computeStockPositionMetrics(position.contracts, entry, market);
    const gain = metrics.pnl >= 0;
    return {
      text: `${gain ? "+" : ""}${metrics.pnlPct.toFixed(2)}%`,
      positive: gain,
    };
  }
  return {
    text: `${position.annualYieldPct}% ${t("pages.investments.portfolioApyShort")}`,
    positive: true,
  };
}

function PortfolioRow({ position, index, sleeveLabel, accent, onSelect }) {
  const { t } = useLocale();
  const value = getPositionValue(position);
  const performance = getPositionReturnLabel(position, t);
  const subtitle = isStockPosition(position)
    ? `${position.contracts} ${t("pages.investments.stockSharesUnit")} · ${position.marketSymbol ?? position.contractId}`
    : position.contractLabel;

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(position)}
        className={cn(
          "dda-portfolio-row flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-white/[0.04]",
          index % 2 === 0 ? "dda-portfolio-row--even" : "dda-portfolio-row--odd",
        )}
      >
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[10px] font-bold uppercase text-dda-ink"
          style={{ backgroundColor: accent }}
          aria-hidden
        >
          {position.sleeveKey.slice(0, 1)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-white">{subtitle}</span>
            <span className="shrink-0 text-[10px] font-medium uppercase tracking-[0.1em] text-gray-600">
              {sleeveLabel}
            </span>
          </span>
          <span className="mt-0.5 block truncate text-xs text-gray-500">
            {isStockPosition(position)
              ? t("pages.investments.portfolioStockPosition")
              : `${t("pages.investments.portfolioMaturity")}: ${formatPositionMaturity(position.maturityDate)}`}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-sm font-bold tabular-nums text-white">
            {formatPoolCurrency(value)}
          </span>
          <span
            className={cn(
              "mt-0.5 block text-xs font-semibold tabular-nums",
              performance.positive ? "text-dda-green-light" : "text-red-400",
            )}
          >
            {performance.text}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-gray-600" aria-hidden />
      </button>
    </li>
  );
}

export default function BuyAllocationsCard() {
  const { t } = useLocale();
  const profileId = resolveMemberProfileId();
  const ledger = useMemberAccounts(profileId);
  const positions = useAllocationPositions(profileId);
  const [activeSleeveId, setActiveSleeveId] = useState(null);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [entityInitialMode, setEntityInitialMode] = useState("buy");
  const [entityInitialSellId, setEntityInitialSellId] = useState("");

  const availableBalance = ledger.escrowBalance;
  const activeSleeve = ALLOCATION_OPTIONS.find((item) => item.id === activeSleeveId);

  const activePositions = useMemo(
    () =>
      positions
        .filter((position) => !position.matured)
        .sort((a, b) => b.purchasedDate.localeCompare(a.purchasedDate)),
    [positions],
  );

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

  const sleeveLabel = (sleeveKey) => {
    const option = ALLOCATION_OPTIONS.find((item) => item.id === sleeveKey);
    return option ? t(`pages.investments.${option.labelKey}`) : sleeveKey;
  };

  return (
    <>
      <DashboardCard
        title={t("pages.investments.buyAllocationsTitle")}
        subtitle={t("pages.investments.buyAllocationsSub")}
        compact
        collapsible
        collapseAriaLabel={t("pages.investments.collapseBuyAllocations")}
        expandAriaLabel={t("pages.investments.expandBuyAllocations")}
      >
        <p className="text-xs text-gray-500">
          {t("pages.investments.buyAvailable")}:{" "}
          <span className="font-semibold tabular-nums text-gray-300">
            {formatPoolCurrency(availableBalance)}
          </span>
        </p>

        <div className="mt-3 flex gap-2">
          {ALLOCATION_OPTIONS.map(({ id, labelKey, icon: Icon, accent }) => (
            <button
              key={id}
              type="button"
              onClick={() => openBuyModal(id)}
              className="dda-glass-btn flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-2 py-2 transition hover:border-dda-green-light/20"
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-md ring-1 ring-inset"
                style={{
                  backgroundColor: `color-mix(in srgb, ${accent} 14%, transparent)`,
                  color: accent,
                  boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${accent} 28%, transparent)`,
                }}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
              </span>
              <span className="truncate text-[11px] font-semibold leading-tight text-white">
                {t(`pages.investments.${labelKey}`)}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
            {t("pages.investments.portfolioTitle")}
          </p>
          {activePositions.length ? (
            <div className="dda-portfolio-list overflow-hidden rounded-xl border border-white/10">
              <ul>
                {activePositions.map((position, index) => (
                  <PortfolioRow
                    key={position.id}
                    position={position}
                    index={index}
                    sleeveLabel={sleeveLabel(position.sleeveKey)}
                    accent={ALLOCATION_SLEEVE_META[position.sleeveKey]?.color ?? "#38bdf8"}
                    onSelect={setSelectedPosition}
                  />
                ))}
              </ul>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-gray-500">
              {t("pages.investments.portfolioEmpty")}
            </p>
          )}
        </div>
      </DashboardCard>

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
