import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, ExternalLink, Wallet, X } from "lucide-react";
import { ZELLE_LOGO_URL, ZELLE_URL } from "@/lib/assetUrl";
import { lockBodyScroll } from "@/lib/modalBodyLock";
import { cn } from "@/lib/utils";
import { useDadAuth } from "../../context/DadAuthContext.jsx";
import { useLocale } from "../../i18n/LocaleContext";
import { getMemberCashBalance, reinvestFromCashBalance } from "../../lib/cashReinvest";
import {
  getDatabaseRevision,
  subscribeInternalDatabase,
} from "../../lib/internalDatabase";
import { formatPoolCurrency } from "../../data/mockData";

export const ZELLE_PAY_EMAIL = "reppmio@gmail.com";

const AMOUNT_PRESETS = [
  { id: "weekly", amount: 7, label: "$7" },
  { id: "monthly", amount: 31, label: "$31" },
  { id: "yearly", amount: 365, label: "$365" },
];

function getProfileFullName(profile) {
  if (!profile) return "";
  return profile.fullName?.trim() || profile.displayName?.trim() || "";
}

function sanitizeMoneyInput(value) {
  const cleaned = String(value).replace(/[^0-9.]/g, "");
  const [whole, ...rest] = cleaned.split(".");
  if (!rest.length) return whole;
  return `${whole}.${rest.join("").slice(0, 2)}`;
}

function formatUsd(amount) {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function formatUsdFixed(amount) {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function ZellePayModal({ open, onClose, initialAmount = 7 }) {
  const { t } = useLocale();
  const { profile } = useDadAuth();
  const memberName = getProfileFullName(profile);
  const [presetId, setPresetId] = useState("weekly");
  const [customAmount, setCustomAmount] = useState(String(AMOUNT_PRESETS[0].amount));
  const [copiedTarget, setCopiedTarget] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitNote, setSubmitNote] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [fundingSource, setFundingSource] = useState("external");
  const dbRevision = useSyncExternalStore(
    subscribeInternalDatabase,
    getDatabaseRevision,
    () => 0,
  );
  const cashBalance = useMemo(() => {
    void dbRevision;
    return getMemberCashBalance(profile?.id);
  }, [profile?.id, dbRevision, open]);

  useEffect(() => {
    if (!open) return undefined;
    const unlock = lockBodyScroll();
    return () => {
      unlock();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    setCopiedTarget(null);
    setSubmitNote("");
    setSubmitError("");
    setSubmitting(false);
    setFundingSource("external");
    const seed = Number(initialAmount);
    const match = AMOUNT_PRESETS.find((preset) => Math.abs(preset.amount - seed) < 0.001);
    if (match) {
      setPresetId(match.id);
      setCustomAmount(String(match.amount));
      return;
    }
    if (Number.isFinite(seed) && seed > 0) {
      setPresetId("custom");
      setCustomAmount(sanitizeMoneyInput(String(seed)));
      return;
    }
    setPresetId("weekly");
    setCustomAmount(String(AMOUNT_PRESETS[0].amount));
  }, [open, initialAmount]);

  useEffect(() => {
    if (!copiedTarget) return undefined;
    const timer = window.setTimeout(() => setCopiedTarget(null), 2000);
    return () => window.clearTimeout(timer);
  }, [copiedTarget]);

  useEffect(() => {
    if (cashBalance > 0.001) return;
    if (fundingSource === "cash") setFundingSource("external");
  }, [cashBalance, fundingSource]);

  const amount = useMemo(() => {
    const parsed = Number.parseFloat(customAmount);
    if (Number.isFinite(parsed)) return parsed;
    if (presetId === "custom") return 0;
    return AMOUNT_PRESETS.find((preset) => preset.id === presetId)?.amount ?? 0;
  }, [presetId, customAmount]);

  const useCash = fundingSource === "cash";
  const safeAmount = Math.max(amount, 0) || 0;
  const cappedAmount =
    useCash && cashBalance > 0 ? Math.min(safeAmount, cashBalance) : safeAmount;
  const formattedAmount = formatUsd(cappedAmount);
  const formattedAmountFixed = formatUsdFixed(cappedAmount);
  const canCopyMemo = cappedAmount > 0;
  const canSubmit =
    cappedAmount > 0 && (!useCash || (cashBalance > 0 && cappedAmount <= cashBalance + 0.001));

  const fillCashAll = () => {
    if (cashBalance <= 0) return;
    setFundingSource("cash");
    setPresetId("custom");
    setCustomAmount(sanitizeMoneyInput(cashBalance.toFixed(2)));
    setSubmitError("");
  };

  const applyAmount = (raw) => {
    let next = sanitizeMoneyInput(raw);
    const parsed = Number.parseFloat(next);
    if (useCash && Number.isFinite(parsed) && parsed > cashBalance) {
      next = sanitizeMoneyInput(cashBalance.toFixed(2));
    }
    setCustomAmount(next);
    const capped = Number.parseFloat(next);
    const match = AMOUNT_PRESETS.find(
      (preset) => Number.isFinite(capped) && Math.abs(preset.amount - capped) < 0.001,
    );
    setPresetId(match?.id ?? "custom");
  };

  const memoMessage = useMemo(() => {
    if (memberName) {
      return t("contribute.zellePayBodyNamed", {
        amount: formattedAmountFixed,
        name: memberName,
      });
    }
    return t("contribute.zellePayBody", { amount: formattedAmountFixed });
  }, [formattedAmountFixed, memberName, t]);

  const copyText = async (value, target) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedTarget(target);
    } catch {
      setCopiedTarget(null);
    }
  };

  const handleCopyEmail = () => {
    void copyText(ZELLE_PAY_EMAIL, "email");
  };

  const handleCopyMemo = () => {
    if (!canCopyMemo) return;
    void copyText(memoMessage, "memo");
  };

  const handleNotifyAndCopy = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setSubmitError("");
    setSubmitNote("");
    try {
      if (useCash) {
        const result = reinvestFromCashBalance({
          amount: cappedAmount,
          method: "zelle",
          memo: memoMessage,
        });
        if (!result.ok) {
          setSubmitError(
            result.error === "insufficient"
              ? t("contribute.cashReinvestInsufficient")
              : t("contribute.cashReinvestFailed"),
          );
          return;
        }
        const remaining = Number(result.balance) || 0;
        if (remaining <= 0.001) {
          setFundingSource("external");
          setSubmitNote(
            t("contribute.cashReinvestSuccessEmpty", {
              amount: formatUsdFixed(cappedAmount),
            }),
          );
        } else {
          setSubmitNote(
            t("contribute.cashReinvestSuccess", {
              amount: formatUsdFixed(cappedAmount),
            }),
          );
        }
        window.setTimeout(() => onClose?.(), 1200);
        return;
      }

      const { requestExternalPayment } = await import("../../lib/externalPaymentRequests");
      const result = await requestExternalPayment({
        method: "zelle",
        amount: cappedAmount,
        memo: memoMessage,
        profile,
      });
      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }
      setSubmitNote(t("contribute.paymentRequestSent"));
      await copyText(ZELLE_PAY_EMAIL, "email");
      window.setTimeout(() => onClose?.(), 1200);
    } catch (err) {
      console.warn("[ZellePayModal] Payment request failed:", err);
      setSubmitError(
        useCash ? t("contribute.cashReinvestFailed") : t("contribute.paymentRequestFailed"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label={t("common.close")}
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="zelle-pay-title"
        className="dda-zelle-pay relative flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-dda-bg shadow-2xl sm:max-h-[90dvh] sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dda-accent-bar" />

        <div className="shrink-0 flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <img
                src={ZELLE_LOGO_URL}
                alt=""
                draggable={false}
                className="dda-zelle-pay__logo"
              />
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#c4b5fd]">
                {t("contribute.zellePayKicker")}
              </p>
            </div>
            <h2 id="zelle-pay-title" className="mt-2 text-xl font-semibold text-white">
              {t("contribute.zellePayTitle")}
            </h2>
            <p className="mt-1 text-sm text-gray-400">{t("contribute.zellePaySub")}</p>
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

        <div className="dda-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6">
          <ol className="dda-zelle-pay__steps" aria-label={t("contribute.zellePayStepsLabel")}>
            <li>{t("contribute.zellePayStep1")}</li>
            <li>{t("contribute.zellePayStep2")}</li>
            <li>{t("contribute.zellePayStep3")}</li>
          </ol>

          {/* Hero email copy — same overlay pattern as Apple Pay paste prompt */}
          <div className="dda-zelle-pay__email-card mt-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#c4b5fd]">
                  {t("contribute.zellePayTo")}
                </p>
                <p className="dda-zelle-pay__email-value mt-2" aria-live="polite">
                  {ZELLE_PAY_EMAIL}
                </p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-gray-400">
                  {t("contribute.zellePayEmailHint")}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopyEmail}
                className="dda-zelle-pay__copy"
                aria-label={t("contribute.zellePayCopyEmailAria")}
              >
                {copiedTarget === "email" ? (
                  <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
                ) : (
                  <Copy className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
                )}
                {copiedTarget === "email"
                  ? t("contribute.zellePayCopied")
                  : t("contribute.zellePayCopy")}
              </button>
            </div>
          </div>

          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
            {t("contribute.amountLabel")}
          </p>

          <div className="mt-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  {t("contribute.cashBalanceLabel")}
                </p>
                <p className="mt-0.5 text-sm font-bold tabular-nums text-[#fde68a]">
                  {formatPoolCurrency(cashBalance)}
                </p>
              </div>
              <button
                type="button"
                disabled={cashBalance <= 0}
                onClick={fillCashAll}
                className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-[#c4b5fd] ring-1 ring-white/10 transition hover:bg-white/5 disabled:opacity-40"
              >
                {t("contribute.cashUseAll")}
              </button>
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-2" role="group" aria-label={t("contribute.fundingSourceLabel")}>
              <button
                type="button"
                onClick={() => setFundingSource("external")}
                className={cn(
                  "rounded-xl border px-3 py-2 text-center text-xs font-semibold transition",
                  !useCash
                    ? "border-[#6d1ed4]/60 bg-[#6d1ed4]/20 text-white"
                    : "border-white/10 bg-white/[0.03] text-gray-300 hover:border-white/20",
                )}
              >
                {t("contribute.fundingExternalZelle")}
              </button>
              <button
                type="button"
                disabled={cashBalance <= 0}
                onClick={() => {
                  setFundingSource("cash");
                  if (amount > cashBalance) {
                    applyAmount(cashBalance.toFixed(2));
                  }
                }}
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-center text-xs font-semibold transition disabled:opacity-40",
                  useCash
                    ? "border-[#6d1ed4]/60 bg-[#6d1ed4]/20 text-white"
                    : "border-white/10 bg-white/[0.03] text-gray-300 hover:border-white/20",
                )}
              >
                <Wallet className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
                {t("contribute.fundingCash")}
              </button>
            </div>
            {cashBalance <= 0 ? (
              <p
                className="mt-2 rounded-xl border border-[#fde68a]/25 bg-[#fde68a]/10 px-3 py-2 text-[11px] leading-relaxed text-[#fde68a]"
                role="status"
              >
                {t("contribute.cashBalanceEmptyPrompt")}
              </p>
            ) : (
              <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
                {useCash
                  ? t("contribute.cashReinvestHint")
                  : t("contribute.paymentRequestHint")}
              </p>
            )}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label={t("contribute.amountTitle")}>
            {AMOUNT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  setPresetId(preset.id);
                  applyAmount(String(preset.amount));
                }}
                className={cn(
                  "rounded-xl border px-3 py-3 text-center transition",
                  presetId === preset.id
                    ? "border-[#6d1ed4]/60 bg-[#6d1ed4]/20 text-white"
                    : "border-white/10 bg-white/[0.03] text-gray-300 hover:border-white/20",
                )}
              >
                <span className="block text-lg font-bold tabular-nums">{preset.label}</span>
              </button>
            ))}
          </div>

          <label className="mt-4 block">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
              {t("contribute.customAmount")}
            </span>
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 focus-within:border-[#6d1ed4]/50">
              <span className="text-gray-400" aria-hidden="true">
                $
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={customAmount}
                placeholder="0.00"
                onChange={(event) => applyAmount(event.target.value)}
                className="w-full bg-transparent text-base font-semibold tabular-nums text-white outline-none placeholder:text-gray-600"
              />
            </div>
          </label>

          <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                  {t("contribute.zellePayPreview")}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-300">
                  {canCopyMemo ? memoMessage : t("contribute.zellePayMemoEmpty")}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopyMemo}
                disabled={!canCopyMemo}
                className="dda-zelle-pay__copy"
                aria-label={t("contribute.zellePayCopyMemoAria")}
              >
                {copiedTarget === "memo" ? (
                  <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
                ) : (
                  <Copy className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
                )}
                {copiedTarget === "memo"
                  ? t("contribute.zellePayCopied")
                  : t("contribute.zellePayCopyMemo")}
              </button>
            </div>
          </div>

          <p className="mt-4 text-center text-[11px] leading-relaxed text-gray-500">
            {useCash ? t("contribute.cashReinvestHint") : t("contribute.zellePayHint")}
          </p>
          {!useCash ? (
            <p className="mt-1.5 text-center text-[11px] leading-relaxed text-gray-500">
              {t("contribute.paymentRequestHint")}
            </p>
          ) : null}
        </div>

        <div className="dda-zelle-pay__footer shrink-0 border-t border-white/10 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {submitError ? (
            <p className="mb-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {submitError}
            </p>
          ) : null}
          {submitNote ? (
            <p className="mb-2 rounded-lg border border-dda-green/30 bg-dda-green/10 px-3 py-2 text-xs text-dda-green-light">
              {submitNote}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => {
              void handleNotifyAndCopy();
            }}
            disabled={!canSubmit || submitting}
            aria-busy={submitting}
            className="dda-zelle-pay__cta disabled:pointer-events-none disabled:opacity-60"
          >
            <img
              src={ZELLE_LOGO_URL}
              alt=""
              draggable={false}
              className="dda-zelle-pay__cta-logo"
            />
            <span>
              {submitting
                ? useCash
                  ? t("contribute.cashReinvestSending")
                  : t("contribute.paymentRequestSending")
                : useCash
                  ? t("contribute.cashReinvestCta", { amount: formattedAmount })
                  : copiedTarget === "email"
                    ? t("contribute.zellePayCtaCopied")
                    : t("contribute.zellePayCta", { amount: formattedAmount })}
            </span>
          </button>
          {!useCash ? (
            <a
              href={ZELLE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="dda-zelle-pay__secondary"
            >
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
              {t("contribute.zellePayOpenSite")}
            </a>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
