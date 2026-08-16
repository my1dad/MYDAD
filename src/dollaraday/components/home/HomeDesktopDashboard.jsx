import { useMemo, useSyncExternalStore } from "react";
import {
  ArrowUpRight,
  Banknote,
  Landmark,
  LineChart,
  PiggyBank,
  Users,
  Wallet,
  ClipboardList,
  MessagesSquare,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDadAuth } from "../../context/DadAuthContext.jsx";
import { useLocale } from "../../i18n/LocaleContext";
import { getTotalDeployedCapital } from "../../lib/allocationSleeves";
import { buildAccountsOverviewStats } from "../../lib/accountsOverview";
import {
  getDadProfileRevision,
  getDadProfiles,
  isProfilePendingApproval,
  subscribeDadProfiles,
} from "../../lib/dadProfileStorage";
import { getPendingExternalPaymentRequests } from "../../lib/externalPaymentRequests";
import {
  getDatabaseRevision,
  subscribeInternalDatabase,
} from "../../lib/internalDatabase";
import {
  getPendingMemberRedemptionRequests,
  listMemberRedemptionRequests,
} from "../../lib/memberRedemptionRequests";
import { useMembers } from "../../lib/memberRegistry";
import { getAdminAccountsCombinedTotal } from "../../lib/memberAccounts";
import { formatPoolCurrency } from "../../data/mockData";
import PlatformEquityCard from "./PlatformEquityCard.jsx";
import PoolDigitalDisplay from "./PoolDigitalDisplay.jsx";
import HomeDesktopPayAlertsRail from "./HomeDesktopPayAlertsRail.jsx";

function formatMoney(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);
}

function DesktopNavTile({
  icon: Icon,
  title,
  value,
  meta,
  tone = "default",
  onClick,
}) {
  return (
    <button
      type="button"
      className={cn("dda-home-desk-tile", `dda-home-desk-tile--${tone}`)}
      onClick={onClick}
      title={meta || title}
    >
      <span className="dda-home-desk-tile__icon" aria-hidden="true">
        <Icon className="h-4 w-4" strokeWidth={2.25} />
      </span>
      <span className="dda-home-desk-tile__copy">
        <span className="dda-home-desk-tile__title">{title}</span>
        <span className="dda-home-desk-tile__value">{value}</span>
        {meta ? <span className="dda-home-desk-tile__meta">{meta}</span> : null}
      </span>
      <ArrowUpRight className="dda-home-desk-tile__arrow h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
    </button>
  );
}

export default function HomeDesktopDashboard({
  poolTotal,
  poolMemberCount: _poolMemberCount,
  poolDailyInflow,
  poolYtdGrowthPct,
  onNavigate,
}) {
  const { t } = useLocale();
  const { profile, isAdmin } = useDadAuth();
  const members = useMembers();
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

  const profileId = profile?.id;

  const stats = useMemo(() => {
    void profileRevision;
    void dbRevision;

    const pendingCount = isAdmin
      ? getDadProfiles().filter((item) => isProfilePendingApproval(item)).length
      : 0;

    const pendingDeposits = isAdmin ? getPendingExternalPaymentRequests().length : 0;
    const pendingRedemptions = isAdmin ? getPendingMemberRedemptionRequests().length : 0;
    const pendingPaymentRequests = pendingDeposits + pendingRedemptions;
    const redemptionSubmitted = isAdmin ? listMemberRedemptionRequests().length : 0;
    const redemptionPendingPct =
      pendingPaymentRequests > 0
        ? Math.round((pendingRedemptions / pendingPaymentRequests) * 100)
        : 0;

    const accounts = profileId
      ? buildAccountsOverviewStats(profileId, { platformScope: isAdmin })
      : null;
    const deployed = getTotalDeployedCapital();
    const checking = Number(accounts?.checkingBalance) || 0;
    const escrow = Number(accounts?.escrowBalance) || 0;
    const memberWallet = Math.max(0, checking + escrow);
    const adminCombined = isAdmin ? getAdminAccountsCombinedTotal(profileId) : null;

    return {
      memberCount: members.length,
      pendingCount,
      pendingPaymentRequests,
      pendingDeposits,
      pendingRedemptions,
      redemptionSubmitted,
      redemptionPendingPct,
      // Admin: operating account + community liquidity (single shared helper — no double-count).
      walletTotal: isAdmin ? adminCombined.total : memberWallet,
      adminAccount: adminCombined?.adminAccount ?? 0,
      communityLiquidity: adminCombined?.communityLiquidity ?? 0,
      checking,
      escrow,
      depositsTotal: Number(accounts?.depositsTotal) || 0,
      deployed,
    };
  }, [
    members.length,
    profileId,
    isAdmin,
    profileRevision,
    dbRevision,
  ]);

  const quickLinks = [
    {
      id: "allocations",
      icon: ClipboardList,
      title: t("nav.allocations"),
      value: t("pages.dashboard.deskAllocationsValue"),
      meta: t("pages.dashboard.deskAllocationsMeta"),
      tone: "gold",
    },
    isAdmin
      ? {
          id: "admin",
          icon: Banknote,
          title: t("pages.dashboard.deskPaymentRequestsTitle"),
          value: String(stats.pendingPaymentRequests),
          meta: t("pages.dashboard.deskPaymentRequestsMeta", {
            count: stats.pendingRedemptions,
            submitted: stats.redemptionSubmitted,
            pct: stats.redemptionPendingPct,
          }),
          tone: "sky",
        }
      : {
          id: "community",
          icon: MessagesSquare,
          title: t("nav.community"),
          value: t("pages.dashboard.deskCommunityValue"),
          meta: t("pages.dashboard.deskCommunityMeta"),
          tone: "sky",
        },
    {
      id: "loans",
      icon: Landmark,
      title: t("nav.loans"),
      value: t("pages.dashboard.deskLoansValue"),
      meta: t("pages.dashboard.deskLoansMeta"),
      tone: "violet",
    },
  ].filter((link) => !(link.id === "allocations" && !isAdmin));

  return (
    <div className="dda-home-desktop" aria-label={t("pages.dashboard.deskAria")}>
      <header className="dda-home-desktop__intro">
        <div className="min-w-0">
          <h1 className="dda-home-desktop__title">{t("pages.dashboard.deskTitle")}</h1>
          <p className="dda-home-desktop__subtitle">{t("pages.dashboard.deskSubtitle")}</p>
        </div>
        <div className="dda-home-desktop__pulse" aria-hidden="true">
          <span className="dda-home-desktop__pulse-dot" />
          <span>{t("pages.dashboard.poolScreenLive")}</span>
        </div>
      </header>

      <div className="dda-home-desktop__hero">
        <div className="dda-home-desktop__hero-pool">
          <PoolDigitalDisplay
            amount={poolTotal}
            memberCount={members.length}
            dailyInflow={poolDailyInflow}
            ytdGrowthPct={poolYtdGrowthPct}
            onClick={() => onNavigate?.("pool")}
            onMembersClick={() => onNavigate?.("members")}
            showSleeveDonuts
            onSleeveClick={() => onNavigate?.("investments")}
          />
        </div>
        <div className="dda-home-desktop__hero-equity">
          <PlatformEquityCard onClick={() => onNavigate?.("accounts")} />
        </div>
      </div>

      <div className="dda-home-desktop__rail">
        <HomeDesktopPayAlertsRail
          className="dda-home-desktop__pay-alerts"
          onNavigate={onNavigate}
        />
      </div>

      <section className="dda-home-desktop__widgets" aria-label={t("pages.dashboard.deskWidgetsLabel")}>
        <div className="dda-accent-bar" />
        <div className="dda-home-desktop__widgets-track">
          <DesktopNavTile
            icon={Users}
            title={t("nav.members")}
            value={String(stats.memberCount)}
            meta={
              isAdmin && stats.pendingCount > 0
                ? t("pages.dashboard.deskMembersPending", { count: stats.pendingCount })
                : t("pages.dashboard.deskMembersMeta")
            }
            tone="green"
            onClick={() => onNavigate?.("members")}
          />

          <DesktopNavTile
            icon={Wallet}
            title={t("nav.accounts")}
            value={formatMoney(stats.walletTotal)}
            meta={
              isAdmin
                ? t("pages.dashboard.deskAccountsMetaAdmin", {
                    admin: formatMoney(stats.adminAccount),
                    liquidity: formatMoney(stats.communityLiquidity),
                  })
                : t("pages.dashboard.deskAccountsMeta", {
                    checking: formatMoney(stats.checking),
                    escrow: formatMoney(stats.escrow),
                  })
            }
            tone="gold"
            onClick={() => onNavigate?.("accounts")}
          />

          <DesktopNavTile
            icon={LineChart}
            title={t("nav.investments")}
            value={formatMoney(stats.deployed)}
            meta={t("pages.dashboard.deskInvestmentsMeta")}
            tone="emerald"
            onClick={() => onNavigate?.("investments")}
          />

          <DesktopNavTile
            icon={PiggyBank}
            title={t("nav.pool")}
            value={formatPoolCurrency(poolTotal)}
            meta={t("pages.dashboard.deskPoolMeta", {
              inflow: formatPoolCurrency(poolDailyInflow),
            })}
            tone="lime"
            onClick={() => onNavigate?.("pool")}
          />

          {isAdmin ? (
            <DesktopNavTile
              icon={UserPlus}
              title={t("pages.dashboard.deskApprovalsTitle")}
              value={String(stats.pendingCount)}
              meta={t("pages.dashboard.deskApprovalsMeta")}
              tone="amber"
              onClick={() => onNavigate?.("members")}
            />
          ) : (
            <DesktopNavTile
              icon={ClipboardList}
              title={t("nav.allocations")}
              value={formatMoney(stats.depositsTotal)}
              meta={t("pages.dashboard.deskDonationsMeta")}
              tone="amber"
              onClick={() => onNavigate?.("allocations")}
            />
          )}

          {quickLinks.map((link) => (
            <DesktopNavTile
              key={link.id}
              icon={link.icon}
              title={link.title}
              value={link.value}
              meta={link.meta}
              tone={link.tone}
              onClick={() => onNavigate?.(link.id)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
