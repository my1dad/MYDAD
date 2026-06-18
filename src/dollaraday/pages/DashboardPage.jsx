import { useState } from "react";
import PageHeader from "../components/layout/PageHeader";
import ContributeOnboardingModal from "../components/onboarding/ContributeOnboardingModal";
import DashboardCard, {
  FeatureCard,
  PoolSecondaryStats,
  ProgressBar,
} from "../components/layout/DashboardCard";
import LiquidityPoolInfographic from "../components/layout/LiquidityPoolInfographic";
import MemberCard from "../components/members/MemberCard";
import MemberDetailModal from "../components/members/MemberDetailModal";
import { useFeaturedMembers, useMembers } from "../lib/memberRegistry";
import { useLocale } from "../i18n/LocaleContext";
import { useLocalizedData } from "../i18n/localizedData";
import { saveContribution } from "../lib/storageWrites";
import { usePoolState } from "../lib/poolState";

export default function DashboardPage({ onNavigate }) {
  const { t } = useLocale();
  const { featureCards, investmentFunnel, dashboardStatsLabels, statHints } = useLocalizedData();
  const [contributeOpen, setContributeOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const { dashboardStats } = usePoolState();
  const members = useMembers();
  const featuredMembers = useFeaturedMembers(3);

  const localizedStats = {
    escrow: { ...dashboardStats.escrow, label: dashboardStatsLabels.escrow },
    daily: { ...dashboardStats.daily, label: dashboardStatsLabels.daily },
    apy: { ...dashboardStats.apy, label: dashboardStatsLabels.apy },
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        variant="hero"
        kicker={t("brand.kicker")}
        title={t("brand.name")}
        titleClassName="text-[2.25rem] sm:text-[3.25rem] lg:text-[4.5rem] bg-gradient-to-br from-[#84cc16] via-lime-300 to-[#bef264] bg-clip-text text-transparent [filter:drop-shadow(0_0_6px_rgba(132,204,22,0.22))]"
        description={t("pages.dashboard.description")}
        highlights={t("pages.dashboard.highlights")}
        action={
          <button
            type="button"
            onClick={() => setContributeOpen(true)}
            className="w-full rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 px-4 py-3 text-sm font-semibold text-[#071013] shadow-lg shadow-emerald-500/20 transition-all duration-200 hover:from-[#84cc16] hover:via-lime-300 hover:to-[#bef264] hover:shadow-lime-400/30 sm:w-auto"
          >
            {t("pages.dashboard.contribute")}
          </button>
        }
      />

      <ContributeOnboardingModal
        open={contributeOpen}
        onClose={() => setContributeOpen(false)}
        onComplete={({ reminderEnabled, recurringEnabled, amount }) => {
          saveContribution({ amount, reminderEnabled, recurringEnabled });
        }}
      />

      <LiquidityPoolInfographic />

      <PoolSecondaryStats stats={localizedStats} hints={statHints} />

      <section className="grid gap-4 lg:grid-cols-3">
        <DashboardCard className="lg:col-span-2" title={t("pages.dashboard.memberProfiles")} noPadding>
          <div className="space-y-3 p-5 pt-0">
            {featuredMembers.map((member) => {
              const fullMember = members.find((m) => m.id === member.id) ?? member;
              return (
                <MemberCard
                  key={member.id}
                  member={fullMember}
                  onClick={setSelectedMember}
                />
              );
            })}
          </div>
        </DashboardCard>

        <DashboardCard title={t("pages.dashboard.investmentFunnel")} noPadding>
          <div className="space-y-4 p-5 pt-0">
            {investmentFunnel.map((item) => (
              <div key={item.key}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-gray-200">{item.name}</span>
                  <span className="font-medium text-emerald-400">{item.percent}%</span>
                </div>
                <ProgressBar value={item.percent} />
              </div>
            ))}
          </div>
        </DashboardCard>
      </section>

      <MemberDetailModal
        member={selectedMember}
        open={Boolean(selectedMember)}
        onClose={() => setSelectedMember(null)}
      />

      <section className="grid gap-4 md:grid-cols-3">
        {featureCards.map((card) => (
          <FeatureCard
            key={card.id}
            title={card.title}
            desc={card.desc}
            onClick={() => onNavigate(card.page)}
          />
        ))}
      </section>
    </div>
  );
}
