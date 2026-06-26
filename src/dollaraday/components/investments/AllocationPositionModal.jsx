import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPoolCurrency } from "../../data/mockData";
import { useStockQuote } from "../../hooks/useStockMarketData";
import { useLocale } from "../../i18n/LocaleContext";
import { formatPositionMaturity, ALLOCATION_SLEEVE_META } from "../../lib/allocationSleeves";
import {
  getPositionAllocatedValue,
  getPositionApy,
  getPositionRoi,
} from "../../lib/allocationRoi";
import AllocationStatsGrid from "./AllocationStatsGrid";
import { isStockPosition, sellStockAllocation, syncStockMarketPrices } from "../../lib/stockAllocations";
import { isFixedIncomePosition, sellFixedIncomeAllocation } from "../../lib/fixedIncomeAllocations";
import { computeStockPositionMetrics, formatQuotePrice } from "../../lib/massiveMarket";

const SLEEVE_LABEL_KEYS = {
  treasury: "buyTreasury",
  bonds: "buyBonds",
  stocks: "buyStocks",
};

function getPositionValue(position) {
  if (position.sleeveKey === "stocks") {
    const shares = position.contracts;
    const entry = position.entryPrice ?? (shares > 0 ? position.principal / shares : 0);
    const market = position.marketPrice ?? entry;
    return shares * market;
  }
  return position.principal;
}

function DetailRow({ label, value, accent }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className={cn("text-right font-semibold tabular-nums", accent ?? "text-white")}>{value}</span>
    </div>
  );
}

export default function AllocationPositionModal({
  position,
  accent,
  open,
  onClose,
  onBuyMore,
  onSell,
}) {
  const { t } = useLocale();
  const [error, setError] = useState("");
  const [selling, setSelling] = useState(false);

  const isStock = position ? isStockPosition(position) : false;
  const isFixedIncome = position ? isFixedIncomePosition(position) : false;
  const symbol = position?.marketSymbol ?? position?.contractId ?? "";
  const { quote, loading: quoteLoading, refreshing, refresh } = useStockQuote(
    isStock ? symbol : null,
    open && isStock,
  );

  const handleRefreshQuote = async () => {
    const snapshot = await refresh();
    if (!snapshot?.price || !symbol) return;
    syncStockMarketPrices({ [symbol.toUpperCase()]: snapshot });
  };

  useEffect(() => {
    if (!open) return undefined;
    setError("");
    setSelling(false);
  }, [open, position?.id]);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  const metrics = useMemo(() => {
    if (!position || !isStock) return null;
    const entry =
      position.entryPrice ??
      (position.contracts > 0 ? position.principal / position.contracts : 0);
    const market = quote?.price ?? position.marketPrice ?? entry;
    return computeStockPositionMetrics(position.contracts, entry, market);
  }, [position, isStock, quote?.price]);

  if (!open || !position) return null;

  const value = getPositionValue(position);
  const gain = metrics ? metrics.pnl >= 0 : true;
  const positionRoi = getPositionRoi(position);
  const liquidityLabel = t(
    `liquidity.${ALLOCATION_SLEEVE_META[position.sleeveKey]?.liquidity ?? "Medium"}`,
  );

  const handleSell = async () => {
    setError("");
    setSelling(true);

    if (isStock) {
      const exitPrice =
        quote?.price ?? position.marketPrice ?? position.entryPrice ?? 0;
      const result = sellStockAllocation({ positionId: position.id, exitPrice });
      setSelling(false);

      if (result === "not_found") {
        setError(t("pages.investments.stockSellNotFound"));
        return;
      }
      if (result === "invalid") {
        setError(t("pages.investments.stockSellInvalid"));
        return;
      }
      onClose();
      return;
    }

    if (isFixedIncome) {
      const result = sellFixedIncomeAllocation(position.id);
      setSelling(false);

      if (result === "not_found") {
        setError(t("pages.investments.allocationSellNotFound"));
        return;
      }
      if (result === "invalid") {
        setError(t("pages.investments.allocationSellInvalid"));
        return;
      }
      onClose();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label={t("pages.investments.buyCloseModal")}
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="allocation-position-title"
        className="relative flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-dda-bg shadow-2xl sm:max-h-[90dvh] sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dda-accent-bar" />

        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-dda-green-light">
              {t(`pages.investments.${SLEEVE_LABEL_KEYS[position.sleeveKey]}`)}
            </p>
            <h2 id="allocation-position-title" className="mt-1 truncate text-lg font-semibold text-white">
              {position.contractLabel}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {isStock ? (
              <button
                type="button"
                onClick={handleRefreshQuote}
                disabled={refreshing || quoteLoading}
                aria-label={t("pages.investments.stockRefreshPrice")}
                title={t("pages.investments.stockRefreshPrice")}
                className="rounded-lg p-2 text-gray-400 transition hover:bg-white/5 hover:text-dda-green-light disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} aria-hidden="true" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              aria-label={t("common.close")}
              className="rounded-lg p-2 text-gray-400 transition hover:bg-white/5 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="dda-scroll overflow-y-auto px-5 py-4">
          <AllocationStatsGrid
            allocated={getPositionAllocatedValue(position)}
            apy={getPositionApy(position)}
            liquidity={liquidityLabel}
            roiAmount={positionRoi.amount}
            roiPct={positionRoi.pct}
            t={t}
          />

          <div
            className="dda-panel mt-4 rounded-xl px-4 py-3"
            style={{ boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${accent} 22%, transparent)` }}
          >
            <DetailRow
              label={t("pages.investments.portfolioValue")}
              value={formatPoolCurrency(value)}
            />
            {isStock && metrics ? (
              <>
                <DetailRow
                  label={t("pages.investments.stockSharesLabel")}
                  value={`${position.contracts} ${t("pages.investments.stockSharesUnit")}`}
                />
                <DetailRow
                  label={t("pages.investments.stockCostBasis")}
                  value={formatQuotePrice(
                    position.entryPrice ??
                      (position.contracts > 0 ? position.principal / position.contracts : 0),
                  )}
                />
                <DetailRow
                  label={t("pages.investments.stockLivePrice")}
                  value={quoteLoading ? "…" : formatQuotePrice(quote?.price ?? position.marketPrice ?? 0)}
                />
                {quote?.priceSource === "prev" ? (
                  <p className="pb-2 text-[11px] leading-relaxed text-amber-400/90">
                    {t("pages.investments.stockEodPriceNote")}
                  </p>
                ) : null}
                <DetailRow
                  label={t("pages.investments.stockUnrealizedPnl")}
                  value={`${gain ? "+" : ""}${formatPoolCurrency(metrics.pnl)} (${gain ? "+" : ""}${metrics.pnlPct.toFixed(2)}%)`}
                  accent={gain ? "text-dda-green-light" : "text-red-400"}
                />
              </>
            ) : (
              <>
                <DetailRow
                  label={t("pages.investments.buyTotalLabel")}
                  value={formatPoolCurrency(position.principal)}
                />
                <DetailRow
                  label={t("pages.investments.portfolioApy")}
                  value={`${position.annualYieldPct}%`}
                  accent="text-dda-green-light"
                />
                <DetailRow
                  label={t("pages.investments.portfolioMaturity")}
                  value={formatPositionMaturity(position.maturityDate)}
                />
              </>
            )}
            <DetailRow
              label={t("pages.investments.portfolioPurchased")}
              value={formatPositionMaturity(position.purchasedDate)}
            />
          </div>

          {!isStock && isFixedIncome ? (
            <p className="mt-3 text-xs leading-relaxed text-gray-500">
              {t("pages.investments.positionEarlyRedemptionNote")}
            </p>
          ) : null}

          {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
        </div>

        <div className="border-t border-white/10 px-5 py-4">
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onBuyMore(position.sleeveKey);
                }}
                className="dda-btn-primary flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-semibold"
              >
                {t("pages.investments.stockTabBuy")}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onSell) {
                    onClose();
                    onSell(position);
                    return;
                  }
                  handleSell();
                }}
                disabled={selling || (isStock && quoteLoading && !refreshing)}
                className="rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("pages.investments.stockTabSell")}
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-gray-300 transition hover:bg-white/10"
            >
              {t("common.close")}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
