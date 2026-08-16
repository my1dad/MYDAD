import { lazy, Suspense } from "react";
import PoolDigitalDisplay from "./PoolDigitalDisplay.jsx";
import PlatformEquityCard from "./PlatformEquityCard.jsx";
import ContributeTodaySection from "./ContributeTodaySection.jsx";
import CommunityWelcomeCard from "./CommunityWelcomeCard.jsx";
import HomeRecentActivityCard from "./HomeRecentActivityCard.jsx";
import { useDadAuth } from "../../context/DadAuthContext.jsx";

const HomeDesktopDashboard = lazy(() => import("./HomeDesktopDashboard.jsx"));
const MemberHomeDesktopDashboard = lazy(() => import("./MemberHomeDesktopDashboard.jsx"));

export default function HomeLanding({
  poolTotal,
  poolMemberCount,
  poolDailyInflow,
  poolYtdGrowthPct,
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
            ? "dda-home-landing mx-auto flex w-full max-w-lg flex-col gap-3 pb-1 sm:max-w-xl lg:hidden"
            : "dda-home-landing dda-home-landing--member mx-auto flex w-full max-w-lg flex-col gap-3 pb-1 sm:max-w-xl lg:hidden"
        }
      >
        <PoolDigitalDisplay
          amount={poolTotal}
          memberCount={poolMemberCount}
          dailyInflow={poolDailyInflow}
          ytdGrowthPct={poolYtdGrowthPct}
          onClick={onPoolClick}
        />

        <PlatformEquityCard onClick={onWalletClick} collapsible={isAdmin} />

        {!isAdmin ? <ContributeTodaySection /> : null}

        <HomeRecentActivityCard onNavigate={onNavigate} />
      </div>

      {/* Desktop / web — role-specific landscape dashboards (lazy so mobile skips the chunk) */}
      <div className="hidden lg:block">
        <Suspense fallback={<div className="min-h-[28rem] w-full animate-pulse rounded-2xl bg-white/[0.03]" />}>
          {isAdmin ? (
            <HomeDesktopDashboard
              poolTotal={poolTotal}
              poolMemberCount={poolMemberCount}
              poolDailyInflow={poolDailyInflow}
              poolYtdGrowthPct={poolYtdGrowthPct}
              onNavigate={onNavigate}
            />
          ) : (
            <MemberHomeDesktopDashboard
              poolTotal={poolTotal}
              poolMemberCount={poolMemberCount}
              poolDailyInflow={poolDailyInflow}
              poolYtdGrowthPct={poolYtdGrowthPct}
              onNavigate={onNavigate}
            />
          )}
        </Suspense>
      </div>

      {!isAdmin ? (
        <div className="mx-auto hidden w-full max-w-6xl lg:block lg:max-w-7xl">
          <CommunityWelcomeCard className="mt-1" />
        </div>
      ) : null}
    </>
  );
}
