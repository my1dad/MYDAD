import { useEffect } from "react";
import { lazy, Suspense } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPoolCurrency } from "../../data/mockData";
import { useDadAuth } from "../../context/DadAuthContext";
import { useLocale } from "../../i18n/LocaleContext";
import { maskAccountNumber, resolveMemberProfileId, useMemberAccounts } from "../../lib/memberAccounts";
import { reconcileMemberEscrowFromContributions } from "../../lib/poolEscrowReconcile";
import { processRecurringCashflows } from "../../lib/recurringCashflow";
import BankAccountLogo from "./BankAccountLogo";
import { getVisibleBankAccounts } from "./bankAccounts";
import { getAccountDisplay } from "./accountDisplay";

const AccountsOverviewInfographic = lazy(() => import("./AccountsOverviewInfographic"));
const RecurringCashflowPanel = lazy(() => import("./RecurringCashflowPanel"));
const WalletFundingTabs = lazy(() => import("./WalletFundingTabs"));
const RedemptionsCard = lazy(() => import("./RedemptionsCard"));

function PanelSlot({ className = "min-h-[120px]" }) {
  return <div className={`dda-glass animate-pulse rounded-2xl ${className}`} aria-hidden="true" />;
}

export default function AccountHubView({ onSelectAccount }) {
  const { t } = useLocale();
  const { profile, isAdmin } = useDadAuth();
  const visibleAccounts = getVisibleBankAccounts(true);
  const profileId = resolveMemberProfileId();
  const ledger = useMemberAccounts(profileId);

  useEffect(() => {
    // After paint — never block Accounts hub open with ledger rebuild.
    const idle = window.requestIdleCallback
      ? (cb) => window.requestIdleCallback(cb, { timeout: 4000 })
      : (cb) => window.setTimeout(cb, 1500);
    const cancel = window.cancelIdleCallback
      ? (id) => window.cancelIdleCallback(id)
      : (id) => window.clearTimeout(id);
    const id = idle(() => {
      reconcileMemberEscrowFromContributions();
      processRecurringCashflows();
    });
    return () => cancel(id);
  }, [profileId]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {profile?.proId ? (
        <div className="dda-panel rounded-xl border border-dda-green/20 px-4 py-3 sm:px-5 sm:py-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-dda-green-light">
            {t("pages.accounts.proIdCardTitle")}
          </p>
          <p className="mt-2 font-mono text-lg font-bold tracking-wide text-white sm:text-xl">
            {profile.proId}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
            {t("pages.accounts.proIdCardSub")}
          </p>
        </div>
      ) : null}
      <div className="dda-accounts-hub">
      {visibleAccounts.map(({ id }) => {
        const display = getAccountDisplay(id, isAdmin, t);
        const balance = id === "checking" ? ledger.checkingBalance : ledger.escrowBalance;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelectAccount(id)}
            className="dda-accounts-hub__card"
          >
            <span className="flex min-w-0 flex-1 items-center gap-3">
              <span className="dda-accounts-hub__icon dda-bank-logo-wrap">
                <BankAccountLogo accountId={id} />
              </span>
              <span className="min-w-0 text-left">
                <span className="dda-accounts-tab__label block truncate">
                  {display.title}
                </span>
                <span className="dda-accounts-tab__type">
                  ({display.type}) · {maskAccountNumber(profileId, id)}
                </span>
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="text-right">
                <span className="block text-[10px] uppercase tracking-wide text-gray-500">
                  {t("pages.accounts.availableBalance")}
                </span>
                <span className="block text-base font-bold tabular-nums text-white sm:text-lg">
                  {formatPoolCurrency(balance)}
                </span>
              </span>
              <ChevronRight className={cn("h-5 w-5 text-gray-500")} />
            </span>
          </button>
        );
      })}
      </div>

      <Suspense fallback={<PanelSlot className="min-h-[200px]" />}>
        <AccountsOverviewInfographic />
      </Suspense>
      {isAdmin ? (
        <Suspense fallback={<PanelSlot />}>
          <RedemptionsCard />
        </Suspense>
      ) : null}
      <Suspense fallback={<PanelSlot className="min-h-[160px]" />}>
        <RecurringCashflowPanel />
      </Suspense>
      <Suspense fallback={<PanelSlot />}>
        <WalletFundingTabs />
      </Suspense>
    </div>
  );
}
