import { useState } from "react";
import HomeLanding from "../components/home/HomeLanding.jsx";
import ContributeOnboardingModal from "../components/onboarding/ContributeOnboardingModal.jsx";
import { saveContribution } from "../lib/storageWrites";
import { usePoolState } from "../lib/poolState";

export default function DashboardPage({ onNavigate }) {
  const { poolSummary } = usePoolState();
  const [contributeOpen, setContributeOpen] = useState(false);
  const [contributeSeed, setContributeSeed] = useState({ amount: null, custom: false });

  const openContribute = (amount = null, custom = false) => {
    setContributeSeed({ amount, custom });
    setContributeOpen(true);
  };

  return (
    <>
      <HomeLanding
        poolTotal={poolSummary.totalBalance}
        poolMemberCount={poolSummary.memberCount}
        poolDailyInflow={poolSummary.dailyInflow}
        poolYtdGrowthPct={poolSummary.ytdGrowthPct}
        onContributeWeekly={() => openContribute(7)}
        onContributeMonthly={() => openContribute(31)}
        onContributeYearly={() => openContribute(365)}
        onContributeOther={() => openContribute(null, true)}
        onPoolClick={() => onNavigate?.("pool")}
      />

      <ContributeOnboardingModal
        open={contributeOpen}
        onClose={() => setContributeOpen(false)}
        initialAmount={contributeSeed.amount}
        startOnCustom={contributeSeed.custom}
        onComplete={({ reminderEnabled, recurringEnabled, amount }) => {
          saveContribution({ amount, reminderEnabled, recurringEnabled });
        }}
      />
    </>
  );
}
