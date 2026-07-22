import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { CircleDollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import DashboardCard from "../layout/DashboardCard";
import { formatPoolCurrency } from "../../data/mockData";
import { useDadAuth } from "../../context/DadAuthContext.jsx";
import { useLocale } from "../../i18n/LocaleContext";
import { buildAccountsOverviewStats } from "../../lib/accountsOverview";
import { resolveMemberProfileId, useMemberAccounts } from "../../lib/memberAccounts";
import { useRecurringCashflows } from "../../lib/recurringCashflow";

const MEMBER_HIDDEN_SEGMENT_IDS = new Set(["redemptionsSent", "redemptionsReceived"]);

const SEGMENT_META = {
  checking: { labelKey: "overviewChecking", color: "#10b981" },
  escrow: { labelKey: "overviewEscrow", color: "#38bdf8" },
  redemptionsSent: { labelKey: "overviewRedemptions", color: "#eab308" },
  redemptionsReceived: { labelKey: "overviewRedemptionsReceivedShort", color: "#f59e0b" },
  recurringIncome: { labelKey: "overviewRecurringIncome", color: "#34d399" },
  recurringExpense: { labelKey: "overviewRecurringExpense", color: "#f87171" },
};

function buildChartSlices(segments, t) {
  return segments.map((segment) => ({
    ...segment,
    name: t(`pages.accounts.${SEGMENT_META[segment.id]?.labelKey ?? segment.id}`),
    monthly: segment.id === "recurringIncome" || segment.id === "recurringExpense",
    pct: 0,
  }));
}

function OverviewTooltip({ active, payload, t }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  const meta = SEGMENT_META[item.id];
  const snapshotTotal = payload[0].payload.snapshotTotal;
  const pct =
    snapshotTotal > 0 ? Math.round((item.value / snapshotTotal) * 100) : 0;
  return (
    <div className="dda-chart-tooltip">
      <p className="font-semibold text-white">{t(`pages.accounts.${meta?.labelKey ?? item.id}`)}</p>
      <p className="mt-0.5 tabular-nums text-dda-green-light">{formatPoolCurrency(item.value)}</p>
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
  const { isAdmin } = useDadAuth();
  const profileId = resolveMemberProfileId();
  const ledger = useMemberAccounts(profileId);
  const schedules = useRecurringCashflows(profileId);

  const stats = useMemo(
    () => buildAccountsOverviewStats(profileId),
    [profileId, ledger, schedules],
  );

  const visibleSegments = useMemo(
    () =>
      isAdmin
        ? stats.segments
        : stats.segments.filter((segment) => !MEMBER_HIDDEN_SEGMENT_IDS.has(segment.id)),
    [isAdmin, stats.segments],
  );

  const chartData = useMemo(() => {
    const slices = buildChartSlices(visibleSegments, t);
    const snapshotTotal = visibleSegments.reduce((sum, segment) => sum + segment.value, 0);
    return slices.map((slice) => ({ ...slice, snapshotTotal }));
  }, [visibleSegments, t]);

  const onHandBalance = stats.totalBalance;

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
                      content={<OverviewTooltip t={t} />}
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
            <MetricRow
              label={
                isAdmin
                  ? t("pages.accounts.overviewChecking")
                  : t("pages.wallet.overviewLabel")
              }
              value={formatPoolCurrency(stats.checkingBalance)}
              accent={SEGMENT_META.checking.color}
              pct={segmentPct("checking", stats.checkingBalance)}
            />
            <MetricRow
              label={t("pages.accounts.overviewEscrow")}
              value={formatPoolCurrency(stats.escrowBalance)}
              accent={SEGMENT_META.escrow.color}
              pct={segmentPct("escrow", stats.escrowBalance)}
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
              label={t("pages.accounts.overviewRecurringIncome")}
              value={formatPoolCurrency(stats.recurringIncomeMonthly)}
              accent={SEGMENT_META.recurringIncome.color}
              pct={segmentPct("recurringIncome", stats.recurringIncomeMonthly)}
              hint={t("pages.accounts.overviewPerMonth")}
            />
            <MetricRow
              label={t("pages.accounts.overviewRecurringExpense")}
              value={formatPoolCurrency(stats.recurringExpenseMonthly)}
              accent={SEGMENT_META.recurringExpense.color}
              pct={segmentPct("recurringExpense", stats.recurringExpenseMonthly)}
              hint={t("pages.accounts.overviewPerMonth")}
            />
            <div
              className={cn(
                "dda-accounts-overview__net",
                stats.recurringNetMonthly >= 0
                  ? "dda-accounts-overview__net--positive"
                  : "dda-accounts-overview__net--negative",
              )}
            >
              <span>{t("pages.accounts.overviewRecurringNet")}</span>
              <span className="tabular-nums font-semibold">
                {formatPoolCurrency(stats.recurringNetMonthly)}
                <span className="font-normal opacity-75"> {t("pages.accounts.overviewPerMonth")}</span>
              </span>
            </div>
            {stats.recurringTransferCount > 0 ? (
              <p className="dda-accounts-overview__footnote">
                {t("pages.accounts.overviewTransferCount", {
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
