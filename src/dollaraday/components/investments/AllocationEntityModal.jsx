import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPoolCurrency } from "../../data/mockData";
import {
  computeTermYieldAmount,
  computeTermYieldPercent,
  findAllocationContractTerm,
  getContractTermsForSleeve,
} from "../../lib/allocationInstruments";
import { purchasePoolAllocationOrder } from "../../lib/allocationPurchases";
import { useAllocationPositions } from "../../lib/allocationPositions";
import { resolveMemberProfileId } from "../../lib/memberAccounts";
import { formatPositionMaturity } from "../../lib/allocationSleeves";
import {
  isFixedIncomePosition,
  sellFixedIncomeAllocation,
} from "../../lib/fixedIncomeAllocations";
import { useLocale } from "../../i18n/LocaleContext";

function sanitizeMoneyInput(value) {
  const cleaned = String(value).replace(/[^0-9.]/g, "");
  const [whole, ...rest] = cleaned.split(".");
  if (!rest.length) return whole;
  return `${whole}.${rest.join("").slice(0, 2)}`;
}

function formatMoneyInput(value) {
  const sanitized = sanitizeMoneyInput(value);
  if (!sanitized) return "";

  const [wholePart, decimalPart] = sanitized.split(".");
  const wholeNumber = wholePart ? Number(wholePart) : 0;
  const formattedWhole = wholeNumber.toLocaleString("en-US");

  if (sanitized.endsWith(".")) {
    return `$${formattedWhole}.`;
  }
  if (decimalPart !== undefined) {
    return `$${formattedWhole}.${decimalPart}`;
  }
  return `$${formattedWhole}`;
}

function parseAmount(value) {
  const cleaned = String(value).replace(/[$,\s]/g, "");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function AllocationEntityModal({
  sleeve,
  open,
  availableBalance,
  onClose,
  initialMode = "buy",
  initialSellPositionId = "",
}) {
  const { t } = useLocale();
  const profileId = resolveMemberProfileId();
  const positions = useAllocationPositions(profileId);
  const [mode, setMode] = useState("buy");
  const [selectedContractId, setSelectedContractId] = useState("");
  const [price, setPrice] = useState("");
  const [sellPositionId, setSellPositionId] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const openPositions = useMemo(
    () =>
      positions.filter(
        (position) => position.sleeveKey === sleeve.id && isFixedIncomePosition(position),
      ),
    [positions, sleeve.id],
  );

  useEffect(() => {
    if (!open) return undefined;
    setMode(initialMode);
    setSelectedContractId("");
    setPrice("");
    setSellPositionId(initialSellPositionId);
    setStatus("");
    setError("");
  }, [open, sleeve.id, initialMode, initialSellPositionId]);

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

  const contractTerms = useMemo(() => getContractTermsForSleeve(sleeve.id), [sleeve.id]);
  const parsedPrice = parseAmount(price);
  const orderTotal = parsedPrice > 0 ? parsedPrice : 0;
  const selectedTerm = useMemo(
    () => findAllocationContractTerm(selectedContractId),
    [selectedContractId],
  );
  const deploymentPrincipal = orderTotal;
  const projectedRoi = useMemo(() => {
    if (!selectedTerm || deploymentPrincipal <= 0) return 0;
    return computeTermYieldAmount(deploymentPrincipal, selectedTerm);
  }, [selectedTerm, deploymentPrincipal]);
  const projectedRoiPct = selectedTerm ? computeTermYieldPercent(selectedTerm) : 0;
  const canSubmitBuy = Boolean(selectedContractId && parsedPrice > 0);

  const sellPosition = openPositions.find((position) => position.id === sellPositionId) ?? null;
  const canSubmitSell = Boolean(sellPosition);

  if (!open) return null;

  const handleContractChange = (contractId) => {
    setSelectedContractId(contractId);
    setError("");
    setStatus("");
  };

  const handlePurchase = () => {
    setError("");
    setStatus("");

    const term = findAllocationContractTerm(selectedContractId);
    if (!term) {
      setError(t("pages.investments.buySelectContract"));
      return;
    }

    const contractLabel = t(`pages.investments.${term.labelKey}`);
    const result = purchasePoolAllocationOrder({
      sleeveKey: sleeve.id,
      contractId: selectedContractId,
      contractLabel,
      contracts: 1,
      price: parsedPrice,
    });

    if (result === "invalid") {
      setError(t("pages.investments.buyInvalid"));
      return;
    }
    if (result === "insufficient") {
      setError(t("pages.investments.buyInsufficient"));
      return;
    }

    onClose();
  };

  const handleSell = () => {
    setError("");
    if (!sellPosition) return;

    const result = sellFixedIncomeAllocation(sellPosition.id);
    if (result === "not_found") {
      setError(t("pages.investments.allocationSellNotFound"));
      return;
    }
    if (result === "invalid") {
      setError(t("pages.investments.allocationSellInvalid"));
      return;
    }
    onClose();
  };

  const Icon = sleeve.icon;

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
        aria-labelledby={`buy-${sleeve.id}-title`}
        className="relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-dda-bg shadow-2xl sm:max-h-[90dvh] sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dda-accent-bar" />

        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset"
              style={{
                backgroundColor: `color-mix(in srgb, ${sleeve.accent} 14%, transparent)`,
                color: sleeve.accent,
                boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${sleeve.accent} 28%, transparent)`,
              }}
            >
              <Icon className="h-5 w-5" strokeWidth={2.25} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-dda-green-light">
                {t("pages.investments.buyAllocationsTitle")}
              </p>
              <h2 id={`buy-${sleeve.id}-title`} className="mt-1 text-lg font-semibold text-white">
                {t(`pages.investments.${sleeve.labelKey}`)}
              </h2>
              <p className="mt-1 text-sm text-gray-500">{t(`pages.investments.${sleeve.descKey}`)}</p>
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

        <div className="dda-scroll overflow-y-auto px-5 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-gray-500">
              {t("pages.investments.buyAvailable")}:{" "}
              <span className="font-semibold tabular-nums text-gray-300">
                {formatPoolCurrency(availableBalance)}
              </span>
            </p>
            <div className="flex gap-1 rounded-lg bg-black/30 p-1">
              {["buy", "sell"].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    setMode(tab);
                    setError("");
                    setStatus("");
                  }}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-semibold transition",
                    mode === tab
                      ? "bg-white/10 text-white shadow-sm"
                      : "text-gray-400 hover:text-white",
                  )}
                  style={
                    mode === tab
                      ? {
                          backgroundColor: `color-mix(in srgb, ${sleeve.accent} 18%, transparent)`,
                          color: sleeve.accent,
                        }
                      : undefined
                  }
                >
                  {t(`pages.investments.stockTab${tab === "buy" ? "Buy" : "Sell"}`)}
                </button>
              ))}
            </div>
          </div>

          {mode === "buy" ? (
            <>
              <div className="mt-4">
                <label className="block">
                  <span className="text-xs font-medium text-gray-400">
                    {t("pages.investments.buyPickContractLabel")}
                  </span>
                  <select
                    value={selectedContractId}
                    onChange={(event) => handleContractChange(event.target.value)}
                    className="dda-input dda-select mt-1.5 w-full"
                  >
                    <option value="">{t("pages.investments.buyPickContractPlaceholder")}</option>
                    {contractTerms.map((term) => (
                      <option key={term.id} value={term.id}>
                        {t(`pages.investments.${term.labelKey}`)} · {term.annualYieldPct}%
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-4">
                <label className="block">
                  <span className="text-xs font-medium text-gray-400">
                    {t("pages.investments.buyTreasuryAllocationLabel")}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={price}
                    onChange={(event) => {
                      const stripped = event.target.value.replace(/[$,\s]/g, "");
                      setPrice(stripped ? formatMoneyInput(stripped) : "");
                      setError("");
                      setStatus("");
                    }}
                    placeholder="$0.00"
                    className="dda-input mt-1.5 w-full"
                  />
                </label>
              </div>

              <div className="dda-panel mt-4 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-gray-400">{t("pages.investments.buyTotalLabel")}</span>
                  <span className="font-bold tabular-nums text-white">{formatPoolCurrency(orderTotal)}</span>
                </div>
                {selectedTerm && deploymentPrincipal > 0 ? (
                  <>
                    <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-white/10 pt-2.5 text-sm">
                      <span className="text-gray-400">{t("pages.investments.buyProjectedRoiLabel")}</span>
                      <span className="font-bold tabular-nums text-dda-green-light">
                        +{formatPoolCurrency(projectedRoi)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-gray-500">
                      {t("pages.investments.buyProjectedRoiDetail", {
                        termPct: projectedRoiPct.toFixed(2),
                        apr: selectedTerm.annualYieldPct,
                        weeks: selectedTerm.weeks,
                      })}
                    </p>
                  </>
                ) : null}
                {orderTotal > availableBalance ? (
                  <p className="mt-2 text-xs text-red-400">{t("pages.investments.buyInsufficient")}</p>
                ) : null}
              </div>
            </>
          ) : (
            <>
              {openPositions.length ? (
                <ul className="mt-4 space-y-2">
                  {openPositions.map((position) => {
                    const active = position.id === sellPositionId;
                    return (
                      <li key={position.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSellPositionId(position.id);
                            setError("");
                          }}
                          className={cn(
                            "dda-glass-btn flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left transition",
                            active && "ring-1 ring-white/15",
                          )}
                          style={
                            active
                              ? {
                                  boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${sleeve.accent} 35%, transparent)`,
                                }
                              : undefined
                          }
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-white">
                              {position.contractLabel}
                            </span>
                            <span className="mt-0.5 block text-xs text-gray-500">
                              {t("pages.investments.portfolioMaturity")}:{" "}
                              {formatPositionMaturity(position.maturityDate)}
                            </span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="block text-sm font-bold tabular-nums text-white">
                              {formatPoolCurrency(position.principal)}
                            </span>
                            <span className="mt-0.5 block text-xs font-semibold text-dda-green-light">
                              {position.annualYieldPct}% {t("pages.investments.portfolioApyShort")}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-gray-500">{t("pages.investments.allocationNoOpenPositions")}</p>
              )}

              {sellPosition ? (
                <div className="dda-panel mt-4 rounded-xl px-4 py-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-gray-400">{t("pages.investments.allocationRedemptionValue")}</span>
                    <span className="font-bold tabular-nums text-white">
                      {formatPoolCurrency(sellPosition.principal)}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    {t("pages.investments.positionEarlyRedemptionNote")}
                  </p>
                </div>
              ) : null}
            </>
          )}

          {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
          {status ? <p className="mt-3 text-sm text-dda-green-light">{status}</p> : null}
        </div>

        <div className="border-t border-white/10 px-5 py-4">
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-gray-300 transition hover:bg-white/10"
            >
              {t("common.close")}
            </button>
            {mode === "buy" ? (
              <button
                type="button"
                onClick={handlePurchase}
                disabled={!canSubmitBuy || orderTotal > availableBalance}
                className="dda-btn-primary px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("pages.investments.buySubmit")}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSell}
                disabled={!canSubmitSell}
                className="rounded-xl border border-red-400/25 bg-red-500/10 px-5 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("pages.investments.allocationSellPosition")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
