import { useState } from "react";
import { cn } from "@/lib/utils";
import PageHeader from "../components/layout/PageHeader";
import DashboardCard from "../components/layout/DashboardCard";
import AllocationAnalyticsGrid from "../components/allocations/AllocationAnalyticsGrid";
import MemberDetailModal from "../components/members/MemberDetailModal";
import { useMembers } from "../lib/memberRegistry";
import { resolveMemberFromDonation } from "../lib/memberDetails";
import { useLocale } from "../i18n/LocaleContext";
import { useLocalizedData } from "../i18n/localizedData";
import { easternNow, formatEasternLongDate, formatRelativeTimeFromNow } from "../lib/dateTime";
import { usePoolState } from "../lib/poolState";
import { formatPoolCurrency } from "../data/mockData";

const statusStyles = {
  completed: "text-dda-green-light",
  pending: "text-dda-gold-light",
  failed: "text-red-400",
};

export default function DailyAllocationsPage() {
  const { t, locale } = useLocale();
  const { allocationComparisons, translateStatus } = useLocalizedData();
  const { todaysDonations, dailyAllocationSummary, currentMember } = usePoolState();
  const members = useMembers();
  const [selectedMember, setSelectedMember] = useState(null);
  const completedCount = todaysDonations.filter((d) => d.status === "completed").length;
  const todayLabel = formatEasternLongDate(easternNow(), locale);
  const lastUpdatedLabel = formatRelativeTimeFromNow(
    dailyAllocationSummary.lastUpdatedAt ?? easternNow(),
    t,
    locale,
  );

  const openMemberDetail = (donation) => {
    setSelectedMember(resolveMemberFromDonation(donation, members, currentMember));
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title={t("pages.allocations.title")}
        description={t("pages.allocations.description")}
      />

      <div className="dda-glass flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 sm:px-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-dda-green-light">
            {t("common.today")}
          </p>
          <p className="text-sm font-medium text-white">{todayLabel}</p>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-500">{t("pages.allocations.donations")}</p>
            <p className="font-bold tabular-nums text-white">
              {dailyAllocationSummary.totalDonations.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">{t("pages.allocations.total")}</p>
            <p className="font-bold tabular-nums text-dda-green-light">
              {formatPoolCurrency(dailyAllocationSummary.totalAmount)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">{t("pages.allocations.updated")}</p>
            <p className="font-medium text-gray-300">{lastUpdatedLabel}</p>
          </div>
        </div>
      </div>

      <DashboardCard
        title={t("pages.allocations.todaysDonations")}
        subtitle={t("pages.allocations.completedPending", {
          completed: completedCount.toLocaleString(),
          pending: dailyAllocationSummary.pending,
        })}
        noPadding
      >
        <table className="w-full table-fixed border-collapse text-left">
          <colgroup>
            <col className="w-[42%]" />
            <col className="w-[16%]" />
            <col className="w-[24%]" />
            <col className="w-[18%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-white/10 bg-black/25 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              <th className="px-2 py-1.5 font-semibold sm:px-3">{t("pages.allocations.contributor")}</th>
              <th className="px-2 py-1.5 font-semibold sm:px-3">{t("pages.allocations.amount")}</th>
              <th className="px-2 py-1.5 font-semibold sm:px-3">{t("pages.allocations.time")}</th>
              <th className="px-2 py-1.5 text-right font-semibold sm:px-3">{t("pages.allocations.status")}</th>
            </tr>
          </thead>
          <tbody>
            {todaysDonations.map((donation, index) => (
              <tr
                key={donation.id}
                role="button"
                tabIndex={0}
                onClick={() => openMemberDetail(donation)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openMemberDetail(donation);
                  }
                }}
                className={cn(
                  "cursor-pointer border-b border-white/[0.04] text-xs text-gray-300 transition-colors hover:bg-dda-green-light/[0.08] focus:bg-dda-green-light/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-dda-green/40",
                  index % 2 === 0 ? "bg-white/[0.03]" : "bg-transparent"
                )}
              >
                <td className="px-2 py-1.5 sm:px-3">
                  <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-dda-green-light/10 text-[9px] font-bold text-dda-green-light">
                      {donation.member
                        .split(" ")
                        .map((part) => part[0])
                        .join("")
                        .slice(0, 2)}
                    </span>
                    <span className="min-w-0 overflow-hidden">
                      <span className="block truncate font-medium text-white">{donation.member}</span>
                      <span className="block truncate text-[10px] text-gray-500">{donation.handle}</span>
                    </span>
                  </div>
                </td>
                <td className="px-2 py-1.5 font-semibold tabular-nums text-dda-green-light sm:px-3">
                  ${donation.amount.toFixed(2)}
                </td>
                <td className="px-2 py-1.5 tabular-nums text-gray-400 sm:px-3">
                  <span className="block truncate">{donation.time}</span>
                </td>
                <td
                  className={cn(
                    "px-2 py-1.5 text-right text-[10px] font-semibold sm:px-3 sm:text-[11px]",
                    statusStyles[donation.status] ?? "text-gray-400"
                  )}
                >
                  {translateStatus(donation.status)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-t border-white/10 bg-black/20 px-3 py-2 text-center text-[11px] text-gray-500">
          {t("pages.allocations.showingRecent", {
            count: Math.max(0, dailyAllocationSummary.totalDonations - todaysDonations.length).toLocaleString(),
          })}
        </div>
      </DashboardCard>

      <AllocationAnalyticsGrid comparisons={allocationComparisons} />

      <MemberDetailModal
        member={selectedMember}
        open={Boolean(selectedMember)}
        onClose={() => setSelectedMember(null)}
      />
    </div>
  );
}
