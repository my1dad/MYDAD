import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Wallet, X } from "lucide-react";
import { APPLE_PAY_LOGO_URL } from "@/lib/assetUrl";
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

export const APPLE_PAY_SMS_PHONE = "+15613379411";
export const APPLE_PAY_SMS_PHONE_DISPLAY = "+1 (561) 337-9411";

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

/** Always show cents so Apple Cash paste stays unambiguous (send $7.00). */
function formatUsdFixed(amount) {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function isAppleMobile() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/** Digits only, US country code kept (e.g. 15613379411). */
export function normalizeSmsPhoneDigits(phoneE164) {
  const digits = String(phoneE164 ?? "").replace(/\D/g, "");
  if (digits.length === 10) return `1${digits}`;
  return digits;
}

/**
 * Build a cross-platform sms: URL with recipient + prefilled Apple Cash body.
 * iOS: sms:/open?addresses=...&body= (most reliable for Messages compose)
 * Android/other: sms:+E164?body=
 */
export function buildApplePaySmsHref(phoneE164, message) {
  const digits = normalizeSmsPhoneDigits(phoneE164);
  const body = encodeURIComponent(String(message ?? ""));
  if (!digits) return `sms:?body=${body}`;
  if (isAppleMobile()) {
    return `sms:/open?addresses=${digits}&body=${body}`;
  }
  return `sms:+${digits}?body=${body}`;
}

/** Open Messages with the compose deep link; falls back to window.open. */
export function launchApplePaySms(smsHref) {
  if (!smsHref || typeof window === "undefined") return false;
  try {
    window.location.assign(smsHref);
    return true;
  } catch {
    try {
      window.open(smsHref, "_blank");
      return true;
    } catch {
      return false;
    }
  }
}

export default function ApplePaySmsModal({ open, onClose, initialAmount = 7 }) {
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

  /** Short paste prompt for Apple Cash — e.g. "send $7.00" */
  const pastePrompt = useMemo(
    () => t("contribute.applePaySmsPastePrompt", { amount: formattedAmountFixed }),
    [formattedAmountFixed, t],
  );

  const smsMessage = useMemo(() => {
    if (memberName) {
      return t("contribute.applePaySmsBodyNamed", {
        amount: formattedAmountFixed,
        name: memberName,
      });
    }
    return t("contribute.applePaySmsBody", { amount: formattedAmountFixed });
  }, [formattedAmountFixed, memberName, t]);

  const smsHref = useMemo(
    () => buildApplePaySmsHref(APPLE_PAY_SMS_PHONE, pastePrompt),
    [pastePrompt],
  );

  const copyText = async (value, target) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedTarget(target);
    } catch {
      setCopiedTarget(null);
    }
  };

  const handleCopyPhone = () => {
    void copyText(APPLE_PAY_SMS_PHONE, "phone");
  };

  const handleCopyPrompt = () => {
    if (!(cappedAmount > 0)) return;
    void copyText(pastePrompt, "prompt");
  };

  const canSend =
    cappedAmount > 0 && (!useCash || (cashBalance > 0 && cappedAmount <= cashBalance + 0.001));

  const handleLaunchSms = async (event) => {
    event.preventDefault();
    if (!canSend || submitting) return;
    setSubmitting(true);
    setSubmitError("");
    setSubmitNote("");
    try {
      if (useCash) {
        const result = reinvestFromCashBalance({
          amount: cappedAmount,
          method: "apple-pay",
          memo: smsMessage,
        });
        if (!result.ok) {
          setSubmitError(
            result.error === "insufficient"
              ? t("contribute.cashReinvestInsufficient")
              : t("contribute.cashReinvestFailed"),
          );
          return;
        }
        setSubmitNote(
          t("contribute.cashReinvestSuccess", {
            amount: formatUsdFixed(cappedAmount),
          }),
        );
        window.setTimeout(() => onClose?.(), 650);
        return;
      }

      const { requestExternalPayment } = await import("../../lib/externalPaymentRequests");
      const result = await requestExternalPayment({
        method: "apple-pay",
        amount: cappedAmount,
        memo: smsMessage,
        profile,
      });
      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }
      setSubmitNote(t("contribute.paymentRequestSent"));
    } catch (err) {
      console.warn("[ApplePaySmsModal] Payment request failed:", err);
      setSubmitError(
        useCash ? t("contribute.cashReinvestFailed") : t("contribute.paymentRequestFailed"),
      );
      return;
    } finally {
      setSubmitting(false);
    }
    // Copy prompt first so members can paste into Apple Cash if the sheet opens manually.
    void navigator.clipboard?.writeText?.(pastePrompt).catch(() => {});
    launchApplePaySms(smsHref);
    window.setTimeout(() => onClose?.(), 450);
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
        aria-labelledby="apple-pay-sms-title"
        className="dda-apple-pay-sms relative flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-dda-bg shadow-2xl sm:max-h-[90dvh] sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dda-accent-bar" />

        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <img
                src={APPLE_PAY_LOGO_URL}
                alt=""
                draggable={false}
                className="dda-apple-pay-sms__logo"
              />
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-dda-green-light">
                {t("contribute.applePaySmsKicker")}
              </p>
            </div>
            <h2 id="apple-pay-sms-title" className="mt-2 text-xl font-semibold text-white">
              {t("contribute.applePaySmsTitle")}
            </h2>
            <p className="mt-1 text-sm text-gray-400">{t("contribute.applePaySmsSub")}</p>
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

        <div className="dda-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          <ol className="dda-apple-pay-sms__steps" aria-label={t("contribute.applePaySmsStepsLabel")}>
            <li>{t("contribute.applePaySmsStep1")}</li>
            <li>{t("contribute.applePaySmsStep2")}</li>
            <li>{t("contribute.applePaySmsStep3")}</li>
          </ol>

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
                className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-dda-green-light ring-1 ring-white/10 transition hover:bg-white/5 disabled:opacity-40"
              >
                {t("contribute.cashUseAll")}
              </button>
            </div>
            <div
              className="mt-2.5 grid grid-cols-2 gap-2"
              role="group"
              aria-label={t("contribute.fundingSourceLabel")}
            >
              <button
                type="button"
                onClick={() => setFundingSource("external")}
                className={cn(
                  "rounded-xl border px-3 py-2 text-center text-xs font-semibold transition",
                  !useCash
                    ? "border-dda-green/50 bg-dda-green/15 text-white"
                    : "border-white/10 bg-white/[0.03] text-gray-300 hover:border-white/20",
                )}
              >
                {t("contribute.fundingExternalApplePay")}
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
                    ? "border-dda-green/50 bg-dda-green/15 text-white"
                    : "border-white/10 bg-white/[0.03] text-gray-300 hover:border-white/20",
                )}
              >
                <Wallet className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
                {t("contribute.fundingCash")}
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
              {useCash
                ? t("contribute.cashReinvestHint")
                : t("contribute.paymentRequestHint")}
            </p>
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
                    ? "border-dda-green/50 bg-dda-green/15 text-white"
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
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 focus-within:border-dda-green/40">
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

          {!useCash ? (
          <div className="mt-5 rounded-2xl border border-dda-green/30 bg-dda-green/10 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-dda-green-light">
                  {t("contribute.applePaySmsPasteLabel")}
                </p>
                <p className="dda-apple-pay-sms__paste-prompt mt-2" aria-live="polite">
                  {canSend ? pastePrompt : t("contribute.applePaySmsPasteEmpty")}
                </p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-gray-400">
                  {t("contribute.applePaySmsPasteHint")}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopyPrompt}
                disabled={!canSend}
                className="dda-apple-pay-sms__copy"
                aria-label={t("contribute.applePaySmsCopyPromptAria")}
              >
                {copiedTarget === "prompt" ? (
                  <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
                ) : (
                  <Copy className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
                )}
                {copiedTarget === "prompt"
                  ? t("contribute.applePaySmsCopied")
                  : t("contribute.applePaySmsCopy")}
              </button>
            </div>
          </div>
          ) : null}

          {!useCash ? (
          <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                  {t("contribute.applePaySmsTo")}
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-white">
                  {APPLE_PAY_SMS_PHONE_DISPLAY}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopyPhone}
                className="dda-apple-pay-sms__copy"
                aria-label={t("contribute.applePaySmsCopyAria")}
              >
                {copiedTarget === "phone" ? (
                  <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
                ) : (
                  <Copy className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
                )}
                {copiedTarget === "phone"
                  ? t("contribute.applePaySmsCopied")
                  : t("contribute.applePaySmsCopy")}
              </button>
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
              {t("contribute.applePaySmsPreview")}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-gray-300">{smsMessage}</p>
          </div>
          ) : null}
        </div>

        <div className="border-t border-white/10 px-5 py-4">
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
          {useCash ? (
            <button
              type="button"
              disabled={!canSend || submitting}
              aria-busy={submitting}
              onClick={(event) => {
                void handleLaunchSms(event);
              }}
              className={cn(
                "dda-apple-pay-sms__cta w-full",
                (!canSend || submitting) && "dda-apple-pay-sms__cta--disabled",
              )}
            >
              <Wallet className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
              <span>
                {submitting
                  ? t("contribute.cashReinvestSending")
                  : t("contribute.cashReinvestCta", { amount: formattedAmount })}
              </span>
            </button>
          ) : (
            <a
              href={canSend && !submitting ? smsHref : undefined}
              role="button"
              aria-disabled={!canSend || submitting}
              aria-busy={submitting}
              onClick={(event) => {
                void handleLaunchSms(event);
              }}
              className={cn(
                "dda-apple-pay-sms__cta",
                (!canSend || submitting) && "dda-apple-pay-sms__cta--disabled",
              )}
            >
              <img
                src={APPLE_PAY_LOGO_URL}
                alt=""
                draggable={false}
                className="dda-apple-pay-sms__cta-logo"
              />
              <span>
                {submitting
                  ? t("contribute.paymentRequestSending")
                  : t("contribute.applePaySmsCta", { amount: formattedAmount })}
              </span>
            </a>
          )}
          <p className="mt-2.5 text-center text-[11px] leading-relaxed text-gray-500">
            {useCash ? t("contribute.cashReinvestHint") : t("contribute.applePaySmsHint")}
          </p>
          {!useCash ? (
            <p className="mt-1.5 text-center text-[11px] leading-relaxed text-gray-500">
              {t("contribute.paymentRequestHint")}
            </p>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
