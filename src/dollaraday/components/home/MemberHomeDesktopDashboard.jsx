import { useMemo, useSyncExternalStore } from "react";
import {
  ArrowUpRight,
  Landmark,
  MessagesSquare,
  PiggyBank,
  UserRound,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDadAuth } from "../../context/DadAuthContext.jsx";
import { useLocale } from "../../i18n/LocaleContext";
import { buildAccountsOverviewStats } from "../../lib/accountsOverview";
import {
  getDatabaseRevision,
  subscribeInternalDatabase,
} from "../../lib/internalDatabase";
import { formatPoolCurrency } from "../../data/mockData";
import PlatformEquityCard from "./PlatformEquityCard.jsx";
import ContributeTodaySection from "./ContributeTodaySection.jsx";
import PoolDigitalDisplay from "./PoolDigitalDisplay.jsx";
import HomeAlertsWidget from "./HomeAlertsWidget.jsx";

function formatMoney(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);
}

function MemberNavTile({ icon: Icon, title, value, meta, tone = "green", onClick }) {
  return (
    <button
      type="button"
      className={cn("dda-home-desk-tile", "dda-home-desk-tile--member", `dda-home-desk-tile--${tone}`)}
      onClick={onClick}
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

/**
 * Member-role desktop home — green theme, member-only modules (no admin ops tiles).
 */
export default function MemberHomeDesktopDashboard({
  poolTotal,
  poolMemberCount,
  poolDailyInflow,
  poolYtdGrowthPct,
  onContributeWeekly,
  onContributeMonthly,
  onContributeYearly,
  onContributeOther,
  onNavigate,
}) {
  const { t } = useLocale();
  const { profile } = useDadAuth();
  const profileId = profile?.id;
  const dbRevision = useSyncExternalStore(
    subscribeInternalDatabase,
    getDatabaseRevision,
    () => 0,
  );

  const stats = useMemo(() => {
    void dbRevision;
    const accounts = profileId ? buildAccountsOverviewStats(profileId) : null;
    return {
      walletTotal: Number(accounts?.totalBalance) || 0,
      checking: Number(accounts?.checkingBalance) || 0,
      escrow: Number(accounts?.escrowBalance) || 0,
      depositsTotal: Number(accounts?.depositsTotal) || 0,
      recurringNet: Number(accounts?.recurringNetMonthly) || 0,
    };
  }, [profileId, dbRevision]);

  return (
    <div
      className="dda-home-desktop dda-home-desktop--member"
      aria-label={t("pages.dashboard.memberDeskAria")}
    >
      <header className="dda-home-desktop__intro">
        <div className="min-w-0">
          <p className="dda-text-kicker">{t("pages.dashboard.memberDeskKicker")}</p>
          <h1 className="dda-home-desktop__title">{t("pages.dashboard.memberDeskTitle")}</h1>
          <p className="dda-home-desktop__subtitle">{t("pages.dashboard.memberDeskSubtitle")}</p>
        </div>
        <div className="dda-home-desktop__pulse dda-home-desktop__pulse--member" aria-hidden="true">
          <span className="dda-home-desktop__pulse-dot" />
          <span>{t("pages.dashboard.poolScreenLive")}</span>
        </div>
      </header>

      <div className="dda-home-desktop__hero">
        <div className="dda-home-desktop__hero-equity">
          <PlatformEquityCard onClick={() => onNavigate?.("accounts")} />
        </div>
        <div className="dda-home-desktop__hero-pool">
          <PoolDigitalDisplay
            amount={poolTotal}
            memberCount={poolMemberCount}
            dailyInflow={poolDailyInflow}
            ytdGrowthPct={poolYtdGrowthPct}
            onClick={() => onNavigate?.("pool")}
            showSleeveDonuts
            onSleeveClick={() => onNavigate?.("pool")}
          />
        </div>
      </div>

      <div className="dda-home-desktop__rail">
        <ContributeTodaySection
          className="dda-home-desktop__contribute"
          onContributeWeekly={onContributeWeekly}
          onContributeMonthly={onContributeMonthly}
          onContributeYearly={onContributeYearly}
          onContributeOther={onContributeOther}
        />
        <HomeAlertsWidget
          className="dda-home-desktop__alerts"
          onNavigate={onNavigate}
        />
      </div>

      <section
        className="dda-home-desktop__widgets dda-home-desktop__widgets--member"
        aria-label={t("pages.dashboard.memberDeskWidgetsLabel")}
      >
        <MemberNavTile
          icon={Wallet}
          title={t("nav.wallet")}
          value={formatMoney(stats.walletTotal)}
          meta={t("pages.dashboard.deskAccountsMeta", {
            checking: formatMoney(stats.checking),
            escrow: formatMoney(stats.escrow),
          })}
          tone="green"
          onClick={() => onNavigate?.("accounts")}
        />
        <MemberNavTile
          icon={PiggyBank}
          title={t("nav.pool")}
          value={formatPoolCurrency(poolTotal)}
          meta={t("pages.dashboard.deskPoolMeta", {
            inflow: formatPoolCurrency(poolDailyInflow),
          })}
          tone="lime"
          onClick={() => onNavigate?.("pool")}
        />
        <MemberNavTile
          icon={MessagesSquare}
          title={t("nav.community")}
          value={t("pages.dashboard.deskCommunityValue")}
          meta={t("pages.dashboard.deskCommunityMeta")}
          tone="emerald"
          onClick={() => onNavigate?.("community")}
        />
        <MemberNavTile
          icon={Landmark}
          title={t("nav.loans")}
          value={t("pages.dashboard.deskLoansValue")}
          meta={t("pages.dashboard.deskLoansMeta")}
          tone="gold"
          onClick={() => onNavigate?.("loans")}
        />
        <MemberNavTile
          icon={UserRound}
          title={t("nav.profile")}
          value={t("pages.dashboard.memberDeskProfileValue")}
          meta={t("pages.dashboard.memberDeskProfileMeta")}
          tone="green"
          onClick={() => onNavigate?.("profile")}
        />
      </section>
    </div>
  );
}
