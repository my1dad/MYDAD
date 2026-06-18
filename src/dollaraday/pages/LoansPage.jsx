import { FileText } from "lucide-react";
import PageHeader from "../components/layout/PageHeader";
import DashboardCard, { Badge, ProgressBar, StatCard } from "../components/layout/DashboardCard";
import { formatPoolCurrency } from "../data/mockData";
import { useLocale } from "../i18n/LocaleContext";
import { useLocalizedData } from "../i18n/localizedData";
import { usePoolState } from "../lib/poolState";

const statusVariant = {
  approved: "success",
  in_review: "info",
  declined: "danger",
};

export default function LoansPage() {
  const { t } = useLocale();
  const { loans, loanEligibilityFactors, translateStatus, translateTier } = useLocalizedData();
  const { currentMember } = usePoolState();
  const score = currentMember.loanEligibilityScore;

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title={t("pages.loans.title")}
        description={t("pages.loans.description")}
        action={
          <button
            type="button"
            className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-[#071013] hover:bg-emerald-400"
          >
            {t("pages.loans.apply")}
          </button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <StatCard title={t("pages.loans.yourScore")} value={String(score)} />
        <StatCard title={t("pages.loans.equityValue")} value={formatPoolCurrency(currentMember.equityValue)} />
        <StatCard
          title={t("pages.loans.maxRequest")}
          value={formatPoolCurrency(currentMember.totalContributed * 3)}
        />
      </div>

      <DashboardCard
        title={t("pages.loans.eligibility")}
        subtitle={`${currentMember.name} · ${translateTier(currentMember.tier)}`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/10 ring-1 ring-emerald-400/30">
            <span className="text-3xl font-bold text-emerald-400">{score}</span>
          </div>
          <div className="flex-1">
            <Badge variant="success">{t("pages.loans.eligibleBadge")}</Badge>
            <p className="mt-2 text-sm text-gray-400">{t("pages.loans.eligibleCopy")}</p>
          </div>
        </div>
      </DashboardCard>

      <DashboardCard title={t("pages.loans.scoreBreakdown")}>
        <ul className="space-y-3">
          {loanEligibilityFactors.map((factor) => (
            <li key={factor.label}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-gray-400">{factor.label}</span>
                <span className="text-gray-500">{factor.weight} · {factor.score}/100</span>
              </div>
              <ProgressBar value={factor.score} />
            </li>
          ))}
        </ul>
      </DashboardCard>

      <DashboardCard title={t("pages.loans.loanQueue")}>
        <ul className="space-y-2">
          {loans.map((loan) => (
            <li key={loan.id} className="dda-panel flex flex-col gap-2 rounded-xl p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-white">{loan.member}</p>
                <p className="text-sm text-gray-400">{loan.purpose}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold tabular-nums text-white">
                  {formatPoolCurrency(loan.amount)}
                </span>
                <Badge variant={statusVariant[loan.status] ?? "default"}>
                  {translateStatus(loan.status)}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      </DashboardCard>

      <div className="dda-glass flex gap-3 rounded-2xl p-5">
        <FileText className="h-5 w-5 shrink-0 text-emerald-400" />
        <p className="text-sm text-gray-400">{t("pages.loans.footnote")}</p>
      </div>
    </div>
  );
}
