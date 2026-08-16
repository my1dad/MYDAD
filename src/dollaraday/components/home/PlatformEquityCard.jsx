import { useMemo, useState, useSyncExternalStore } from "react";
import {
  ArrowLeftRight,
  Banknote,
  ChevronDown,
  Droplets,
  Eye,
  EyeOff,
  Landmark,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { DOLLARADAY_LOGO_URL } from "@/lib/assetUrl";
import { cn } from "@/lib/utils";
import { useDadAuth } from "../../context/DadAuthContext.jsx";
import { useLocale } from "../../i18n/LocaleContext";
import { getPositionAllocatedValue } from "../../lib/allocationRoi";
import { useAllocationPositions } from "../../lib/allocationPositions";
import { getTotalDeployedCapital } from "../../lib/allocationSleeves";
import {
  formatGroupedAccountNumber,
  getDadProfiles,
  getDadProfileRevision,
  getProfileAccountNumber,
  isProfilePendingApproval,
  subscribeDadProfiles,
} from "../../lib/dadProfileStorage";
import {
  getDatabaseRevision,
  subscribeInternalDatabase,
} from "../../lib/internalDatabase";
import { getPendingExternalPaymentRequests } from "../../lib/externalPaymentRequests";
import {
  maskAccountNumber,
  useMemberAccounts,
  getAdminLiquidityAvailable,
  getMemberWalletBalance,
} from "../../lib/memberAccounts";
import {
  computeMemberStatsFromContributions,
  sumPlatformMemberContributions,
} from "../../lib/memberContributionStats";
import { getPendingMemberRedemptionRequests } from "../../lib/memberRedemptionRequests";
import { findStoredMemberByProfileId } from "../../lib/memberRegistry";
import { countPlatformMembers, usePoolState } from "../../lib/poolState";
import { getProfileMemberRoi } from "../../lib/profileRegistry";
import { getMemberCashBalance } from "../../lib/cashReinvest";
import MemberRedemptionRequestModal from "./MemberRedemptionRequestModal";

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

function formatCompactMoney(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);
}

function AdminCompositionDial({ admin, liquidity, combinedLabel }) {
  const total = Math.max(0, admin) + Math.max(0, liquidity);
  const a = total > 0 ? (admin / total) * 100 : 0;
  const gradient =
    total <= 0
      ? "conic-gradient(from -90deg, rgba(148,163,184,0.25) 0 100%)"
      : `conic-gradient(from -90deg,
          #60a5fa 0 ${a}%,
          #fbbf24 ${a}% 100%)`;

  return (
    <div
      className="dda-member-bank__dial"
      style={{ background: gradient }}
      aria-hidden="true"
    >
      <div className="dda-member-bank__dial-hole">
        <span className="dda-member-bank__dial-total">
          {formatCompactMoney(admin + liquidity)}
        </span>
        <span className="dda-member-bank__dial-caption">{combinedLabel}</span>
      </div>
    </div>
  );
}

function AdminMeter({ label, value, max, tone = "blue" }) {
  const pct = max > 0 ? Math.min(100, Math.round((Math.max(0, value) / max) * 100)) : 0;
  return (
    <div className={cn("dda-member-bank__meter", `dda-member-bank__meter--${tone}`)}>
      <div className="dda-member-bank__meter-head">
        <span className="dda-member-bank__meter-label">{label}</span>
        <span className="dda-member-bank__meter-value">{formatBankCurrency(value)}</span>
      </div>
      <div className="dda-member-bank__meter-track" aria-hidden="true">
        <span className="dda-member-bank__meter-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function PlatformEquityCard({
  onClick,
  className,
  wallet = false,
  onTransferClick,
  collapsible = false,
}) {
  const { t } = useLocale();
  const { profile, isAdmin } = useDadAuth();
  const { currentMember, poolSummary } = usePoolState();
  const [accountVisible, setAccountVisible] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(Boolean(collapsible));
  const canCollapse = Boolean(collapsible && isAdmin);
  const showDense = !canCollapse || !collapsed;
  const profileId = profile?.id ?? currentMember?.id;
  const positions = useAllocationPositions(isAdmin ? undefined : profileId);
  const ledger = useMemberAccounts(profileId);
  const profileRevision = useSyncExternalStore(
    subscribeDadProfiles,
    getDadProfileRevision,
    () => 0,
  );
  const dbRevision = useSyncExternalStore(
    subscribeInternalDatabase,
    getDatabaseRevision,
    () => 0,
  );
  const userFullName = getProfileFullName(profile);
  const fullAccountNumber = profileId ? getProfileAccountNumber(profileId) : null;
  const accountMask = profileId
    ? maskAccountNumber(profileId, "checking")
    : "•••• •••• •••• 0000";
  const accountDisplay = accountVisible && fullAccountNumber
    ? formatGroupedAccountNumber(fullAccountNumber)
    : accountMask;
  const RevealIcon = accountVisible ? EyeOff : Eye;

  const toggleAccountVisibility = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setAccountVisible((visible) => !visible);
  };

  const stats = useMemo(() => {
    void dbRevision;
    void profileRevision;
    const stored = profileId ? findStoredMemberByProfileId(profileId) : null;
    const contributionStats = profileId
      ? computeMemberStatsFromContributions(profileId)
      : null;
    const balancesLocked = stored?.adminBalancesLocked === true;
    const personalDonated = Number(contributionStats?.donated) || 0;
    // Admin card: all member contributions (donations + deposits), matching platform inflow totals.
    const donated = isAdmin ? sumPlatformMemberContributions() : personalDonated;
    const invested = positions.reduce((sum, position) => sum + getPositionAllocatedValue(position), 0);
    const checking = Number(ledger?.checkingBalance) || 0;
    const escrow = Number(ledger?.escrowBalance) || 0;
    const cash = profileId ? getMemberCashBalance(profileId) : 0;
    const wallet = getMemberWalletBalance(ledger);

    if (isAdmin) {
      const adminTotal = Math.max(0, checking);
      const liquidity = getAdminLiquidityAvailable();
      const deployed = getTotalDeployedCapital();
      const pendingApprovals = getDadProfiles().filter((item) => isProfilePendingApproval(item)).length;
      const pendingPayments =
        getPendingExternalPaymentRequests().length + getPendingMemberRedemptionRequests().length;
      const dailyInflow = Math.max(0, Number(poolSummary?.dailyInflow) || 0);
      const memberRoi = getProfileMemberRoi({ contributed: adminTotal, equity: adminTotal });
      const combined = adminTotal + liquidity;
      return {
        equity: adminTotal,
        contributed: adminTotal,
        donated,
        deposited: adminTotal,
        invested: 0,
        investments: adminTotal,
        cash: adminTotal,
        wallet: adminTotal,
        liquidity,
        deployed,
        combined,
        memberCount: countPlatformMembers(),
        pendingApprovals,
        pendingPayments,
        dailyInflow,
        checking,
        escrow,
        balance: adminTotal,
        roiAmount: memberRoi.amount,
        roiPct: memberRoi.pct,
      };
    }

    const contributed = balancesLocked
      ? Number(stored?.contributed) || 0
      : Number(contributionStats?.contributed ?? stored?.contributed ?? currentMember?.totalContributed) ||
        0;
    const deposited = Number(contributionStats?.deposited) || 0;
    const equity = Number(contributionStats?.equity ?? stored?.equity ?? currentMember?.equityValue) || 0;
    const memberRoi = getProfileMemberRoi({
      contributed: Math.max(contributed, equity),
      equity,
    });
    const investments = Math.max(0, equity, invested);

    return {
      equity,
      contributed,
      donated,
      deposited,
      invested,
      investments,
      cash,
      wallet,
      liquidity: 0,
      deployed: 0,
      combined: 0,
      memberCount: 0,
      pendingApprovals: 0,
      pendingPayments: 0,
      dailyInflow: 0,
      checking,
      escrow,
      balance: investments,
      roiAmount: memberRoi.amount,
      roiPct: memberRoi.pct,
    };
  }, [
    profileId,
    currentMember,
    positions,
    ledger,
    dbRevision,
    profileRevision,
    isAdmin,
    poolSummary?.dailyInflow,
  ]);

  const roiPositive = stats.roiAmount >= 0;
  const RoiIcon = roiPositive ? TrendingUp : TrendingDown;
  const interactive = typeof onClick === "function";
  const balanceLabel = formatBankCurrency(stats.investments);
  const meterMax = Math.max(stats.investments, stats.liquidity, stats.donated, stats.deployed, 1);

  const openLedger = () => {
    if (interactive) onClick();
  };

  const onLedgerKeyDown = (event) => {
    if (!interactive) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <section
      className={cn(
        "dda-member-bank",
        isAdmin && "dda-member-bank--admin",
        wallet && "dda-member-bank--wallet",
        canCollapse && collapsed && "dda-member-bank--collapsed",
        className,
      )}
    >
      <div className="dda-accent-bar" />
      <div className="dda-member-bank__sheen" aria-hidden="true" />

      <div className="dda-member-bank__inner">
        {!wallet && showDense ? (
          <div className="dda-member-bank__top">
            {userFullName ? (
              <p className="dda-home-greeting dda-member-bank__greeting">
                <span className="dda-home-greeting__label">{t("pages.dashboard.welcomeLabel")}</span>
                <span className="dda-home-greeting__name">{userFullName}</span>
              </p>
            ) : (
              <span className="dda-home-greeting dda-home-greeting--empty" aria-hidden="true" />
            )}

            <div className="dda-member-bank__brand">
              <img
                src={DOLLARADAY_LOGO_URL}
                alt=""
                draggable={false}
                className="dda-member-bank__logo"
              />
              <div className="dda-member-bank__brand-copy">
                <p className="dda-member-bank__brand-name">{t("pages.dashboard.brandLine1")}</p>
                <p className="dda-member-bank__brand-sub">{t("pages.dashboard.brandLine2")}</p>
              </div>
            </div>
          </div>
        ) : null}

        {!wallet && canCollapse && collapsed && userFullName ? (
          <p className="dda-home-greeting dda-member-bank__greeting dda-member-bank__greeting--compact">
            <span className="dda-home-greeting__label">{t("pages.dashboard.welcomeLabel")}</span>
            <span className="dda-home-greeting__name">{userFullName}</span>
          </p>
        ) : null}

        <div
          role={interactive ? "button" : undefined}
          tabIndex={interactive ? 0 : undefined}
          className={cn(
            "dda-member-bank__ledger",
            isAdmin && "dda-member-bank__ledger--dense",
            interactive && "dda-member-bank__ledger--interactive",
            !interactive && "dda-member-bank__ledger--static",
          )}
          onClick={interactive ? openLedger : undefined}
          onKeyDown={interactive ? onLedgerKeyDown : undefined}
          aria-label={t(
            isAdmin
              ? "pages.dashboard.adminAccountAria"
              : interactive
                ? wallet
                  ? "pages.dashboard.equityAriaWallet"
                  : "pages.dashboard.equityAria"
                : "pages.dashboard.equityAriaStatic",
            { amount: balanceLabel },
          )}
        >
          <div className="dda-member-bank__ledger-head">
            <div className="dda-member-bank__ledger-meta">
              <p className="dda-member-bank__account-type">
                {t(isAdmin ? "pages.dashboard.adminAccountTitle" : "pages.dashboard.equityTitle")}
              </p>
              <div className="dda-member-bank__account-mask-row">
                <p className="dda-member-bank__account-mask" aria-live="polite">
                  {accountDisplay}
                </p>
                {fullAccountNumber ? (
                  <button
                    type="button"
                    className="dda-member-bank__account-reveal"
                    aria-label={t(
                      accountVisible
                        ? "pages.dashboard.equityHideAccount"
                        : "pages.dashboard.equityShowAccount",
                    )}
                    aria-pressed={accountVisible}
                    onClick={toggleAccountVisibility}
                  >
                    <RevealIcon className="h-3.5 w-3.5" strokeWidth={2.25} />
                  </button>
                ) : null}
              </div>
            </div>
            <div className="dda-member-bank__ledger-actions">
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
              {canCollapse ? (
                <button
                  type="button"
                  className="dda-member-bank__collapse-btn"
                  aria-expanded={!collapsed}
                  aria-label={t(
                    collapsed
                      ? "pages.dashboard.expandAdminCash"
                      : "pages.dashboard.collapseAdminCash",
                  )}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setCollapsed((value) => !value);
                  }}
                >
                  <ChevronDown
                    className={cn(
                      "dda-member-bank__collapse-chevron h-4 w-4",
                      !collapsed && "dda-member-bank__collapse-chevron--open",
                    )}
                    strokeWidth={2.25}
                    aria-hidden="true"
                  />
                </button>
              ) : null}
            </div>
          </div>

          {isAdmin ? (
            <>
              <div className="dda-member-bank__hero-grid">
                <div className="dda-member-bank__balance-col">
                  <p className="dda-member-bank__balance-label">
                    {t("pages.dashboard.adminAccountTotal")}
                  </p>
                  <p className="dda-member-bank__balance" aria-live="polite">
                    {formatBankCurrency(stats.investments)}
                  </p>
                  {showDense ? (
                    <p className="dda-member-bank__balance-hint">
                      {t("pages.dashboard.adminAccountCombinedHint", {
                        amount: formatBankCurrency(stats.combined),
                      })}
                    </p>
                  ) : null}
                </div>
                {showDense ? (
                  <AdminCompositionDial
                    admin={stats.investments}
                    liquidity={stats.liquidity}
                    combinedLabel={t("pages.dashboard.adminAccountCombined")}
                  />
                ) : null}
              </div>

              {!showDense ? (
                <div className="dda-member-bank__chips dda-member-bank__chips--compact" aria-label="Account summary">
                  <div className="dda-member-bank__chip">
                    <p className="dda-member-bank__chip-label">{t("pages.dashboard.adminAccountLiquidity")}</p>
                    <p className="dda-member-bank__chip-value">{formatBankCurrency(stats.liquidity)}</p>
                  </div>
                  <div className="dda-member-bank__chip">
                    <p className="dda-member-bank__chip-label">{t("pages.dashboard.adminAccountDonations")}</p>
                    <p className="dda-member-bank__chip-value">{formatBankCurrency(stats.donated)}</p>
                  </div>
                  <div className="dda-member-bank__chip">
                    <p className="dda-member-bank__chip-label">{t("pages.dashboard.equityGain")}</p>
                    <p
                      className={cn(
                        "dda-member-bank__chip-value",
                        roiPositive
                          ? "dda-member-bank__chip-value--gain-admin"
                          : "text-red-300",
                      )}
                    >
                      {roiPositive ? "+" : "−"}
                      {formatBankCurrency(Math.abs(stats.roiAmount))}
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div
                    className="dda-member-bank__stack"
                    aria-label={t("pages.dashboard.adminAccountMixLabel")}
                  >
                <div className="dda-member-bank__stack-track" aria-hidden="true">
                  <span
                    className="dda-member-bank__stack-seg dda-member-bank__stack-seg--admin"
                    style={{ flexGrow: Math.max(stats.investments, 0.01) }}
                  />
                  <span
                    className="dda-member-bank__stack-seg dda-member-bank__stack-seg--liq"
                    style={{ flexGrow: Math.max(stats.liquidity, 0.01) }}
                  />
                </div>
                <div className="dda-member-bank__stack-legend">
                  <span>
                    <i className="dda-member-bank__swatch dda-member-bank__swatch--admin" />
                    {t("pages.dashboard.adminAccountTotal")}
                  </span>
                  <span>
                    <i className="dda-member-bank__swatch dda-member-bank__swatch--liq" />
                    {t("pages.dashboard.adminAccountLiquidity")}
                  </span>
                </div>
              </div>

              <div className="dda-member-bank__meters">
                <AdminMeter
                  label={t("pages.dashboard.adminAccountLiquidity")}
                  value={stats.liquidity}
                  max={meterMax}
                  tone="gold"
                />
                <AdminMeter
                  label={t("pages.dashboard.adminAccountDonations")}
                  value={stats.donated}
                  max={meterMax}
                  tone="sky"
                />
                <AdminMeter
                  label={t("pages.dashboard.adminAccountDeployed")}
                  value={stats.deployed}
                  max={meterMax}
                  tone="emerald"
                />
              </div>

              <div
                className="dda-member-bank__quick"
                aria-label={t("pages.dashboard.adminAccountPulse")}
              >
                <div className="dda-member-bank__quick-item dda-member-bank__quick-item--members">
                  <span className="dda-member-bank__quick-icon" aria-hidden="true">
                    <Users className="h-3.5 w-3.5" strokeWidth={2.25} />
                  </span>
                  <div className="dda-member-bank__quick-copy">
                    <p className="dda-member-bank__quick-label">{t("common.members")}</p>
                    <p className="dda-member-bank__quick-value">{stats.memberCount}</p>
                  </div>
                </div>
                <div className="dda-member-bank__quick-item dda-member-bank__quick-item--today">
                  <span className="dda-member-bank__quick-icon" aria-hidden="true">
                    <Landmark className="h-3.5 w-3.5" strokeWidth={2.25} />
                  </span>
                  <div className="dda-member-bank__quick-copy">
                    <p className="dda-member-bank__quick-label">
                      {t("pages.dashboard.adminAccountToday")}
                    </p>
                    <p className="dda-member-bank__quick-value dda-member-bank__quick-value--in">
                      {formatCompactMoney(stats.dailyInflow)}
                    </p>
                  </div>
                </div>
                <div
                  className={cn(
                    "dda-member-bank__quick-item dda-member-bank__quick-item--alerts",
                    stats.pendingApprovals + stats.pendingPayments > 0 &&
                      "dda-member-bank__quick-item--alerts-hot",
                  )}
                >
                  <span className="dda-member-bank__quick-icon" aria-hidden="true">
                    <Droplets className="h-3.5 w-3.5" strokeWidth={2.25} />
                  </span>
                  <div className="dda-member-bank__quick-copy">
                    <p className="dda-member-bank__quick-label">
                      {t("pages.dashboard.adminAccountAlerts")}
                    </p>
                    <p className="dda-member-bank__quick-value">
                      {stats.pendingApprovals + stats.pendingPayments}
                    </p>
                  </div>
                </div>
                <div
                  className={cn(
                    "dda-member-bank__quick-item dda-member-bank__quick-item--growth",
                    !roiPositive && "dda-member-bank__quick-item--growth-down",
                  )}
                >
                  <span className="dda-member-bank__quick-icon" aria-hidden="true">
                    <TrendingUp className="h-3.5 w-3.5" strokeWidth={2.25} />
                  </span>
                  <div className="dda-member-bank__quick-copy">
                    <p className="dda-member-bank__quick-label">{t("pages.dashboard.equityGain")}</p>
                    <p
                      className={cn(
                        "dda-member-bank__quick-value",
                        roiPositive
                          ? "dda-member-bank__chip-value--gain-admin"
                          : "text-red-300",
                      )}
                    >
                      {roiPositive ? "+" : "−"}
                      {formatCompactMoney(Math.abs(stats.roiAmount))}
                    </p>
                  </div>
                </div>
              </div>
                </>
              )}
            </>
          ) : (
            <>
              <div className="dda-member-bank__balance-row">
                <div className="dda-member-bank__balance-col">
                  <p className="dda-member-bank__balance-label">
                    {t("pages.dashboard.equityInvestments")}
                  </p>
                  <p className="dda-member-bank__balance" aria-live="polite">
                    {formatBankCurrency(stats.investments)}
                  </p>
                </div>
                <div className="dda-member-bank__balance-col dda-member-bank__balance-col--cash">
                  <p className="dda-member-bank__balance-label">
                    {t("pages.dashboard.equityCash")}
                  </p>
                  <p className="dda-member-bank__balance dda-member-bank__balance--cash" aria-live="polite">
                    {formatBankCurrency(stats.cash)}
                  </p>
                </div>
              </div>

              <div className="dda-member-bank__chips" aria-label="Account summary">
                <div className="dda-member-bank__chip">
                  <p className="dda-member-bank__chip-label">{t("pages.dashboard.equityContributed")}</p>
                  <p className="dda-member-bank__chip-value">{formatBankCurrency(stats.deposited)}</p>
                </div>
                <div className="dda-member-bank__chip">
                  <p className="dda-member-bank__chip-label">{t("pages.dashboard.equityDonated")}</p>
                  <p className="dda-member-bank__chip-value">
                    {formatBankCurrency(stats.deposited + stats.donated)}
                  </p>
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
                      roiPositive ? "text-dda-green-light" : "text-red-300",
                    )}
                  >
                    {roiPositive ? "+" : "−"}
                    {formatBankCurrency(Math.abs(stats.roiAmount))}
                  </p>
                </div>
              </div>
            </>
          )}

          {isAdmin && typeof onTransferClick === "function" && showDense ? (
            <button
              type="button"
              className="dda-member-bank__transfer-btn"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onTransferClick();
              }}
            >
              <ArrowLeftRight className="h-3.5 w-3.5" strokeWidth={2.25} />
              {t("pages.accounts.adminLiquidityTransferButton")}
            </button>
          ) : null}
        </div>

        {!isAdmin ? (
          <button
            type="button"
            className="dda-member-bank__transfer-btn dda-member-bank__request-btn"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setRequestOpen(true);
            }}
          >
            <Banknote className="h-3.5 w-3.5" strokeWidth={2.25} />
            {t("pages.dashboard.redemptionRequestButton")}
          </button>
        ) : null}
      </div>

      {!isAdmin ? (
        <MemberRedemptionRequestModal
          open={requestOpen}
          onClose={() => setRequestOpen(false)}
          availableBalance={stats.investments}
          cashBalance={stats.cash}
        />
      ) : null}
    </section>
  );
}
