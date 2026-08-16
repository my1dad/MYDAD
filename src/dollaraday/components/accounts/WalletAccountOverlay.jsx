import { useEffect, useState, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { lockBodyScroll } from "@/lib/modalBodyLock";
import { useLocale } from "../../i18n/LocaleContext";
import { useDadAuth } from "../../context/DadAuthContext.jsx";
import { formatPoolCurrency } from "../../data/mockData";
import { getMemberWalletBalance, resolveMemberProfileId, useMemberAccounts } from "../../lib/memberAccounts";

const AccountDetailView = lazy(() => import("./AccountDetailView"));

export default function WalletAccountOverlay({ open, accountId = "checking", onClose }) {
  const { t } = useLocale();
  const { isAdmin } = useDadAuth();
  const profileId = resolveMemberProfileId();
  const ledger = useMemberAccounts(profileId);
  const balance = isAdmin
    ? Number(ledger?.checkingBalance) || 0
    : getMemberWalletBalance(ledger);
  const [creditFlash, setCreditFlash] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    return lockBodyScroll();
  }, [open]);

  useEffect(() => {
    if (!open) {
      setCreditFlash(null);
      return undefined;
    }
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      if (event.defaultPrevented) return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!creditFlash) return undefined;
    const timer = window.setTimeout(() => setCreditFlash(null), 4200);
    return () => window.clearTimeout(timer);
  }, [creditFlash]);

  if (!open) return null;

  const handleCreditAdded = (amount) => {
    if (!Number.isFinite(amount) || amount <= 0) return;
    setCreditFlash({ amount, key: Date.now() });
  };

  return createPortal(
    <div className="dda-wallet-account-overlay">
      <button
        type="button"
        aria-label={t("common.close")}
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-account-overlay-title"
        className="relative flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-dda-bg shadow-2xl lg:max-h-[90dvh] lg:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dda-accent-bar" />

        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-dda-green-light">
              {t("pages.wallet.accountTitle")}
            </p>
            <h2 id="wallet-account-overlay-title" className="mt-1 text-lg font-semibold text-white">
              {t("pages.dashboard.equityTitle")}
            </h2>
            <div
              className={cn(
                "dda-wallet-balance-line mt-1.5",
                creditFlash && "dda-wallet-balance-line--flash",
              )}
            >
              <p className="dda-wallet-balance-line__value tabular-nums">
                {formatPoolCurrency(balance)}
              </p>
              {creditFlash ? (
                <span key={creditFlash.key} className="dda-wallet-balance-line__delta">
                  +{formatPoolCurrency(creditFlash.amount)}
                </span>
              ) : null}
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

        <div className="dda-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <Suspense
            fallback={
              <div className="dda-glass min-h-[200px] animate-pulse rounded-2xl" aria-hidden="true" />
            }
          >
            <AccountDetailView
              accountId={accountId}
              onBack={onClose}
              presentation="overlay"
              onCreditAdded={handleCreditAdded}
            />
          </Suspense>
        </div>
      </div>
    </div>,
    document.body,
  );
}
