import { useMemo, useSyncExternalStore } from "react";
import { ArrowUpRight, Eye, TrendingDown, TrendingUp } from "lucide-react";
import { DOLLARADAY_LOGO_URL } from "@/lib/assetUrl";
import { cn } from "@/lib/utils";
import { useDadAuth } from "../../context/DadAuthContext.jsx";
import { useLocale } from "../../i18n/LocaleContext";
import { getPositionAllocatedValue } from "../../lib/allocationRoi";
import { useAllocationPositions } from "../../lib/allocationPositions";
import {
  getDatabaseRevision,
  subscribeInternalDatabase,
} from "../../lib/internalDatabase";
import { maskAccountNumber, useMemberAccounts } from "../../lib/memberAccounts";
import {
  computeMemberStatsFromContributions,
  sumPlatformMemberDonations,
} from "../../lib/memberContributionStats";
import { findStoredMemberByProfileId } from "../../lib/memberRegistry";
import { usePoolState } from "../../lib/poolState";
import { getProfileMemberRoi } from "../../lib/profileRegistry";

function getProfileFullName(profile) {
  if (!profile) return "";
  return profile.fullName?.trim() || profile.displayName?.trim() || "";
}

function formatBankCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);
}

export default function PlatformEquityCard({ onClick, className, wallet = false }) {
  const { t } = useLocale();
  const { profile, isAdmin } = useDadAuth();
  const { currentMember } = usePoolState();
  const profileId = profile?.id ?? currentMember?.id;
  const positions = useAllocationPositions(profileId);
  const ledger = useMemberAccounts(profileId);
  const dbRevision = useSyncExternalStore(
    subscribeInternalDatabase,
    getDatabaseRevision,
    () => 0,
  );
  const userFullName = getProfileFullName(profile);
  const accountMask = profileId
    ? maskAccountNumber(profileId, isAdmin ? "escrow" : "checking")
    : "•••• •••• •••• 0000";

  const stats = useMemo(() => {
    void dbRevision;
    const stored = profileId ? findStoredMemberByProfileId(profileId) : null;
    const contributionStats = profileId
      ? computeMemberStatsFromContributions(profileId)
      : null;
    const contributed =
      Number(contributionStats?.contributed ?? stored?.contributed ?? currentMember?.totalContributed) ||
      0;
    const personalDonated = Number(contributionStats?.donated) || 0;
    // Master admin Donations figure = all member-role donations platform-wide.
    const donated = isAdmin ? sumPlatformMemberDonations() : personalDonated;
    const deposited = Number(contributionStats?.deposited) || 0;
    const equity =
      Number(contributionStats?.equity ?? stored?.equity ?? currentMember?.equityValue) || 0;
    const invested = positions.reduce((sum, position) => sum + getPositionAllocatedValue(position), 0);
    const memberRoi = getProfileMemberRoi({ contributed, equity });
    const checking = Number(ledger?.checkingBalance) || 0;
    const escrow = Number(ledger?.escrowBalance) || 0;
    const walletBalance = checking + escrow;
    // Admin available = Chase Escrow (same ledger as Accounts hub card).
    // Members: wallet + invested − personal donations.
    const balance = isAdmin
      ? Math.max(0, escrow)
      : Math.max(0, walletBalance + invested - personalDonated);

    return {
      equity,
      contributed,
      donated,
      deposited,
      invested,
      wallet: isAdmin ? escrow : walletBalance,
      checking,
      escrow,
      balance,
      roiAmount: memberRoi.amount,
      roiPct: memberRoi.pct,
    };
  }, [profileId, currentMember, positions, ledger, dbRevision, isAdmin]);

  const roiPositive = stats.roiAmount >= 0;
  const RoiIcon = roiPositive ? TrendingUp : TrendingDown;
  const interactive = typeof onClick === "function";
  const balanceLabel = formatBankCurrency(stats.balance);
  const LedgerTag = interactive ? "button" : "div";

  return (
    <section
      className={cn(
        "dda-member-bank",
        isAdmin && "dda-member-bank--admin",
        wallet && "dda-member-bank--wallet",
        className,
      )}
    >
      <div className="dda-accent-bar" />
      <div className="dda-member-bank__sheen" aria-hidden="true" />

      <div className="dda-member-bank__inner">
        {!wallet ? (
          <>
            <div className="dda-member-bank__top">
              {userFullName ? (
                <p className="dda-home-greeting">
                  <span className="dda-home-greeting__label">{t("pages.dashboard.welcomeLabel")}</span>{" "}
                  <span className="dda-home-greeting__name">{userFullName}</span>
                </p>
              ) : (
                <span className="dda-home-greeting dda-home-greeting--empty" aria-hidden="true" />
              )}
            </div>

            <div className="dda-member-bank__brand">
              <img
                src={DOLLARADAY_LOGO_URL}
                alt=""
                draggable={false}
                className="dda-member-bank__logo"
              />
              <div className="min-w-0">
                <p className="dda-member-bank__brand-name">{t("pages.dashboard.brandLine1")}</p>
                <p className="dda-member-bank__brand-sub">{t("pages.dashboard.brandLine2")}</p>
              </div>
            </div>
          </>
        ) : null}

        <LedgerTag
          type={interactive ? "button" : undefined}
          className={cn("dda-member-bank__ledger", !interactive && "dda-member-bank__ledger--static")}
          onClick={interactive ? onClick : undefined}
          aria-label={t(
            interactive
              ? wallet
                ? "pages.dashboard.equityAriaWallet"
                : "pages.dashboard.equityAria"
              : "pages.dashboard.equityAriaStatic",
            { amount: balanceLabel },
          )}
        >
          <div className="dda-member-bank__ledger-head">
            <div className="min-w-0">
              <p className="dda-member-bank__account-type">{t("pages.dashboard.equityTitle")}</p>
              <p className="dda-member-bank__account-mask">{accountMask}</p>
            </div>
            <span
              className={cn(
                "dda-member-bank__roi",
                roiPositive ? "dda-member-bank__roi--up" : "dda-member-bank__roi--down",
              )}
            >
              <RoiIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
              {roiPositive ? "+" : "−"}
              {Math.abs(stats.roiPct).toLocaleString(undefined, { maximumFractionDigits: 1 })}%
            </span>
          </div>

          <div className="dda-member-bank__balance-row">
            <div className="dda-member-bank__balance-col">
              <p className="dda-member-bank__balance-label">
                {t("pages.dashboard.equityBalanceLabel")}
              </p>
              <p className="dda-member-bank__balance" aria-live="polite">
                {balanceLabel}
              </p>
            </div>
            <div className="dda-member-bank__balance-col dda-member-bank__balance-col--donated">
              <p className="dda-member-bank__balance-label">
                {t("pages.dashboard.equityDonated")}
              </p>
              <p className="dda-member-bank__balance dda-member-bank__balance--donated" aria-live="polite">
                {formatBankCurrency(stats.donated)}
              </p>
            </div>
          </div>

          <div className="dda-member-bank__chips">
            <div className="dda-member-bank__chip">
              <p className="dda-member-bank__chip-label">{t("pages.dashboard.equityContributed")}</p>
              <p className="dda-member-bank__chip-value">{formatBankCurrency(stats.deposited)}</p>
            </div>
            <div className="dda-member-bank__chip">
              <p className="dda-member-bank__chip-label">{t("pages.dashboard.equityDonated")}</p>
              <p className="dda-member-bank__chip-value">{formatBankCurrency(stats.donated)}</p>
            </div>
            <div className="dda-member-bank__chip">
              <p className="dda-member-bank__chip-label">{t("pages.dashboard.equityWallet")}</p>
              <p className="dda-member-bank__chip-value">{formatBankCurrency(stats.wallet)}</p>
            </div>
            <div className="dda-member-bank__chip">
              <p className="dda-member-bank__chip-label">{t("pages.dashboard.equityGain")}</p>
              <p
                className={cn(
                  "dda-member-bank__chip-value",
                  roiPositive
                    ? isAdmin
                      ? "dda-member-bank__chip-value--gain-admin"
                      : "text-dda-green-light"
                    : "text-red-300",
                )}
              >
                {roiPositive ? "+" : "−"}
                {formatBankCurrency(Math.abs(stats.roiAmount))}
              </p>
            </div>
          </div>

          {interactive ? (
            <span className="dda-member-bank__cta">
              <Eye className="h-3.5 w-3.5" strokeWidth={2.25} />
              {t(wallet ? "pages.dashboard.equityHintWallet" : "pages.dashboard.equityHint")}
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.25} />
            </span>
          ) : null}
        </LedgerTag>
      </div>
    </section>
  );
}
