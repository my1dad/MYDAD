import { useMemo, useSyncExternalStore } from "react";
import { ArrowLeftRight, ArrowUpRight, Droplets, PiggyBank, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPoolCurrency } from "../../data/mockData";
import { useLocale } from "../../i18n/LocaleContext";
import {
  getDatabaseRevision,
  subscribeInternalDatabase,
} from "../../lib/internalDatabase";
import { getAdminLiquidityAvailable } from "../../lib/memberAccounts";
import { getCompletedRedemptionOutflow } from "../../lib/memberEscrowTotals";
import { useMembers } from "../../lib/memberRegistry";
import { usePoolState } from "../../lib/poolState";

export default function AccountsLiquidityWidget({ onNavigate, onTransferClick, className }) {
  const { t } = useLocale();
  const { poolSummary } = usePoolState();
  const members = useMembers();
  const dbRevision = useSyncExternalStore(
    subscribeInternalDatabase,
    getDatabaseRevision,
    () => 0,
  );

  const metrics = useMemo(() => {
    void dbRevision;
    const available = getAdminLiquidityAvailable();
    const deployed = Math.max(0, Number(poolSummary?.deployedCapital) || 0);
    const total = Math.max(
      0,
      Number(poolSummary?.totalBalance) || available + deployed,
    );
    const dailyInflow = Math.max(0, Number(poolSummary?.dailyInflow) || 0);
    const memberCount = members.length;
    const redemptions = getCompletedRedemptionOutflow();
    const ytd = Number(poolSummary?.ytdGrowthPct) || 0;
    return { available, deployed, total, dailyInflow, memberCount, redemptions, ytd };
  }, [dbRevision, poolSummary, members.length]);

  const interactive = typeof onNavigate === "function";
  const canTransfer = typeof onTransferClick === "function";

  const openPool = () => {
    if (interactive) onNavigate("pool");
  };

  const onKeyDown = (event) => {
    if (!interactive) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPool();
    }
  };

  return (
    <section
      className={cn("dda-liquidity-widget", className)}
      aria-label={t("pages.accounts.liquidityWidgetAria", {
        amount: formatPoolCurrency(metrics.available),
      })}
    >
      <div className="dda-accent-bar" />
      <div
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        className={cn(
          "dda-liquidity-widget__body",
          interactive && "dda-liquidity-widget__body--interactive",
        )}
        onClick={interactive ? openPool : undefined}
        onKeyDown={interactive ? onKeyDown : undefined}
      >
        <div className="dda-liquidity-widget__head">
          <div className="min-w-0">
            <p className="dda-liquidity-widget__kicker">
              <Droplets className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
              {t("pages.accounts.liquidityWidgetKicker")}
            </p>
            <h2 className="dda-liquidity-widget__title">
              {t("pages.accounts.liquidityWidgetTitle")}
            </h2>
          </div>
          <span className="dda-liquidity-widget__live">
            {t("pages.dashboard.poolScreenLive")}
          </span>
        </div>

        <div className="dda-liquidity-widget__balance-row">
          <div className="min-w-0">
            <p className="dda-liquidity-widget__balance-label">
              {t("pages.accounts.liquidityAvailable")}
            </p>
            <p className="dda-liquidity-widget__balance" aria-live="polite">
              {formatPoolCurrency(metrics.available)}
            </p>
          </div>
          {metrics.ytd ? (
            <span className="dda-liquidity-widget__growth">
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.5} />
              {t("pages.dashboard.poolScreenGrowth", { pct: metrics.ytd })}
            </span>
          ) : null}
        </div>

        <div className="dda-liquidity-widget__chips" aria-label={t("pages.accounts.liquidityWidgetChipsAria")}>
          <div className="dda-liquidity-widget__chip">
            <p className="dda-liquidity-widget__chip-label">{t("pages.accounts.liquidityTotal")}</p>
            <p className="dda-liquidity-widget__chip-value">{formatPoolCurrency(metrics.total)}</p>
          </div>
          <div className="dda-liquidity-widget__chip">
            <p className="dda-liquidity-widget__chip-label">{t("pages.accounts.liquidityDeployed")}</p>
            <p className="dda-liquidity-widget__chip-value">{formatPoolCurrency(metrics.deployed)}</p>
          </div>
          <div className="dda-liquidity-widget__chip dda-liquidity-widget__chip--in">
            <p className="dda-liquidity-widget__chip-label">{t("pages.accounts.liquidityInflow")}</p>
            <p className="dda-liquidity-widget__chip-value dda-liquidity-widget__chip-value--inflow">
              +{formatPoolCurrency(metrics.dailyInflow)}
            </p>
          </div>
          <div className="dda-liquidity-widget__chip dda-liquidity-widget__chip--out">
            <p className="dda-liquidity-widget__chip-label">{t("pages.accounts.liquidityRedemptions")}</p>
            <p className="dda-liquidity-widget__chip-value">
              {formatPoolCurrency(metrics.redemptions)}
            </p>
          </div>
        </div>

        <div className="dda-liquidity-widget__foot">
          <span className="dda-liquidity-widget__meta">
            <Users className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
            {t("pages.accounts.liquidityMembers", {
              count: metrics.memberCount.toLocaleString(),
            })}
          </span>
          {interactive ? (
            <span className="dda-liquidity-widget__cta">
              <PiggyBank className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
              {t("pages.accounts.liquidityOpenPool")}
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
            </span>
          ) : null}
        </div>

        {canTransfer ? (
          <button
            type="button"
            className="dda-liquidity-widget__transfer-btn"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onTransferClick();
            }}
          >
            <ArrowLeftRight className="h-3.5 w-3.5" strokeWidth={2.25} />
            {t("pages.accounts.adminLiquidityTransferButton")}
          </button>
        ) : null}
      </div>
    </section>
  );
}
