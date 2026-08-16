import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Banknote, X } from "lucide-react";
import { lockBodyScroll } from "@/lib/modalBodyLock";
import { formatPoolCurrency } from "../../data/mockData";
import { useLocale } from "../../i18n/LocaleContext";
import { requestMemberRedemption } from "../../lib/memberRedemptionRequests";

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

  if (sanitized.endsWith(".")) return `$${formattedWhole}.`;
  if (decimalPart !== undefined) return `$${formattedWhole}.${decimalPart}`;
  return `$${formattedWhole}`;
}

function parseAmount(value) {
  const cleaned = String(value).replace(/[$,\s]/g, "");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function MemberRedemptionRequestModal({
  open,
  onClose,
  availableBalance = 0,
  cashBalance = 0,
}) {
  const { t } = useLocale();
  // Available to redeem = invested equity. ALL + submit cap use this.
  const maxAmount = Math.max(0, Number(availableBalance) || 0);
  const cash = Math.max(0, Number(cashBalance) || 0);

  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    return lockBodyScroll();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    setAmount("");
    setError("");
    setBusy(false);
    return undefined;
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      onClose?.();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open, onClose]);

  const parsed = useMemo(() => parseAmount(amount), [amount]);

  if (!open) return null;

  const applyAmount = (raw) => {
    const stripped = String(raw).replace(/[$,\s]/g, "");
    if (!stripped) {
      setAmount("");
      return;
    }
    const parsedValue = Number.parseFloat(stripped);
    if (Number.isFinite(parsedValue) && parsedValue > maxAmount + 0.001) {
      setAmount(formatMoneyInput(maxAmount.toFixed(2)));
      return;
    }
    setAmount(formatMoneyInput(stripped));
  };

  const fillAll = () => {
    if (maxAmount <= 0) {
      setError(t("pages.dashboard.redemptionRequestNoBalance"));
      return;
    }
    setError("");
    setAmount(formatMoneyInput(maxAmount.toFixed(2)));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setError("");

    let next = parseAmount(amount);
    if (next <= 0) {
      setError(t("pages.accounts.amountRequired"));
      return;
    }
    if (next > maxAmount + 0.001) {
      next = maxAmount;
      setAmount(formatMoneyInput(maxAmount.toFixed(2)));
    }
    if (next <= 0 || maxAmount <= 0) {
      setError(t("pages.dashboard.redemptionRequestNoBalance"));
      return;
    }

    setBusy(true);
    const result = requestMemberRedemption({
      amount: next,
      availableBalance: maxAmount,
    });
    setBusy(false);

    if (!result.ok) {
      setError(
        result.error === "insufficient"
          ? t("pages.dashboard.redemptionRequestNoBalance")
          : t("pages.dashboard.redemptionRequestFailed"),
      );
      return;
    }

    onClose?.();
  };

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label={t("common.close")}
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-redemption-request-title"
        className="dda-admin-transfer-modal relative w-full max-w-md overflow-hidden rounded-t-2xl border border-white/10 bg-dda-bg shadow-2xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dda-accent-bar" />

        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3.5">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-dda-green-light">
              {t("pages.dashboard.redemptionRequestKicker")}
            </p>
            <h2
              id="member-redemption-request-title"
              className="mt-0.5 text-base font-semibold text-white"
            >
              {t("pages.dashboard.redemptionRequestTitle")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="dda-glass-btn flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:text-white"
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 px-4 py-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="dda-panel rounded-xl px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                {t("pages.dashboard.redemptionRequestAvailable")}
              </p>
              <p className="mt-1 text-base font-bold tabular-nums text-white">
                {formatPoolCurrency(maxAmount)}
              </p>
            </div>
            <div className="dda-panel rounded-xl px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                {t("pages.dashboard.equityCash")}
              </p>
              <p className="mt-1 text-base font-bold tabular-nums text-[#fde68a]">
                {formatPoolCurrency(cash)}
              </p>
            </div>
          </div>

          <div className="dda-redemption-request-amount">
            <label
              htmlFor="redemption-request-amount"
              className="mb-1.5 block text-xs text-gray-400"
            >
              {t("pages.accounts.amount")}
            </label>
            <div className="dda-bank-amount-input dda-redemption-request-amount__field !py-2.5">
              <input
                id="redemption-request-amount"
                inputMode="decimal"
                autoFocus
                value={amount}
                onChange={(event) => applyAmount(event.target.value)}
                placeholder="$0.00"
                aria-describedby="redemption-request-amount-hint"
                className="min-w-0 flex-1 bg-transparent text-xl font-bold tabular-nums text-white outline-none placeholder:text-gray-600"
              />
              <button
                type="button"
                onClick={fillAll}
                disabled={maxAmount <= 0}
                className="dda-redemption-request-amount__all"
              >
                {t("pages.dashboard.redemptionRequestAll")}
              </button>
            </div>
            <p
              id="redemption-request-amount-hint"
              className="mt-1.5 text-[11px] leading-relaxed text-gray-500"
            >
              {t("pages.dashboard.redemptionRequestCapHint", {
                amount: formatPoolCurrency(maxAmount),
              })}
            </p>
          </div>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          <button
            type="submit"
            disabled={busy || parsed <= 0 || maxAmount <= 0}
            className="dda-btn-primary inline-flex w-full items-center justify-center gap-2 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            <Banknote className="h-4 w-4" />
            {t("pages.dashboard.redemptionRequestSubmit")}
          </button>
        </form>
      </div>
    </div>,
    document.body,
  );
}
