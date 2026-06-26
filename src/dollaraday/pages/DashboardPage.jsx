import { useState } from "react";
import HomeLanding from "../components/home/HomeLanding.jsx";
import ContributeOnboardingModal from "../components/onboarding/ContributeOnboardingModal.jsx";
import { saveContribution } from "../lib/storageWrites";
import { usePoolState } from "../lib/poolState";

export default function DashboardPage({ onNavigate }) {
  const { poolSummary } = usePoolState();
  const [contributeOpen, setContributeOpen] = useState(false);
  const [contributeSeed, setContributeSeed] = useState({
    amount: null,
    custom: false,
    frequency: "weekly",
  });

  const openContribute = (amount = null, { custom = false, frequency = "weekly" } = {}) => {
    setContributeSeed({ amount, custom, frequency });
    setContributeOpen(true);
  };

  return (
    <>
      <HomeLanding
        poolTotal={poolSummary.totalBalance}
        poolMemberCount={poolSummary.memberCount}
        poolDailyInflow={poolSummary.dailyInflow}
        poolYtdGrowthPct={poolSummary.ytdGrowthPct}
        onContributeWeekly={() => openContribute(7, { frequency: "weekly" })}
        onContributeMonthly={() => openContribute(31, { frequency: "monthly" })}
        onContributeYearly={() => openContribute(365, { frequency: "yearly" })}
        onContributeOther={() => openContribute(null, { custom: true, frequency: "weekly" })}
        onPoolClick={() => onNavigate?.("pool")}
      />

      <ContributeOnboardingModal
        open={contributeOpen}
        onClose={() => setContributeOpen(false)}
        initialAmount={contributeSeed.amount}
        startOnCustom={contributeSeed.custom}
        contributionFrequency={contributeSeed.frequency}
        onComplete={({ reminderEnabled, recurringEnabled, amount, frequency }) => {
          saveContribution({ amount, reminderEnabled, recurringEnabled, frequency });
        }}
      />
    </>
  );
}
