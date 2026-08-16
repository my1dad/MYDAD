import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, ExternalLink, X } from "lucide-react";
import { ZELLE_LOGO_URL, ZELLE_URL } from "@/lib/assetUrl";
import { lockBodyScroll } from "@/lib/modalBodyLock";
import { cn } from "@/lib/utils";
import { useDadAuth } from "../../context/DadAuthContext.jsx";
import { useLocale } from "../../i18n/LocaleContext";

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

  const safeAmount = Math.max(amount, 0) || 0;
  const formattedAmount = formatUsd(safeAmount);
  const formattedAmountFixed = formatUsdFixed(safeAmount);
  const canCopyMemo = amount > 0;

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

  const canSubmit = amount > 0;

  const handleNotifyAndCopy = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setSubmitError("");
    setSubmitNote("");
    try {
      const { requestExternalPayment } = await import("../../lib/externalPaymentRequests");
      const result = await requestExternalPayment({
        method: "zelle",
        amount: safeAmount,
        memo: memoMessage,
        profile,
      });
      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }
      setSubmitNote(t("contribute.paymentRequestSent"));
      await copyText(ZELLE_PAY_EMAIL, "email");
    } catch (err) {
      console.warn("[ZellePayModal] Payment request failed:", err);
      setSubmitError(t("contribute.paymentRequestFailed"));
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

        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
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

        <div className="dda-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-5">
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
          <div className="mt-2 grid grid-cols-3 gap-2" role="group" aria-label={t("contribute.amountTitle")}>
            {AMOUNT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  setPresetId(preset.id);
                  setCustomAmount(String(preset.amount));
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
                onChange={(event) => {
                  const next = sanitizeMoneyInput(event.target.value);
                  setCustomAmount(next);
                  const parsed = Number.parseFloat(next);
                  const match = AMOUNT_PRESETS.find(
                    (preset) => Number.isFinite(parsed) && Math.abs(preset.amount - parsed) < 0.001,
                  );
                  setPresetId(match?.id ?? "custom");
                }}
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
                ? t("contribute.paymentRequestSending")
                : copiedTarget === "email"
                  ? t("contribute.zellePayCtaCopied")
                  : t("contribute.zellePayCta", { amount: formattedAmount })}
            </span>
          </button>
          <a
            href={ZELLE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="dda-zelle-pay__secondary"
          >
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
            {t("contribute.zellePayOpenSite")}
          </a>
          <p className="mt-2.5 text-center text-[11px] leading-relaxed text-gray-500">
            {t("contribute.zellePayHint")}
          </p>
          <p className="mt-1.5 text-center text-[11px] leading-relaxed text-gray-500">
            {t("contribute.paymentRequestHint")}
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
