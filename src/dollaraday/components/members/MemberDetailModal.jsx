import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import {
  Banknote,
  Calendar,
  CircleDollarSign,
  History,
  Settings,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { lockBodyScroll } from "@/lib/modalBodyLock";
import { cn } from "@/lib/utils";
import { Badge, ProgressBar } from "../layout/DashboardCard";
import { buildMemberDetail } from "../../lib/memberDetails";
import { useLocale } from "../../i18n/LocaleContext";
import { useLocalizedData } from "../../i18n/localizedData";

/** Settings only when needed — keeps modal open path free of heavy forms. */
const MemberSettingsCard = lazy(() => import("./MemberSettingsCard"));

const loanStatusStyles = {
  approved: "text-dda-green-light",
  in_review: "text-dda-gold-light",
  declined: "text-red-400",
};

function ContributionBars({ data }) {
  const max = Math.max(1, ...data.map((row) => Number(row.amount) || 0));
  return (
    <div className="flex h-40 items-end gap-2 px-1">
      {data.map((row) => {
        const amount = Number(row.amount) || 0;
        const height = Math.max(amount > 0 ? 12 : 4, Math.round((amount / max) * 100));
        return (
          <div key={row.label} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <div
              className="w-full max-w-[1.75rem] rounded-t-md bg-dda-green-light/85"
              style={{ height: `${height}%` }}
              title={`$${amount}`}
            />
            <span className="text-[10px] text-gray-500">{row.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function AccountBars({ accounts, total }) {
  return (
    <ul className="space-y-2">
      {accounts.map((account) => {
        const pct = total ? Math.round((account.value / total) * 100) : 0;
        return (
          <li key={account.name} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2 text-gray-300">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: account.color }}
                />
                {account.name}
              </span>
              <span className="tabular-nums text-gray-200">
                {pct}% · ${account.value.toLocaleString()}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, backgroundColor: account.color }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function MemberDetailModal({
  member,
  open,
  onClose,
  isOwnProfile = false,
}) {
  const { t } = useLocale();
  const { translateTier, translateStatus } = useLocalizedData();
  const tabs = [
    { id: "overview", label: t("memberModal.overview"), icon: TrendingUp },
    { id: "history", label: t("memberModal.history"), icon: History },
    { id: "accounts", label: t("memberModal.accounts"), icon: Wallet },
    { id: "loans", label: t("memberModal.loans"), icon: Banknote },
    ...(isOwnProfile
      ? [{ id: "settings", label: t("memberModal.settings"), icon: Settings }]
      : []),
  ];
  const [activeTab, setActiveTab] = useState("overview");
  const detail = useMemo(() => (member ? buildMemberDetail(member) : null), [member]);

  useEffect(() => {
    if (!open) return undefined;
    return lockBodyScroll();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (open) setActiveTab("overview");
  }, [open, member?.id]);

  if (!open || !detail) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label={t("memberModal.close")}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-detail-title"
        className="relative flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-dda-bg shadow-2xl sm:max-h-[88dvh] sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dda-accent-bar" />

        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-dda-green-light/15 text-sm font-bold text-dda-green-light ring-1 ring-dda-green-light/30">
              {detail.initials}
            </span>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-1.5">
                <h2 id="member-detail-title" className="truncate text-lg font-bold text-white">
                  {detail.name}
                </h2>
              </div>
              <p className="text-sm text-gray-400">
                {detail.handle} · {translateTier(detail.tier)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-2 text-gray-400 transition hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="dda-scroll overflow-y-auto px-5 py-4">
          <div className="mb-4 flex flex-wrap gap-2">
            <Badge variant={detail.status === "active" ? "success" : "warning"}>
              {translateStatus(detail.status)}
            </Badge>
            <Badge variant="info">{detail.loanStatus}</Badge>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-0.5 text-xs text-gray-400 ring-1 ring-white/10">
              <Calendar className="h-3 w-3" />
              Since {detail.memberSince}
            </span>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: t("memberModal.contributed"), value: `$${detail.contributed.toLocaleString()}` },
              { label: t("memberModal.equity"), value: `$${detail.equity.toLocaleString()}` },
              { label: t("memberModal.streak"), value: `${detail.streak} ${t("common.days").toLowerCase()}` },
              { label: t("memberModal.avgDaily"), value: `$${detail.avgDaily}` },
            ].map((stat) => (
              <div key={stat.label} className="dda-panel rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-wide text-gray-500">{stat.label}</p>
                <p className="mt-1 text-sm font-bold tabular-nums text-white">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="mb-4 flex gap-1 overflow-x-auto rounded-lg bg-black/30 p-1">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition",
                  activeTab === id
                    ? "bg-dda-green-light/15 text-dda-green-light"
                    : "text-gray-400 hover:text-white"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          {activeTab === "overview" && (
            <div className="space-y-4">
              <div className="dda-glass rounded-2xl p-4">
                <p className="text-sm font-medium text-white">{t("memberModal.communityScore")}</p>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <p className="text-3xl font-bold text-dda-green-light">{detail.score}</p>
                  <p className="text-sm text-gray-500">out of 100</p>
                </div>
                <ProgressBar value={detail.score} className="mt-3" />
              </div>

              <div className="dda-glass rounded-2xl p-4">
                <p className="mb-3 text-sm font-medium text-white">{t("memberModal.loanEligibility")}</p>
                <div className="space-y-3">
                  {detail.eligibility.map((factor) => (
                    <div key={factor.label}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="text-gray-400">
                          {factor.label} · {factor.weight}
                        </span>
                        <span className="font-semibold text-white">{factor.score}</span>
                      </div>
                      <ProgressBar value={factor.score} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "history" && (
            <div className="space-y-4">
              <div className="dda-panel rounded-xl p-4">
                <p className="mb-3 text-sm font-medium text-white">{t("memberModal.contributionTrend")}</p>
                <ContributionBars data={detail.contributionTrend} />
              </div>

              <div className="dda-glass overflow-hidden rounded-2xl">
                <p className="border-b border-white/10 px-4 py-3 text-sm font-medium text-white">
                  {t("memberModal.recentContributions")}
                </p>
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-white/10 bg-black/25 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                      <th className="px-3 py-1">{t("memberModal.date")}</th>
                      <th className="px-3 py-1">{t("memberModal.amount")}</th>
                      <th className="px-3 py-1 text-right">{t("pages.allocations.status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.recentContributions.map((row, index) => (
                      <tr
                        key={row.date}
                        className={cn(
                          "border-b border-white/[0.04] text-xs",
                          index % 2 === 0 ? "bg-white/[0.03]" : "bg-transparent"
                        )}
                      >
                        <td className="px-3 py-1 text-gray-300">{row.date}</td>
                        <td className="px-3 py-1 font-semibold tabular-nums text-dda-green-light">
                          ${row.amount.toFixed(2)}
                        </td>
                        <td
                          className={cn(
                            "px-3 py-1 text-right capitalize",
                            row.status === "completed" ? "text-dda-green-light" : "text-dda-gold-light"
                          )}
                        >
                          {translateStatus(row.status)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "accounts" && (
            <div className="space-y-4">
              <div className="dda-panel rounded-xl p-4">
                <p className="mb-3 text-sm font-medium text-white">{t("memberModal.accountBreakdown")}</p>
                <div className="mb-4 flex items-center gap-2 text-sm text-gray-400">
                  <CircleDollarSign className="h-4 w-4 text-dda-green-light" />
                  <span className="font-semibold tabular-nums text-white">
                    ${detail.accountTotal.toLocaleString()}
                  </span>
                  <span>{t("memberModal.total")}</span>
                </div>
                <AccountBars accounts={detail.accounts} total={detail.accountTotal} />
              </div>

              <div className="dda-panel rounded-xl p-4 text-sm text-gray-400">
                <p className="font-medium text-white">{t("memberModal.total")}</p>
                <p className="mt-2 leading-relaxed">
                  {t("memberModal.summary", {
                    name: detail.name,
                    contributed: detail.contributed.toLocaleString(),
                    days: detail.days,
                    equity: detail.equity.toLocaleString(),
                  })}
                </p>
              </div>
            </div>
          )}

          {activeTab === "loans" && (
            <div className="space-y-3">
              {detail.memberLoans.length ? (
                detail.memberLoans.map((loan) => (
                  <div key={loan.id} className="dda-glass rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">${loan.amount.toLocaleString()}</p>
                        <p className="mt-1 text-sm text-gray-400">{loan.purpose}</p>
                      </div>
                      <span
                        className={cn(
                          "text-xs font-semibold capitalize",
                          loanStatusStyles[loan.status] ?? "text-gray-400"
                        )}
                      >
                        {translateStatus(loan.status)}
                      </span>
                    </div>
                    <p className="mt-3 text-xs text-gray-500">
                      Eligibility score at request: {loan.score}
                    </p>
                  </div>
                ))
              ) : (
                <div className="dda-panel rounded-xl p-6 text-center">
                  <Banknote className="mx-auto h-8 w-8 text-gray-600" />
                  <p className="mt-3 font-medium text-white">{t("memberModal.noLoans")}</p>
                  <p className="mt-1 text-sm text-gray-500">
                    {detail.score >= 70
                      ? t("memberModal.eligibleApply")
                      : t("memberModal.notEligibleApply")}
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === "settings" && isOwnProfile ? (
            <Suspense fallback={<p className="py-6 text-center text-sm text-gray-500">Loading…</p>}>
              <MemberSettingsCard embedded />
            </Suspense>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}
