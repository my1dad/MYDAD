import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ArrowLeftRight, ArrowDown, X } from "lucide-react";
import { lockBodyScroll } from "@/lib/modalBodyLock";
import { formatPoolCurrency } from "../../data/mockData";
import { useLocale } from "../../i18n/LocaleContext";
import {
  getAdminAccountTransferAvailable,
  transferAdminAndLiquidity,
} from "../../lib/adminLiquidityTransfer";
import {
  getDatabaseRevision,
  subscribeInternalDatabase,
} from "../../lib/internalDatabase";
import {
  getAdminLiquidityAvailable,
  resolveMemberProfileId,
  useMemberAccounts,
} from "../../lib/memberAccounts";

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

function handleAmountChange(value, setAmount) {
  const stripped = String(value).replace(/[$,\s]/g, "");
  if (!stripped) {
    setAmount("");
    return;
  }
  setAmount(formatMoneyInput(stripped));
}

export default function AdminLiquidityTransferModal({
  open,
  onClose,
  initialDirection = "to-liquidity",
}) {
  const { t } = useLocale();
  const profileId = resolveMemberProfileId();
  const ledger = useMemberAccounts(profileId);
  const dbRevision = useSyncExternalStore(
    subscribeInternalDatabase,
    getDatabaseRevision,
    () => 0,
  );

  const [direction, setDirection] = useState(initialDirection);
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return undefined;
    return lockBodyScroll();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    setDirection(initialDirection === "to-admin" ? "to-admin" : "to-liquidity");
    setAmount("");
    setMemo("");
    setError("");
    return undefined;
  }, [open, initialDirection]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const adminAvailable = useMemo(() => {
    void dbRevision;
    void ledger.checkingBalance;
    return getAdminAccountTransferAvailable(profileId);
  }, [dbRevision, ledger.checkingBalance, profileId]);

  const liquidityAvailable = useMemo(() => {
    void dbRevision;
    return getAdminLiquidityAvailable();
  }, [dbRevision]);

  if (!open) return null;

  const fromIsAdmin = direction === "to-liquidity";
  const fromLabel = fromIsAdmin
    ? t("pages.dashboard.adminAccountTitle")
    : t("pages.accounts.liquidityWidgetTitle");
  const toLabel = fromIsAdmin
    ? t("pages.accounts.liquidityWidgetTitle")
    : t("pages.dashboard.adminAccountTitle");
  const fromBalance = fromIsAdmin ? adminAvailable : liquidityAvailable;
  const toBalance = fromIsAdmin ? liquidityAvailable : adminAvailable;

  const handleSwap = () => {
    setDirection((current) => (current === "to-liquidity" ? "to-admin" : "to-liquidity"));
    setError("");
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setError("");

    const parsed = parseAmount(amount);
    if (parsed <= 0) {
      setError(t("pages.accounts.amountRequired"));
      return;
    }

    const result = transferAdminAndLiquidity({
      profileId,
      direction,
      amount: parsed,
      memo: memo.trim() || undefined,
    });
    if (!result.ok) {
      setError(t("pages.accounts.adminLiquidityTransferFailed"));
      return;
    }

    setAmount("");
    setMemo("");
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
        aria-labelledby="admin-liquidity-transfer-title"
        className="dda-admin-transfer-modal relative w-full max-w-md overflow-hidden rounded-t-2xl border border-white/10 bg-dda-bg shadow-2xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dda-accent-bar" />

        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3.5">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-dda-gold-light">
              {t("pages.accounts.adminLiquidityTransferKicker")}
            </p>
            <h2
              id="admin-liquidity-transfer-title"
              className="mt-0.5 text-base font-semibold text-white"
            >
              {t("pages.accounts.adminLiquidityTransferTitle")}
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
          <div className="dda-bank-transfer-route">
            <div className="dda-bank-transfer-route__node">
              <p className="text-[10px] uppercase tracking-wide text-gray-500">
                {t("pages.accounts.from")}
              </p>
              <p className="mt-1 text-sm font-semibold text-white">{fromLabel}</p>
              <p className="text-xs tabular-nums text-gray-400">
                {formatPoolCurrency(fromBalance)}
              </p>
            </div>

            <button
              type="button"
              onClick={handleSwap}
              className="dda-bank-transfer-route__swap"
              aria-label={t("pages.accounts.swapAccounts")}
              title={t("pages.accounts.swapAccounts")}
            >
              <ArrowLeftRight className="h-4 w-4" />
            </button>

            <div className="dda-bank-transfer-route__node">
              <p className="text-[10px] uppercase tracking-wide text-gray-500">
                {t("pages.accounts.to")}
              </p>
              <p className="mt-1 text-sm font-semibold text-white">{toLabel}</p>
              <p className="text-xs tabular-nums text-gray-400">
                {formatPoolCurrency(toBalance)}
              </p>
            </div>
          </div>

          <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-gray-500">
            <ArrowDown className="h-3 w-3 shrink-0" aria-hidden="true" />
            {fromIsAdmin
              ? t("pages.accounts.adminLiquidityTransferHintToPool")
              : t("pages.accounts.adminLiquidityTransferHintToAdmin")}
          </p>

          <div>
            <label htmlFor="admin-liquidity-amount" className="mb-1 block text-xs text-gray-400">
              {t("pages.accounts.amount")}
            </label>
            <div className="dda-bank-amount-input !py-2.5">
              <input
                id="admin-liquidity-amount"
                inputMode="decimal"
                autoFocus
                value={amount}
                onChange={(event) => handleAmountChange(event.target.value, setAmount)}
                placeholder="$0.00"
                className="w-full bg-transparent text-xl font-bold tabular-nums text-white outline-none placeholder:text-gray-600"
              />
            </div>
          </div>

          <div>
            <label htmlFor="admin-liquidity-memo" className="mb-1 block text-xs text-gray-400">
              {t("pages.accounts.memo")}
            </label>
            <input
              id="admin-liquidity-memo"
              type="text"
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
              placeholder={t("pages.accounts.adminLiquidityTransferMemoPlaceholder")}
              className="dda-bank-field !py-2 text-sm"
            />
          </div>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          <button
            type="submit"
            className="dda-btn-primary inline-flex w-full items-center justify-center gap-2 py-2.5 text-sm font-semibold"
          >
            <ArrowLeftRight className="h-4 w-4" />
            {t("pages.accounts.adminLiquidityTransferConfirm")}
          </button>
        </form>
      </div>
    </div>,
    document.body,
  );
}
