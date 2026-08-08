import { useEffect, useState, lazy, Suspense } from "react";
import { AlertTriangle, CheckCircle2, Database, UserPlus, Wallet } from "lucide-react";
import PageHeader from "../components/layout/PageHeader";
import DashboardCard, { Badge } from "../components/layout/DashboardCard";
import { adminOverview, formatPoolCurrency } from "../data/mockData";
import { useDadAuth } from "../context/DadAuthContext";
import { useLocale } from "../i18n/LocaleContext";
import { useLocalizedData } from "../i18n/localizedData";
import {
  consumePendingAdminProfileId,
  subscribePendingAdminProfileId,
} from "../lib/adminProfileNavigation";
import { findDadProfileById } from "../lib/dadProfileStorage";
import {
  approveDadProfileByAdmin,
  denyDadProfileByAdmin,
} from "../lib/profileAdminActions";
import { useAdminMemberRecords } from "../lib/profileRegistry";
import { usePoolState } from "../lib/poolState";

const AdminMemberDetailModal = lazy(() => import("../components/admin/AdminMemberDetailModal"));
const AdminSettingsCard = lazy(() => import("../components/admin/AdminSettingsCard"));
const MemberSettingsCard = lazy(() => import("../components/members/MemberSettingsCard"));

export default function AdminPage({ onNavigate }) {
  const { t } = useLocale();
  const { isAdmin } = useDadAuth();
  const { loans, translateStatus } = useLocalizedData();
  const { poolSummary } = usePoolState();
  const registeredMembers = useAdminMemberRecords();
  const [selectedProfileId, setSelectedProfileId] = useState(null);
  const [rowActionError, setRowActionError] = useState("");
  const [rowActionBusyId, setRowActionBusyId] = useState(null);
  const pendingApprovals = registeredMembers.filter((member) => member.status === "pending").length;

  const openProfile = (profileId) => {
    if (!profileId) return;
    setRowActionError("");
    setSelectedProfileId(profileId);
  };

  useEffect(() => {
    const pendingProfileId = consumePendingAdminProfileId();
    if (pendingProfileId) openProfile(pendingProfileId);

    return subscribePendingAdminProfileId((profileId) => {
      consumePendingAdminProfileId();
      openProfile(profileId);
    });
  }, []);

  if (!isAdmin) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <PageHeader
          title={t("nav.settings")}
          description={t("memberProfile.settings.subtitle")}
        />
        <Suspense fallback={<div className="dda-glass min-h-[160px] animate-pulse rounded-2xl" aria-hidden="true" />}>
          <MemberSettingsCard embedded />
        </Suspense>
      </div>
    );
  }

  const adminStats = [
    { key: "pending", label: t("pages.admin.pendingLoans"), value: adminOverview.pendingLoans, icon: Wallet },
    { key: "approvals", label: t("pages.admin.pendingApprovals"), value: pendingApprovals, icon: UserPlus },
    { key: "compliance", label: t("pages.admin.compliance"), value: `${adminOverview.contributionCompliance}%`, icon: CheckCircle2 },
    { key: "flagged", label: t("pages.admin.flagged"), value: adminOverview.flaggedAccounts, icon: AlertTriangle },
  ];

  const poolRows = [
    [t("pages.admin.totalBalance"), formatPoolCurrency(poolSummary.totalBalance)],
    [t("pages.admin.escrowHeld"), formatPoolCurrency(poolSummary.escrowBalance)],
    [t("pages.admin.totalDeployed"), formatPoolCurrency(adminOverview.totalDeployed)],
    [t("stats.poolApy"), `${poolSummary.poolApy}%`],
  ];

  const handleApproveRow = async (event, member) => {
    event.stopPropagation();
    const profileId = member.profileId ?? member.id;
    if (!findDadProfileById(profileId)) {
      setRowActionError(t("pages.admin.memberDetailMissing"));
      openProfile(profileId);
      return;
    }
    if (!window.confirm(t("pages.admin.profileApproveConfirm", { name: member.name }))) return;

    setRowActionError("");
    setRowActionBusyId(profileId);
    const result = await approveDadProfileByAdmin(profileId);
    setRowActionBusyId(null);
    if (!result.ok) {
      setRowActionError(result.error);
    }
  };

  const handleDenyRow = (event, member) => {
    event.stopPropagation();
    const profileId = member.profileId ?? member.id;
    if (!findDadProfileById(profileId)) {
      setRowActionError(t("pages.admin.memberDetailMissing"));
      openProfile(profileId);
      return;
    }
    if (!window.confirm(t("pages.admin.profileDenyConfirm", { name: member.name }))) return;

    setRowActionError("");
    setRowActionBusyId(profileId);
    const result = denyDadProfileByAdmin(profileId);
    setRowActionBusyId(null);
    if (!result.ok) {
      setRowActionError(result.error);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title={t("pages.admin.title")}
        description={t("pages.admin.description")}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate?.("admin-bins")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-dda-green/25 bg-dda-green/10 px-3 py-2 text-xs font-semibold text-dda-green-light transition hover:border-dda-gold-light/30 hover:bg-dda-green/15"
            >
              <Database className="h-3.5 w-3.5" />
              {t("pages.admin.dataBins")}
            </button>
            <Badge variant="warning">{t("pages.admin.adminView")}</Badge>
          </div>
        }
      />

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {adminStats.map(({ key, label, value, icon: Icon }) => (
          <div key={key} className="dda-glass rounded-2xl p-4">
            <Icon className="h-4 w-4 text-dda-green-light" />
            <p className="mt-2 text-xs uppercase tracking-wider text-gray-500">{label}</p>
            <p className="mt-1 text-xl font-bold text-white">{value}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <DashboardCard
          title={t("pages.admin.poolAdmin")}
          collapsible
          defaultCollapsed
          collapseAriaLabel={t("pages.admin.collapsePoolAdmin")}
          expandAriaLabel={t("pages.admin.expandPoolAdmin")}
        >
          <dl className="space-y-2 text-sm">
            {poolRows.map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-white/10 py-2 last:border-0">
                <dt className="text-gray-400">{k}</dt>
                <dd className="font-semibold tabular-nums text-white">{v}</dd>
              </div>
            ))}
          </dl>
        </DashboardCard>

        <DashboardCard
          title={t("pages.admin.loanReview")}
          collapsible
          defaultCollapsed
          collapseAriaLabel={t("pages.admin.collapseLoanReview")}
          expandAriaLabel={t("pages.admin.expandLoanReview")}
        >
          <ul className="space-y-2">
            {loans.map((loan) => (
              <li
                key={loan.id}
                className="dda-panel flex items-center justify-between rounded-xl px-3 py-2 text-sm"
              >
                <span className="text-gray-300">{loan.member}</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">{formatPoolCurrency(loan.amount)}</span>
                  <button
                    type="button"
                    className="rounded-md bg-dda-green-light/20 px-2 py-0.5 text-[10px] font-semibold text-dda-green-light"
                  >
                    {t("common.review")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </DashboardCard>
      </div>

      <DashboardCard
        title={t("pages.admin.memberMgmt")}
        subtitle={t("pages.admin.memberMgmtSub", {
          count: registeredMembers.length.toLocaleString(),
        })}
        scrollable
        collapsible
        defaultCollapsed={false}
        collapseAriaLabel={t("pages.admin.collapseMemberMgmt")}
        expandAriaLabel={t("pages.admin.expandMemberMgmt")}
      >
        {rowActionError ? (
          <p className="mb-3 text-sm text-red-400">{rowActionError}</p>
        ) : null}
        {registeredMembers.length ? (
          <table className="dda-admin-member-table w-full table-fixed border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-gray-500 sm:text-xs">
                <th className="pb-2 pr-2 font-semibold sm:pr-3">{t("pages.admin.member")}</th>
                <th className="w-[5.5rem] pb-2 pr-2 font-semibold">{t("pages.admin.proId")}</th>
                <th className="w-[4.5rem] pb-2 pr-2 font-semibold">{t("pages.admin.memberStatus")}</th>
                <th className="w-[7.5rem] pb-2 pr-2 font-semibold sm:w-[8.5rem]">
                  {t("pages.admin.memberActions")}
                </th>
                <th className="w-[3rem] pb-2 pr-2 text-right font-semibold sm:w-14">{t("common.days")}</th>
                <th className="hidden w-[5rem] pb-2 pr-2 text-right font-semibold sm:table-cell sm:w-24">
                  {t("memberModal.contributed")}
                </th>
                <th className="w-[5rem] pb-2 pr-2 text-right font-semibold sm:w-24">{t("common.equity")}</th>
                <th className="hidden w-[3.5rem] pb-2 pr-2 text-right font-semibold md:table-cell">
                  {t("memberModal.streak")}
                </th>
                <th className="w-[3rem] pb-2 text-right font-semibold sm:w-14">{t("common.score")}</th>
              </tr>
            </thead>
            <tbody>
              {registeredMembers.map((member) => {
                const profileId = member.profileId ?? member.id;
                const isPending = member.status === "pending";
                const isDenied = member.status === "declined";
                const busy = rowActionBusyId === profileId;
                return (
                  <tr key={member.id} className="border-b border-white/5 last:border-0">
                    <td className="max-w-0 py-2 pr-2 sm:pr-3">
                      <button
                        type="button"
                        onClick={() => openProfile(profileId)}
                        className="w-full text-left"
                      >
                        <span className="block truncate font-medium text-white hover:text-dda-green-light">
                          {member.name}
                        </span>
                        <span className="block truncate text-[11px] text-gray-500">
                          {member.username ? `@${member.username}` : member.handle}
                        </span>
                      </button>
                    </td>
                    <td className="py-2 pr-2">
                      <button
                        type="button"
                        onClick={() => openProfile(profileId)}
                        className="truncate font-mono text-[11px] text-amber-300 hover:text-amber-200"
                        title={member.proId}
                      >
                        {member.proId || "—"}
                      </button>
                    </td>
                    <td className="py-2 pr-2">
                      <Badge
                        variant={
                          member.status === "active"
                            ? "success"
                            : member.status === "pending"
                              ? "warning"
                              : member.status === "declined"
                                ? "danger"
                                : "default"
                        }
                      >
                        {translateStatus(member.status)}
                      </Badge>
                    </td>
                    <td className="py-2 pr-2">
                      {isPending || isDenied ? (
                        <div className="flex flex-wrap items-center gap-1">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={(event) => handleApproveRow(event, member)}
                            className="rounded-md bg-dda-green/20 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-dda-green-light transition hover:bg-dda-green/30 disabled:opacity-50"
                          >
                            {t("pages.admin.profileApprove")}
                          </button>
                          {isPending ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={(event) => handleDenyRow(event, member)}
                              className="rounded-md bg-red-500/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-red-300 transition hover:bg-red-500/25 disabled:opacity-50"
                            >
                              {t("pages.admin.profileDeny")}
                            </button>
                          ) : null}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openProfile(profileId)}
                          className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 transition hover:text-white"
                        >
                          {t("pages.admin.memberOpen")}
                        </button>
                      )}
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums text-gray-400">{member.days}</td>
                    <td className="hidden py-2 pr-2 text-right text-xs tabular-nums text-white sm:table-cell sm:text-sm">
                      ${member.contributed.toLocaleString()}
                    </td>
                    <td className="py-2 pr-2 text-right text-xs tabular-nums text-dda-green-light sm:text-sm">
                      ${member.equity.toLocaleString()}
                    </td>
                    <td className="hidden py-2 pr-2 text-right tabular-nums text-white md:table-cell">
                      {member.streak}
                    </td>
                    <td className="py-2 text-right tabular-nums text-white">{member.score}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-gray-500">{t("pages.admin.memberMgmtEmpty")}</p>
        )}
      </DashboardCard>

      <Suspense fallback={<div className="dda-glass min-h-[120px] animate-pulse rounded-2xl" aria-hidden="true" />}>
        <AdminSettingsCard />
      </Suspense>

      {selectedProfileId ? (
        <Suspense fallback={null}>
          <AdminMemberDetailModal
            profileId={selectedProfileId}
            open={Boolean(selectedProfileId)}
            onClose={() => setSelectedProfileId(null)}
            onProfileDeleted={() => setSelectedProfileId(null)}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
