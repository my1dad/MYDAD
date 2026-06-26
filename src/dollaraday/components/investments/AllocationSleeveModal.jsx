import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, Waves, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProgressBar } from "../layout/DashboardCard";
import { formatPoolCurrency } from "../../data/mockData";
import { useLocale } from "../../i18n/LocaleContext";
import { formatPositionMaturity, ALLOCATION_SLEEVE_META } from "../../lib/allocationSleeves";
import { getSleeveRoi } from "../../lib/allocationRoi";
import AllocationStatsGrid from "./AllocationStatsGrid";
import { isStockPosition } from "../../lib/stockAllocations";
import { computeStockPositionMetrics, formatQuotePrice } from "../../lib/massiveMarket";

const SLEEVE_LABEL_KEYS = {
  treasury: "buyTreasury",
  bonds: "buyBonds",
  stocks: "buyStocks",
};

const riskStyles = {
  Low: "bg-dda-green/15 text-dda-green-light ring-dda-green/25",
  Medium: "bg-dda-gold/15 text-dda-gold-light ring-dda-gold/25",
  High: "bg-red-500/15 text-red-400 ring-red-500/25",
};

export default function AllocationSleeveModal({
  investment,
  positions,
  open,
  accent,
  onClose,
  onPositionClick,
  onBuy,
  onSell,
}) {
  const { t } = useLocale();

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

  if (!open || !investment) return null;

  const sleeveKey = investment.key;
  const sleeveRoi = getSleeveRoi(positions);
  const liquidityLabel = t(
    `liquidity.${ALLOCATION_SLEEVE_META[sleeveKey]?.liquidity ?? "Medium"}`,
  );

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
        aria-labelledby="allocation-sleeve-title"
        className="relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-dda-bg shadow-2xl sm:max-h-[90dvh] sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dda-accent-bar" />

        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset"
              style={{
                backgroundColor: `color-mix(in srgb, ${accent} 14%, transparent)`,
                color: accent,
                boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${accent} 28%, transparent)`,
              }}
            >
              <Waves className="h-5 w-5" strokeWidth={2.25} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-dda-green-light">
                {t("investmentChart.capitalMix")}
              </p>
              <h2 id="allocation-sleeve-title" className="mt-1 text-lg font-semibold text-white">
                {investment.name}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {t(`pages.investments.${SLEEVE_LABEL_KEYS[sleeveKey] ?? "buyTreasury"}`)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="dda-scroll overflow-y-auto px-5 py-4">
          <p className="text-sm leading-relaxed text-gray-400">{investment.description}</p>

          <div className="mt-4">
            <AllocationStatsGrid
              allocated={investment.allocated}
              apy={investment.returnPct}
              liquidity={liquidityLabel}
              roiAmount={sleeveRoi.amount}
              roiPct={sleeveRoi.pct}
              t={t}
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span
              className={cn(
                "inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset",
                riskStyles[investment.riskKey] ?? riskStyles.Low,
              )}
            >
              {t("investmentChart.riskBadge", { risk: investment.risk })}
            </span>
            <span className="inline-flex rounded-full bg-white/5 px-2.5 py-0.5 text-[10px] font-semibold text-gray-300 ring-1 ring-white/10">
              {investment.category}
            </span>
            <span className="inline-flex rounded-full bg-dda-green/10 px-2.5 py-0.5 text-[10px] font-semibold text-dda-green-light ring-1 ring-dda-green/20">
              {investment.status}
            </span>
          </div>

          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs text-gray-500">
              <span>{t("investmentChart.poolShare")}</span>
              <span className="font-semibold text-white">{investment.percent}%</span>
            </div>
            <ProgressBar value={investment.percent} />
          </div>

          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
              {t("pages.investments.sleeveAllocations")}
            </p>
            {positions.length ? (
              <ul className="space-y-2">
                {positions.map((position) => {
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
                        onClick={() => onPositionClick(position)}
                        className="dda-glass-btn flex w-full items-start justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition hover:border-white/15"
                        style={{
                          boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${accent} 18%, transparent)`,
                        }}
                      >
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
                        <div className="flex shrink-0 items-center gap-2">
                          <div className="text-right">
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
                          <ChevronRight className="h-4 w-4 text-gray-600" aria-hidden />
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed border-white/10 px-4 py-5 text-center text-sm text-gray-500">
                {t("pages.investments.noSleeveAllocations")}
              </p>
            )}
          </div>
        </div>

        <div className="border-t border-white/10 px-5 py-4">
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onBuy(sleeveKey);
                }}
                className="dda-btn-primary flex items-center justify-center px-3 py-2.5 text-sm font-semibold"
              >
                {t("pages.investments.stockTabBuy")}
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSell(sleeveKey);
                }}
                className="rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/20"
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
