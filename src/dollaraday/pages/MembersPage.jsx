import { useEffect, useMemo, useState } from "react";
import { Activity, Star, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import PageHeader from "../components/layout/PageHeader";
import DashboardCard from "../components/layout/DashboardCard";
import MemberDetailModal from "../components/members/MemberDetailModal";
import { getMemberInitials } from "../lib/memberDetails";
import { useDadAuth } from "../context/DadAuthContext";
import { isMemberProfile } from "../../config/memberProfile";
import { setPendingAdminProfileId } from "../lib/adminProfileNavigation";
import { useFeaturedMembers, useMembers } from "../lib/memberRegistry";
import { useLocale } from "../i18n/LocaleContext";
import { useLocalizedData } from "../i18n/localizedData";
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

export default function MembersPage({ onNavigate }) {
  const { t } = useLocale();
  const { isAdmin, profile } = useDadAuth();
  const { translateStatus } = useLocalizedData();
  const [selectedMember, setSelectedMember] = useState(null);
  const { poolSummary } = usePoolState();
  const members = useMembers();
  const featuredMembers = useFeaturedMembers(3);

  const myMember = useMemo(
    () =>
      profile
        ? members.find(
            (member) => member.profileId === profile.id || member.id === profile.id,
          )
        : null,
    [members, profile],
  );

  const isOwnProfileOpen =
    Boolean(selectedMember) &&
    Boolean(profile) &&
    isMemberProfile(profile) &&
    (selectedMember.profileId === profile.id || selectedMember.id === profile.id);

  const handleOpenProfileRegistry = (member) => {
    const profileId = member.profileId ?? member.id;
    setPendingAdminProfileId(profileId);
    setSelectedMember(null);
    onNavigate?.("admin");
  };

  const memberStats = [
    {
      key: "active",
      title: t("pages.members.activeMembers"),
      icon: Users,
      accent: "var(--color-dda-green-light)",
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
      accent: "var(--color-dda-gold-light)",
      bg: "rgba(251, 191, 36, 0.2)",
      bgDeep: "rgba(69, 45, 8, 0.72)",
      border: "rgba(251, 191, 36, 0.38)",
      value: () => {
        const active = members.filter((member) => member.status === "active");
        if (!active.length) return "—";
        const average = Math.round(
          active.reduce((sum, member) => sum + member.score, 0) / active.length,
        );
        return String(average);
      },
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title={t("pages.members.title")}
        description={t("pages.members.description")}
      />

      {!isAdmin && myMember ? (
        <DashboardCard
          title={t("pages.members.myProfile")}
          subtitle={t("pages.members.myProfileSub")}
        >
          <button
            type="button"
            onClick={() => setSelectedMember(myMember)}
            className="dda-glass-btn flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left transition hover:border-dda-green-light/25"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-dda-green-light/25 to-dda-green/10 text-sm font-bold text-dda-green-soft ring-1 ring-dda-green-light/30">
                {getMemberInitials(myMember.name)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-base font-semibold text-white">{myMember.name}</span>
                <span className="block truncate text-sm text-gray-500">
                  {myMember.handle} · {t("pages.members.myProfileHint")}
                </span>
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-[10px] uppercase tracking-wide text-gray-500">
                {t("common.equity")}
              </span>
              <span className="font-semibold tabular-nums text-dda-green-light">
                ${myMember.equity.toLocaleString()}
              </span>
            </span>
          </button>
        </DashboardCard>
      ) : null}

      <section className="grid grid-cols-3 gap-2 sm:gap-4">
        {memberStats.map((stat) => (
          <MemberStatCard key={stat.key} {...stat} value={stat.value(poolSummary)} />
        ))}
      </section>

      <DashboardCard
        title={t("pages.members.directory")}
        subtitle={t("pages.members.directorySubtitle", { count: members.length.toLocaleString() })}
        scrollable
      >
        <div className="dda-members-list" role="list">
          {members.map((member) => (
            <button
              key={member.id}
              type="button"
              role="listitem"
              onClick={() => setSelectedMember(member)}
              className="dda-members-list__row group"
            >
              <span className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-dda-green-light/25 to-dda-green/10 text-[10px] font-bold text-dda-green-soft ring-1 ring-dda-green-light/25 sm:h-9 sm:w-9 sm:text-xs">
                  {getMemberInitials(member.name)}
                </span>
                <span className="min-w-0 text-left">
                  <span className="block truncate text-sm font-medium text-gray-200 transition group-hover:text-white">
                    {member.name}
                  </span>
                  <span className="block truncate text-xs text-gray-500">{member.handle}</span>
                </span>
              </span>

              <span
                className={cn(
                  "hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide sm:inline-flex sm:text-[11px] dda-members-list__status",
                  member.status === "active"
                    ? "dda-members-list__status--active"
                    : "dda-members-list__status--inactive"
                )}
              >
                {translateStatus(member.status)}
              </span>

              <span className="ml-3 shrink-0 text-right sm:ml-4">
                <span className="block text-[10px] uppercase tracking-wide text-gray-500">
                  {t("common.equity")}
                </span>
                <span className="font-semibold tabular-nums text-dda-green-light">
                  ${member.equity.toLocaleString()}
                </span>
              </span>

              <span className="ml-3 hidden shrink-0 text-right sm:ml-4 sm:block">
                <span className="block text-[10px] uppercase tracking-wide text-gray-500">
                  {t("common.score")}
                </span>
                <span className="font-semibold tabular-nums text-white">{member.score}</span>
              </span>
            </button>
          ))}
        </div>
      </DashboardCard>

      <DashboardCard
        title={t("pages.members.featured")}
        subtitle={t("pages.members.featuredSubtitle")}
        scrollable
      >
        <div className="space-y-2">
          {featuredMembers.map((member, index) => {
            const fullMember = members.find((m) => m.id === member.id) ?? member;
            return (
              <button
                key={member.id}
                type="button"
                onClick={() => setSelectedMember(fullMember)}
                className="dda-featured-member dda-glass-btn group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm transition hover:border-dda-green-light/20"
              >
                <span className="relative flex min-w-0 items-center gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-dda-green-light/25 to-dda-green/10 text-[10px] font-bold text-dda-green-soft ring-1 ring-dda-green-light/25">
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
                  <span className="font-semibold tabular-nums text-dda-green-light">
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
        isAdmin={isAdmin}
        isOwnProfile={isOwnProfileOpen}
        onOpenProfileRegistry={handleOpenProfileRegistry}
      />
    </div>
  );
}
