import HomeLanding from "../components/home/HomeLanding.jsx";
import { usePoolState } from "../lib/poolState";

export default function DashboardPage({ onNavigate }) {
  const { poolSummary } = usePoolState();

  return (
    <HomeLanding
      poolTotal={poolSummary.totalBalance}
      poolMemberCount={poolSummary.memberCount}
      poolDailyInflow={poolSummary.dailyInflow}
      poolYtdGrowthPct={poolSummary.ytdGrowthPct}
      onPoolClick={() => onNavigate?.("pool")}
      onWalletClick={() => onNavigate?.("accounts")}
      onNavigate={onNavigate}
    />
  );
}
