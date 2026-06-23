import { AlertTriangle, CheckCircle2, Database, UserPlus, Wallet } from "lucide-react";
import PageHeader from "../components/layout/PageHeader";
import DashboardCard, { Badge, StatCard } from "../components/layout/DashboardCard";
import { adminOverview, formatPoolCurrency } from "../data/mockData";
import { useLocale } from "../i18n/LocaleContext";
import { useLocalizedData } from "../i18n/localizedData";
import { useMembers } from "../lib/memberRegistry";
import { usePoolState } from "../lib/poolState";

export default function AdminPage({ onNavigate }) {
  const { t } = useLocale();
  const { loans } = useLocalizedData();
  const { poolSummary } = usePoolState();
  const members = useMembers();

  const adminStats = [
    { key: "pending", label: t("pages.admin.pendingLoans"), value: adminOverview.pendingLoans, icon: Wallet },
    { key: "signups", label: t("pages.admin.weeklySignups"), value: adminOverview.weeklySignups, icon: UserPlus },
    { key: "compliance", label: t("pages.admin.compliance"), value: `${adminOverview.contributionCompliance}%`, icon: CheckCircle2 },
    { key: "flagged", label: t("pages.admin.flagged"), value: adminOverview.flaggedAccounts, icon: AlertTriangle },
  ];

  const poolRows = [
    [t("pages.admin.totalBalance"), formatPoolCurrency(poolSummary.totalBalance)],
    [t("pages.admin.escrowHeld"), formatPoolCurrency(poolSummary.escrowBalance)],
    [t("pages.admin.totalDeployed"), formatPoolCurrency(adminOverview.totalDeployed)],
    [t("stats.poolApy"), `${poolSummary.poolApy}%`],
  ];

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
        <DashboardCard title={t("pages.admin.poolAdmin")}>
          <dl className="space-y-2 text-sm">
            {poolRows.map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-white/10 py-2 last:border-0">
                <dt className="text-gray-400">{k}</dt>
                <dd className="font-semibold tabular-nums text-white">{v}</dd>
              </div>
            ))}
          </dl>
        </DashboardCard>

        <DashboardCard title={t("pages.admin.loanReview")}>
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

      <DashboardCard title={t("pages.admin.memberMgmt")}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-gray-500">
                <th className="pb-2 pr-4 font-semibold">{t("pages.admin.member")}</th>
                <th className="pb-2 pr-4 font-semibold">{t("common.days")}</th>
                <th className="pb-2 pr-4 font-semibold">{t("common.equity")}</th>
                <th className="pb-2 font-semibold">{t("common.score")}</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b border-white/5 last:border-0">
                  <td className="py-2 pr-4 font-medium text-white">{m.name}</td>
                  <td className="py-2 pr-4 text-gray-400">{m.days}</td>
                  <td className="py-2 pr-4 tabular-nums text-dda-green-light">
                    ${m.equity.toLocaleString()}
                  </td>
                  <td className="py-2 text-white">{m.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DashboardCard>
    </div>
  );
}
