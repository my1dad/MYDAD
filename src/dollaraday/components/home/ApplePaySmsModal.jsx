import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, X } from "lucide-react";
import { APPLE_PAY_LOGO_URL } from "@/lib/assetUrl";
import { lockBodyScroll } from "@/lib/modalBodyLock";
import { cn } from "@/lib/utils";
import { useDadAuth } from "../../context/DadAuthContext.jsx";
import { useLocale } from "../../i18n/LocaleContext";

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

/** Build a cross-platform sms: URL with a prefilled Apple Cash request body. */
export function buildApplePaySmsHref(phoneE164, message) {
  const digits = String(phoneE164).replace(/[^\d+]/g, "");
  const body = encodeURIComponent(message);
  const isApple = typeof navigator !== "undefined" && /iPhone|iPad|iPod/i.test(navigator.userAgent);
  return `sms:${digits}${isApple ? "&" : "?"}body=${body}`;
}

export default function ApplePaySmsModal({ open, onClose, initialAmount = 7 }) {
  const { t } = useLocale();
  const { profile } = useDadAuth();
  const memberName = getProfileFullName(profile);
  const [presetId, setPresetId] = useState("weekly");
  const [customAmount, setCustomAmount] = useState(String(AMOUNT_PRESETS[0].amount));
  const [copied, setCopied] = useState(false);

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
    setCopied(false);
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
    if (!copied) return undefined;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const amount = useMemo(() => {
    const parsed = Number.parseFloat(customAmount);
    if (Number.isFinite(parsed)) return parsed;
    if (presetId === "custom") return 0;
    return AMOUNT_PRESETS.find((preset) => preset.id === presetId)?.amount ?? 0;
  }, [presetId, customAmount]);

  const formattedAmount = formatUsd(Math.max(amount, 0) || 0);

  const smsMessage = useMemo(() => {
    if (memberName) {
      return t("contribute.applePaySmsBodyNamed", {
        amount: formattedAmount,
        name: memberName,
      });
    }
    return t("contribute.applePaySmsBody", { amount: formattedAmount });
  }, [formattedAmount, memberName, t]);

  const smsHref = useMemo(
    () => buildApplePaySmsHref(APPLE_PAY_SMS_PHONE, smsMessage),
    [smsMessage],
  );

  const handleCopyPhone = async () => {
    try {
      await navigator.clipboard.writeText(APPLE_PAY_SMS_PHONE);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  if (!open || typeof document === "undefined") return null;

  const canSend = amount > 0;

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

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
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
                {copied ? (
                  <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
                ) : (
                  <Copy className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
                )}
                {copied ? t("contribute.applePaySmsCopied") : t("contribute.applePaySmsCopy")}
              </button>
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
              {t("contribute.applePaySmsPreview")}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-gray-300">{smsMessage}</p>
          </div>
        </div>

        <div className="border-t border-white/10 px-5 py-4">
          <a
            href={canSend ? smsHref : undefined}
            aria-disabled={!canSend}
            onClick={(event) => {
              if (!canSend) {
                event.preventDefault();
                return;
              }
              window.setTimeout(() => onClose?.(), 250);
            }}
            className={cn("dda-apple-pay-sms__cta", !canSend && "dda-apple-pay-sms__cta--disabled")}
          >
            <img
              src={APPLE_PAY_LOGO_URL}
              alt=""
              draggable={false}
              className="dda-apple-pay-sms__cta-logo"
            />
            <span>{t("contribute.applePaySmsCta", { amount: formattedAmount })}</span>
          </a>
          <p className="mt-2.5 text-center text-[11px] leading-relaxed text-gray-500">
            {t("contribute.applePaySmsHint")}
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
