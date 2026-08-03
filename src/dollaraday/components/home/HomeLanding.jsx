import PoolDigitalDisplay from "./PoolDigitalDisplay.jsx";
import PlatformEquityCard from "./PlatformEquityCard.jsx";
import ContributeTodaySection from "./ContributeTodaySection.jsx";

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
}) {
  return (
    <div className="dda-home-landing mx-auto flex w-full max-w-lg flex-col pb-1 sm:max-w-xl">
      <PlatformEquityCard onClick={onWalletClick} />

      <ContributeTodaySection
        onContributeWeekly={onContributeWeekly}
        onContributeMonthly={onContributeMonthly}
        onContributeYearly={onContributeYearly}
        onContributeOther={onContributeOther}
      />

      <PoolDigitalDisplay
        amount={poolTotal}
        memberCount={poolMemberCount}
        dailyInflow={poolDailyInflow}
        ytdGrowthPct={poolYtdGrowthPct}
        onClick={onPoolClick}
      />
    </div>
  );
}
