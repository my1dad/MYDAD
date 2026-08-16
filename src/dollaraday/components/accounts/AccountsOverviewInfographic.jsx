import { useEffect, useMemo, useSyncExternalStore } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { CircleDollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import DashboardCard from "../layout/DashboardCard";
import { formatPoolCurrency } from "../../data/mockData";
import { useDadAuth } from "../../context/DadAuthContext.jsx";
import { useLocale } from "../../i18n/LocaleContext";
import { buildAccountsOverviewStats } from "../../lib/accountsOverview";
import {
  getDatabaseRevision,
  subscribeInternalDatabase,
} from "../../lib/internalDatabase";
import {
  getAdminAccountsCombinedTotal,
  resolveMemberProfileId,
  useMemberAccounts,
} from "../../lib/memberAccounts";
import {
  ensureHomeContributionSchedulesFromContributions,
  useRecurringCashflows,
} from "../../lib/recurringCashflow";

const MEMBER_HIDDEN_SEGMENT_IDS = new Set([
  "redemptionsSent",
  "redemptionsReceived",
  "escrow",
]);

const SEGMENT_META = {
  checking: { labelKey: "overviewChecking", color: "var(--color-dda-green)" },
  escrow: { labelKey: "overviewEscrow", color: "#38bdf8" },
  adminAccount: { labelKey: "overviewAdminAccount", color: "#60a5fa" },
  liquidity: { labelKey: "overviewCommunityLiquidity", color: "var(--color-dda-gold)" },
  deposits: { labelKey: "overviewDeposits", color: "var(--color-dda-gold-light)" },
  redemptionsSent: { labelKey: "overviewRedemptions", color: "var(--color-dda-gold)" },
  redemptionsReceived: { labelKey: "overviewRedemptionsReceivedShort", color: "var(--color-dda-gold-deep)" },
  recurringIncome: { labelKey: "overviewRecurringIncome", color: "#fb7185" },
  recurringExpense: { labelKey: "overviewRecurringExpense", color: "#f87171" },
  recurringTransfer: { labelKey: "overviewRecurringPayments", color: "#a78bfa" },
};

function segmentLabelKey(segmentId, isAdmin = true) {
  if (isAdmin && segmentId === "adminAccount") return "overviewAdminAccount";
  if (isAdmin && segmentId === "liquidity") return "overviewCommunityLiquidity";
  if (segmentId === "recurringIncome" && !isAdmin) return "overviewRecurringDonations";
  return SEGMENT_META[segmentId]?.labelKey ?? segmentId;
}

function buildChartSlices(segments, t, isAdmin = true) {
  return segments.map((segment) => {
    const labelKey = segmentLabelKey(segment.id, isAdmin);
    return {
      ...segment,
      color: SEGMENT_META[segment.id]?.color ?? segment.color,
      name: t(`pages.accounts.${labelKey}`),
      monthly: segment.id === "recurringIncome" || segment.id === "recurringExpense",
      pct: 0,
    };
  });
}

function OverviewTooltip({ active, payload, t, isAdmin = true }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  const meta = SEGMENT_META[item.id];
  const snapshotTotal = payload[0].payload.snapshotTotal;
  const pct =
    snapshotTotal > 0 ? Math.round((item.value / snapshotTotal) * 100) : 0;
  const labelKey = segmentLabelKey(item.id, isAdmin);
  return (
    <div className="dda-chart-tooltip">
      <p className="font-semibold text-white">{t(`pages.accounts.${labelKey}`)}</p>
      <p
        className="mt-0.5 tabular-nums"
        style={{ color: meta?.color ?? "var(--color-dda-green-light)" }}
      >
        {formatPoolCurrency(item.value)}
      </p>
      {item.monthly ? (
        <p className="mt-0.5 text-gray-400">{t("pages.accounts.overviewPerMonth")}</p>
      ) : null}
      {pct > 0 ? <p className="mt-0.5 text-gray-400">{pct}%</p> : null}
    </div>
  );
}

function MetricRow({ label, value, hint, accent, pct }) {
  return (
    <div className="dda-accounts-overview__row">
      <span className="dda-accounts-overview__row-label">
        {accent ? (
          <span className="dda-accounts-overview__dot" style={{ backgroundColor: accent }} />
        ) : null}
        <span className="min-w-0 truncate">{label}</span>
      </span>
      <span className="dda-accounts-overview__row-value">
        <span className="tabular-nums text-white">{value}</span>
        {hint ? <span className="dda-accounts-overview__row-hint">{hint}</span> : null}
        {pct !== undefined ? (
          <span className="dda-accounts-overview__row-pct">{pct}%</span>
        ) : null}
      </span>
    </div>
  );
}

function MetricGroup({ title, children }) {
  return (
    <section className="dda-accounts-overview__group">
      <h3 className="dda-accounts-overview__group-title">{title}</h3>
      <div className="dda-accounts-overview__group-body">{children}</div>
    </section>
  );
}

export default function AccountsOverviewInfographic() {
  const { t } = useLocale();
  const { isAdmin, profile } = useDadAuth();
  const profileId = profile?.id || resolveMemberProfileId();
  const ledger = useMemberAccounts(profileId);
  const schedules = useRecurringCashflows(profileId);
  const dbRevision = useSyncExternalStore(
    subscribeInternalDatabase,
    getDatabaseRevision,
    () => 0,
  );

  useEffect(() => {
    ensureHomeContributionSchedulesFromContributions(profileId);
  }, [profileId, dbRevision]);

  const stats = useMemo(
    () => buildAccountsOverviewStats(profileId, { platformScope: isAdmin }),
    // dbRevision covers contribution deposits that update the overview totals.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ledger/schedules also invalidate
    [profileId, ledger, schedules, dbRevision, isAdmin],
  );

  const adminCombined = useMemo(
    () => (isAdmin ? getAdminAccountsCombinedTotal(profileId) : null),
    [isAdmin, profileId, dbRevision, ledger, stats.checkingBalance],
  );

  const adminAccountBalance = adminCombined?.adminAccount ?? 0;
  const communityLiquidity = adminCombined?.communityLiquidity ?? 0;
  const accountsHeadlineTotal = adminCombined?.total ?? 0;

  const visibleSegments = useMemo(() => {
    if (isAdmin) {
      const others = stats.segments.filter(
        (segment) => segment.id !== "checking" && segment.id !== "escrow",
      );
      const balanceSlices = [];
      if (adminAccountBalance > 0) {
        balanceSlices.push({
          id: "adminAccount",
          value: adminAccountBalance,
          color: SEGMENT_META.adminAccount.color,
        });
      }
      if (communityLiquidity > 0) {
        balanceSlices.push({
          id: "liquidity",
          value: communityLiquidity,
          color: SEGMENT_META.liquidity.color,
        });
      }
      return [...balanceSlices, ...others];
    }

    const withoutHidden = stats.segments.filter(
      (segment) => !MEMBER_HIDDEN_SEGMENT_IDS.has(segment.id),
    );
    const others = withoutHidden.filter((segment) => segment.id !== "checking");
    if (stats.totalBalance <= 0) return others;

    return [
      {
        id: "checking",
        value: stats.totalBalance,
        color: SEGMENT_META.checking.color,
      },
      ...others,
    ];
  }, [
    isAdmin,
    stats.segments,
    stats.totalBalance,
    adminAccountBalance,
    communityLiquidity,
  ]);

  const chartData = useMemo(() => {
    const slices = buildChartSlices(visibleSegments, t, isAdmin);
    const snapshotTotal = visibleSegments.reduce((sum, segment) => sum + segment.value, 0);
    return slices.map((slice) => ({ ...slice, snapshotTotal }));
  }, [visibleSegments, t, isAdmin]);

  const onHandBalance = isAdmin ? accountsHeadlineTotal : stats.totalBalance;

  const chartSnapshotTotal = visibleSegments.reduce((sum, segment) => sum + segment.value, 0);

  const segmentPct = (_id, value) =>
    value > 0 && chartSnapshotTotal
      ? Math.round((value / chartSnapshotTotal) * 100)
      : undefined;

  return (
    <DashboardCard
      title={t("pages.accounts.overviewTitle")}
      subtitle={t(isAdmin ? "pages.accounts.overviewSub" : "pages.wallet.overviewSub")}
      compact
      noPadding
      collapsible
      defaultCollapsed={false}
      collapseAriaLabel={t("pages.accounts.collapseOverview")}
      expandAriaLabel={t("pages.accounts.expandOverview")}
      className="dda-accounts-overview-card"
    >
      <div className="dda-accounts-overview">
        <div className="dda-accounts-overview__donut-col">
          <div
            className={cn(
              "dda-accounts-overview-donut dda-donut-chart",
              !chartData.length && "dda-accounts-overview-donut--empty",
            )}
          >
            <div className="dda-accounts-overview-donut__chart dda-donut-chart__plot">
              {chartData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={34}
                      outerRadius={50}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="#071013"
                      strokeWidth={2}
                    >
                      {chartData.map((entry) => (
                        <Cell key={entry.id} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={<OverviewTooltip t={t} isAdmin={isAdmin} />}
                      wrapperStyle={{ zIndex: 50, outline: "none" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : null}
            </div>
            <div className="dda-accounts-overview-donut__center dda-donut-chart__center">
              {!chartData.length ? (
                <CircleDollarSign
                  className="dda-accounts-overview-donut__empty-icon h-4 w-4 shrink-0 text-gray-600"
                  aria-hidden="true"
                />
              ) : null}
              <span className="dda-accounts-overview-donut__label">
                {t("pages.accounts.overviewOnHand")}
              </span>
              <span className="dda-accounts-overview-donut__total">
                {formatPoolCurrency(onHandBalance)}
              </span>
            </div>
          </div>
        </div>

        <div className="dda-accounts-overview__sections">
          <MetricGroup title={t("pages.accounts.overviewGroupBalances")}>
            {isAdmin ? (
              <>
                <MetricRow
                  label={t("pages.accounts.overviewAdminAccount")}
                  value={formatPoolCurrency(adminAccountBalance)}
                  accent={SEGMENT_META.adminAccount.color}
                  pct={segmentPct("adminAccount", adminAccountBalance)}
                />
                <MetricRow
                  label={t("pages.accounts.overviewCommunityLiquidity")}
                  value={formatPoolCurrency(communityLiquidity)}
                  accent={SEGMENT_META.liquidity.color}
                  pct={segmentPct("liquidity", communityLiquidity)}
                />
                <MetricRow
                  label={t("pages.accounts.overviewBalancesTotal")}
                  value={formatPoolCurrency(onHandBalance)}
                  hint={t("pages.accounts.overviewBalancesTotalHint")}
                />
              </>
            ) : (
              <MetricRow
                label={t("pages.wallet.overviewLabel")}
                value={formatPoolCurrency(stats.totalBalance)}
                accent={SEGMENT_META.checking.color}
                pct={segmentPct("checking", stats.totalBalance)}
              />
            )}
          </MetricGroup>

          <MetricGroup title={t("pages.accounts.overviewGroupDeposits")}>
            <MetricRow
              label={t("pages.accounts.overviewDeposits")}
              value={formatPoolCurrency(stats.depositsTotal)}
              accent={SEGMENT_META.deposits.color}
              pct={segmentPct("deposits", stats.depositsTotal)}
              hint={
                stats.depositsCount > 0
                  ? t("pages.accounts.overviewDepositCount", {
                      count: stats.depositsCount,
                    })
                  : t("pages.accounts.overviewNoDeposits")
              }
            />
          </MetricGroup>

          {isAdmin ? (
            <MetricGroup title={t("pages.accounts.overviewGroupRedemptions")}>
              <MetricRow
                label={t("pages.accounts.overviewRedemptionsSent")}
                value={formatPoolCurrency(stats.redemptionsSent)}
                accent={SEGMENT_META.redemptionsSent.color}
                pct={segmentPct("redemptionsSent", stats.redemptionsSent)}
                hint={
                  stats.redemptionCount > 0
                    ? t("pages.accounts.overviewRedemptionCount", { count: stats.redemptionCount })
                    : t("pages.accounts.overviewNoRedemptions")
                }
              />
              <MetricRow
                label={t("pages.accounts.overviewRedemptionsReceivedShort")}
                value={formatPoolCurrency(stats.redemptionsReceived)}
                accent={SEGMENT_META.redemptionsReceived.color}
                pct={segmentPct("redemptionsReceived", stats.redemptionsReceived)}
              />
            </MetricGroup>
          ) : null}

          <MetricGroup title={t("pages.accounts.overviewGroupRecurring")}>
            <MetricRow
              label={t(
                isAdmin
                  ? "pages.accounts.overviewRecurringIncome"
                  : "pages.accounts.overviewRecurringDonations",
              )}
              value={formatPoolCurrency(stats.recurringIncomeMonthly)}
              accent={SEGMENT_META.recurringIncome.color}
              pct={segmentPct("recurringIncome", stats.recurringIncomeMonthly)}
              hint={
                stats.recurringIncomeCount > 0
                  ? `${t("pages.accounts.overviewPerMonth")} · ${t(
                      isAdmin
                        ? "pages.accounts.overviewRecurringIncomeCount"
                        : "pages.accounts.overviewRecurringDonationCount",
                      { count: stats.recurringIncomeCount },
                    )}`
                  : t("pages.accounts.overviewPerMonth")
              }
            />
            {isAdmin ? (
              <>
                <MetricRow
                  label={t("pages.accounts.overviewRecurringExpense")}
                  value={formatPoolCurrency(stats.recurringExpenseMonthly)}
                  accent={SEGMENT_META.recurringExpense.color}
                  pct={segmentPct("recurringExpense", stats.recurringExpenseMonthly)}
                  hint={t("pages.accounts.overviewPerMonth")}
                />
                <MetricRow
                  label={t("pages.accounts.overviewRecurringPayments")}
                  value={formatPoolCurrency(stats.recurringTransferMonthly)}
                  accent={SEGMENT_META.recurringTransfer.color}
                  pct={segmentPct("recurringTransfer", stats.recurringTransferMonthly)}
                  hint={t("pages.accounts.overviewPerMonth")}
                />
              </>
            ) : null}
            <div
              className={cn(
                "dda-accounts-overview__net",
                isAdmin
                  ? stats.recurringNetMonthly >= 0
                    ? "dda-accounts-overview__net--positive"
                    : "dda-accounts-overview__net--negative"
                  : "dda-accounts-overview__net--outcome",
              )}
            >
              <span>
                {t(
                  isAdmin
                    ? "pages.accounts.overviewRecurringNet"
                    : "pages.accounts.overviewRecurringOutcome",
                )}
              </span>
              <span className="tabular-nums font-semibold">
                {isAdmin
                  ? formatPoolCurrency(stats.recurringNetMonthly)
                  : `−${formatPoolCurrency(stats.recurringIncomeMonthly)}`}
                <span className="font-normal opacity-75"> {t("pages.accounts.overviewPerMonth")}</span>
              </span>
            </div>
            {isAdmin && stats.recurringTransferCount > 0 ? (
              <p className="dda-accounts-overview__footnote">
                {stats.recurringPaymentLabels.length
                  ? t("pages.accounts.overviewTransferSummary", {
                      count: stats.recurringTransferCount,
                      labels: stats.recurringPaymentLabels.join(", "),
                      amount: formatPoolCurrency(stats.recurringTransferMonthly),
                    })
                  : t("pages.accounts.overviewTransferCount", {
                      count: stats.recurringTransferCount,
                    })}
              </p>
            ) : null}
          </MetricGroup>
        </div>
      </div>
    </DashboardCard>
  );
}
