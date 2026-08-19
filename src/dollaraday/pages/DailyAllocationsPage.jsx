import { useEffect, useMemo, useState, lazy, Suspense, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import PageHeader from "../components/layout/PageHeader";
import DashboardCard from "../components/layout/DashboardCard";
import { useMembers, withLiveMemberBalances } from "../lib/memberRegistry";
import { getMemberInitials, resolveMemberFromDonation } from "../lib/memberDetails";
import { useDadAuth } from "../context/DadAuthContext";
import { useLocale } from "../i18n/LocaleContext";
import { useLocalizedData } from "../i18n/localizedData";
import { useEasternLiveTime, useLiveRelativeTime } from "../context/EasternTimeContext";
import { getDatabaseRevision, subscribeInternalDatabase } from "../lib/internalDatabase";
import { syncPoolInflowMetrics, usePoolState } from "../lib/poolState";
import { formatPoolCurrency } from "../data/mockData";

const MemberDetailModal = lazy(() => import("../components/members/MemberDetailModal"));

const statusStyles = {
  completed: "text-dda-green-light",
  pending: "text-dda-gold-light",
  failed: "text-red-400",
};

function asCount(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function asMoney(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatComparisonValue(item) {
  const current = asMoney(item?.current);
  if (item?.format === "currency") return formatPoolCurrency(current);
  if (item?.format === "milestone") return String(Math.round(current));
  return String(current);
}

export default function DailyAllocationsPage() {
  const { t } = useLocale();
  const { isAdmin } = useDadAuth();
  const { translateStatus } = useLocalizedData();
  const { todaysDonations, dailyAllocationSummary, allocationComparisons, currentMember } =
    usePoolState();
  const members = useMembers();
  const dbRevision = useSyncExternalStore(
    subscribeInternalDatabase,
    getDatabaseRevision,
    () => 0,
  );
  const [selectedMember, setSelectedMember] = useState(null);
  const { longDate: todayLabel } = useEasternLiveTime();
  const lastUpdatedLabel = useLiveRelativeTime(dailyAllocationSummary?.lastUpdatedAt);

  useEffect(() => {
    syncPoolInflowMetrics();
  }, []);

  const donationRows = useMemo(() => {
    void dbRevision;
    return (Array.isArray(todaysDonations) ? todaysDonations : [])
      .map((donation, index) => {
        const amount = asMoney(donation?.amount);
        const member = String(donation?.member ?? "").trim() || t("common.members");
        return {
          id: String(donation?.id ?? `donation-${index}`),
          member,
          handle: String(donation?.handle ?? ""),
          amount,
          time: String(donation?.time ?? "—"),
          status: donation?.status === "pending" || donation?.status === "failed"
            ? donation.status
            : "completed",
          initials: getMemberInitials(member),
        };
      })
      .filter((row) => row.amount > 0 || row.member);
  }, [todaysDonations, dbRevision, t]);

  const completedCount = donationRows.filter((row) => row.status === "completed").length;
  const pendingCount = asCount(dailyAllocationSummary?.pending);
  const totalDonations = asCount(dailyAllocationSummary?.totalDonations) || donationRows.length;
  const totalAmount = asMoney(dailyAllocationSummary?.totalAmount);

  const memberInvestmentsTotal = useMemo(() => {
    void dbRevision;
    return (Array.isArray(members) ? members : [])
      .filter((member) => {
        const username = member.username?.trim().toLowerCase();
        const handle = member.handle?.trim().toLowerCase();
        return username !== "admin" && handle !== "@admin" && member.status !== "declined";
      })
      .map((member) => withLiveMemberBalances(member))
      .reduce((sum, member) => sum + asMoney(member.equity), 0);
  }, [members, dbRevision]);

  const comparisonItems = Array.isArray(allocationComparisons) ? allocationComparisons : [];

  const openMemberDetail = (donation) => {
    setSelectedMember(resolveMemberFromDonation(donation, members, currentMember));
  };

  if (!isAdmin) {
    return (
      <div className="dda-glass rounded-2xl p-6 text-sm text-gray-400">
        {t("pages.admin.masterOnly")}
      </div>
    );
  }

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
          <p className="text-sm font-medium text-white">{todayLabel || "—"}</p>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-500">{t("pages.allocations.donations")}</p>
            <p className="font-bold tabular-nums text-white">{totalDonations.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">{t("pages.allocations.todayTotal")}</p>
            <p className="font-bold tabular-nums text-white">{formatPoolCurrency(totalAmount)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">{t("pages.allocations.investmentsTotal")}</p>
            <p className="font-bold tabular-nums text-dda-green-light">
              {formatPoolCurrency(memberInvestmentsTotal)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">{t("pages.allocations.updated")}</p>
            <p className="font-medium text-gray-300">{lastUpdatedLabel}</p>
          </div>
        </div>
      </div>

      {comparisonItems.length ? (
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          {comparisonItems.map((item) => (
            <div key={item.id || item.label} className="dda-glass rounded-2xl px-3 py-3 sm:px-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                {item.label}
              </p>
              <p className="mt-1 text-lg font-bold tabular-nums text-white">
                {formatComparisonValue(item)}
              </p>
              <p className="mt-0.5 text-[11px] text-gray-500">{item.caption}</p>
            </div>
          ))}
        </div>
      ) : null}

      <DashboardCard
        title={t("pages.allocations.todaysDonations")}
        subtitle={t("pages.allocations.completedPending", {
          completed: completedCount.toLocaleString(),
          pending: pendingCount,
        })}
        noPadding
      >
        {donationRows.length ? (
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
              {donationRows.map((donation, index) => (
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
                    index % 2 === 0 ? "bg-white/[0.03]" : "bg-transparent",
                  )}
                >
                  <td className="px-2 py-1.5 sm:px-3">
                    <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-dda-green-light/10 text-[9px] font-bold text-dda-green-light">
                        {donation.initials}
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
                      statusStyles[donation.status] ?? "text-gray-400",
                    )}
                  >
                    {translateStatus(donation.status)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-4 py-8 text-center text-sm text-gray-500">
            {t("pages.allocations.empty")}
          </p>
        )}

        <div className="border-t border-white/10 bg-black/20 px-3 py-2 text-center text-[11px] text-gray-500">
          {t("pages.allocations.showingRecent", {
            count: Math.max(0, totalDonations - donationRows.length).toLocaleString(),
          })}
        </div>
      </DashboardCard>

      {selectedMember ? (
        <Suspense fallback={null}>
          <MemberDetailModal
            member={selectedMember}
            open={Boolean(selectedMember)}
            onClose={() => setSelectedMember(null)}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
