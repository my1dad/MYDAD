import HomeDesktopDashboard from "./HomeDesktopDashboard.jsx";
import MemberHomeDesktopDashboard from "./MemberHomeDesktopDashboard.jsx";
import PoolDigitalDisplay from "./PoolDigitalDisplay.jsx";
import PlatformEquityCard from "./PlatformEquityCard.jsx";
import ContributeTodaySection from "./ContributeTodaySection.jsx";
import CommunityWelcomeCard from "./CommunityWelcomeCard.jsx";
import { useDadAuth } from "../../context/DadAuthContext.jsx";

export default function HomeLanding({
  poolTotal,
  poolMemberCount,
  poolDailyInflow,
  poolYtdGrowthPct,
  onContributeWeekly,
  onContributeMonthly,
  onContributeYearly,
  onContributeOther,
  onPoolClick,
  onWalletClick,
  onNavigate,
}) {
  const { isAdmin } = useDadAuth();

  return (
    <>
      {/* Mobile / tablet — stacked composition (member = green theme via default vars) */}
      <div
        className={
          isAdmin
            ? "dda-home-landing mx-auto flex w-full max-w-lg flex-col pb-1 sm:max-w-xl lg:hidden"
            : "dda-home-landing dda-home-landing--member mx-auto flex w-full max-w-lg flex-col pb-1 sm:max-w-xl lg:hidden"
        }
      >
        <PlatformEquityCard onClick={onWalletClick} />

        <ContributeTodaySection showPanel={false} />

        <PoolDigitalDisplay
          amount={poolTotal}
          memberCount={poolMemberCount}
          dailyInflow={poolDailyInflow}
          ytdGrowthPct={poolYtdGrowthPct}
          onClick={onPoolClick}
        />

        <CommunityWelcomeCard className="mt-1" />
      </div>

      {/* Desktop / web — role-specific landscape dashboards */}
      {isAdmin ? (
        <HomeDesktopDashboard
          poolTotal={poolTotal}
          poolMemberCount={poolMemberCount}
          poolDailyInflow={poolDailyInflow}
          poolYtdGrowthPct={poolYtdGrowthPct}
          onContributeWeekly={onContributeWeekly}
          onContributeMonthly={onContributeMonthly}
          onContributeYearly={onContributeYearly}
          onContributeOther={onContributeOther}
          onNavigate={onNavigate}
        />
      ) : (
        <MemberHomeDesktopDashboard
          poolTotal={poolTotal}
          poolMemberCount={poolMemberCount}
          poolDailyInflow={poolDailyInflow}
          poolYtdGrowthPct={poolYtdGrowthPct}
          onContributeWeekly={onContributeWeekly}
          onContributeMonthly={onContributeMonthly}
          onContributeYearly={onContributeYearly}
          onContributeOther={onContributeOther}
          onNavigate={onNavigate}
        />
      )}

      <div className="mx-auto hidden w-full max-w-6xl lg:block lg:max-w-7xl">
        <CommunityWelcomeCard className="mt-1" />
      </div>
    </>
  );
}
