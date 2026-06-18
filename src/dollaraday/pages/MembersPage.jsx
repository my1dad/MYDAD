import { useState } from "react";
import { Activity, Star, Users } from "lucide-react";
import PageHeader from "../components/layout/PageHeader";
import DashboardCard from "../components/layout/DashboardCard";
import OpenChatRoomButton from "../components/community/OpenChatRoomButton";
import MemberCard from "../components/members/MemberCard";
import MemberDetailModal from "../components/members/MemberDetailModal";
import { getMemberInitials } from "../lib/memberDetails";
import { useFeaturedMembers, useMembers } from "../lib/memberRegistry";
import { useLocale } from "../i18n/LocaleContext";
import { usePoolState } from "../lib/poolState";

function MemberStatCard({ title, value, icon: Icon, accent, bg, bgDeep, border }) {
  return (
    <div
      className="dda-member-stat dda-glass-btn group relative flex min-w-0 flex-1 flex-col p-3 sm:p-5"
      style={{
        background: `linear-gradient(165deg, ${bg} 0%, ${bgDeep} 52%, rgba(7, 16, 19, 0.88) 100%)`,
        borderColor: border,
        boxShadow: `inset 0 1px 0 ${border}, 0 8px 20px rgba(0, 0, 0, 0.22)`,
      }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${accent}99, transparent)`,
        }}
        aria-hidden="true"
      />
      <div className="relative flex items-start justify-between gap-2">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset transition group-hover:scale-105 sm:h-10 sm:w-10"
          style={{
            backgroundColor: `${accent}18`,
            color: accent,
            boxShadow: `inset 0 0 0 1px ${accent}33`,
          }}
        >
          <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" strokeWidth={2.25} />
        </span>
        <span
          className="mt-1 h-2 w-2 shrink-0 rounded-full opacity-90"
          style={{ backgroundColor: accent }}
          aria-hidden="true"
        />
      </div>

      <p className="relative mt-3 text-[10px] font-semibold uppercase tracking-wide text-gray-500 sm:text-[11px]">
        {title}
      </p>
      <p className="relative mt-1 truncate text-lg font-bold tabular-nums leading-none text-white sm:mt-1.5 sm:text-2xl">
        {value}
      </p>

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px opacity-60"
        style={{
          background: `linear-gradient(90deg, transparent, ${accent}66, transparent)`,
        }}
        aria-hidden="true"
      />
    </div>
  );
}

export default function MembersPage() {
  const { t } = useLocale();
  const [selectedMember, setSelectedMember] = useState(null);
  const { poolSummary } = usePoolState();
  const members = useMembers();
  const featuredMembers = useFeaturedMembers(3);

  const memberStats = [
    {
      key: "active",
      title: t("pages.members.activeMembers"),
      icon: Users,
      accent: "#34d399",
      bg: "rgba(16, 185, 129, 0.24)",
      bgDeep: "rgba(4, 47, 46, 0.72)",
      border: "rgba(52, 211, 153, 0.38)",
      value: () => members.filter((m) => m.status === "active").length.toLocaleString(),
    },
    {
      key: "contributors",
      title: t("pages.members.dailyContributors"),
      icon: Activity,
      accent: "#38bdf8",
      bg: "rgba(56, 189, 248, 0.22)",
      bgDeep: "rgba(8, 47, 73, 0.72)",
      border: "rgba(56, 189, 248, 0.38)",
      value: (summary) => summary.memberCount.toLocaleString(),
    },
    {
      key: "score",
      title: t("pages.members.avgScore"),
      icon: Star,
      accent: "#fbbf24",
      bg: "rgba(251, 191, 36, 0.2)",
      bgDeep: "rgba(69, 45, 8, 0.72)",
      border: "rgba(251, 191, 36, 0.38)",
      value: () => "82",
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title={t("pages.members.title")}
        description={t("pages.members.description")}
        titleAction={<OpenChatRoomButton />}
      />

      <section className="grid grid-cols-3 gap-2 sm:gap-4">
        {memberStats.map((stat) => (
          <MemberStatCard key={stat.key} {...stat} value={stat.value(poolSummary)} />
        ))}
      </section>

      <div className="grid grid-cols-2 gap-2 sm:gap-4 xl:grid-cols-3">
        {members.map((member) => (
          <MemberCard key={member.id} member={member} onClick={setSelectedMember} modern />
        ))}
      </div>

      <DashboardCard title={t("pages.members.featured")} subtitle={t("pages.members.featuredSubtitle")}>
        <div className="space-y-2">
          {featuredMembers.map((member, index) => {
            const fullMember = members.find((m) => m.id === member.id) ?? member;
            return (
              <button
                key={member.id}
                type="button"
                onClick={() => setSelectedMember(fullMember)}
                className="dda-featured-member dda-glass-btn group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm transition hover:border-emerald-400/20"
              >
                <span className="relative flex min-w-0 items-center gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400/25 to-emerald-600/10 text-[10px] font-bold text-emerald-300 ring-1 ring-emerald-400/25">
                    {getMemberInitials(member.name)}
                  </span>
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0 text-[10px] font-bold tabular-nums text-gray-600">
                      #{index + 1}
                    </span>
                    <span className="truncate font-medium text-gray-300 transition group-hover:text-white">
                      {member.name}
                    </span>
                  </span>
                </span>
                <span className="relative ml-2 shrink-0 text-right">
                  <span className="block text-[10px] uppercase tracking-wide text-gray-500">
                    {t("common.equity")}
                  </span>
                  <span className="font-semibold tabular-nums text-emerald-400">
                    ${member.equity.toLocaleString()}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </DashboardCard>

      <MemberDetailModal
        member={selectedMember}
        open={Boolean(selectedMember)}
        onClose={() => setSelectedMember(null)}
      />
    </div>
  );
}
