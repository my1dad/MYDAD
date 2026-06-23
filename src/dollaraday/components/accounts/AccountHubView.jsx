import { ChevronRight, Landmark, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPoolCurrency } from "../../data/mockData";
import { useLocale } from "../../i18n/LocaleContext";
import { maskAccountNumber, resolveMemberProfileId, useMemberAccounts } from "../../lib/memberAccounts";
import RecurringCashflowPanel from "./RecurringCashflowPanel";
import RedemptionsCard from "./RedemptionsCard";

const ACCOUNTS = [
  {
    id: "checking",
    labelKey: "checkingTab",
    typeKey: "checkingType",
    icon: Wallet,
    accent: "var(--color-dda-green-light)",
  },
  {
    id: "escrow",
    labelKey: "escrowTab",
    typeKey: "escrowType",
    icon: Landmark,
    accent: "#38bdf8",
  },
];

export default function AccountHubView({ onSelectAccount }) {
  const { t } = useLocale();
  const profileId = resolveMemberProfileId();
  const ledger = useMemberAccounts(profileId);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="dda-accounts-hub">
      {ACCOUNTS.map(({ id, labelKey, typeKey, icon: Icon, accent }) => {
        const balance = id === "checking" ? ledger.checkingBalance : ledger.escrowBalance;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelectAccount(id)}
            className="dda-accounts-hub__card"
          >
            <span className="flex min-w-0 flex-1 items-center gap-3">
              <span
                className="dda-accounts-hub__icon"
                style={{
                  backgroundColor: `${accent}18`,
                  color: accent,
                  boxShadow: `inset 0 0 0 1px ${accent}33`,
                }}
              >
                <Icon className="h-5 w-5" strokeWidth={2.25} />
              </span>
              <span className="min-w-0 text-left">
                <span className="dda-accounts-tab__label block truncate">
                  {t(`pages.accounts.${labelKey}`)}
                </span>
                <span className="dda-accounts-tab__type">
                  ({t(`pages.accounts.${typeKey}`)}) · {maskAccountNumber(profileId, id)}
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

      <RedemptionsCard />
      <RecurringCashflowPanel />
    </div>
  );
}
