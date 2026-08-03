import { useMemo, useState } from "react";
import { ArrowUpRight, Percent, PiggyBank, Sparkles, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPoolCurrency } from "../../data/mockData";
import { useLocale } from "../../i18n/LocaleContext";
import { usePoolState } from "../../lib/poolState";

function formatPoolTotal(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

const TABS = [
  { id: "overview", labelKey: "poolTabOverview" },
  { id: "interest", labelKey: "poolTabInterest" },
  { id: "compound", labelKey: "poolTabCompound" },
];

export default function PoolDigitalDisplay({ amount, memberCount, dailyInflow, ytdGrowthPct, onClick }) {
  const { t } = useLocale();
  const { poolSummary } = usePoolState();
  const [activeTab, setActiveTab] = useState("overview");
  const formatted = useMemo(() => formatPoolTotal(amount), [amount]);

  const poolApy = Number(poolSummary?.poolApy) || 0;
  const ytd = ytdGrowthPct ?? poolSummary?.ytdGrowthPct ?? 0;
  const balance = Number(amount) || 0;

  const interest = useMemo(() => {
    const annual = balance * (poolApy / 100);
    return {
      annual,
      monthly: annual / 12,
      daily: annual / 365,
    };
  }, [balance, poolApy]);

  const compound = useMemo(() => {
    const growthPct = Math.max(0, Number(ytd) || 0);
    const gain = balance * (growthPct / (100 + growthPct));
    const principal = Math.max(0, balance - gain);
    const principalPct = balance > 0 ? Math.round((principal / balance) * 100) : 100;
    return {
      growthPct,
      gain: Math.max(0, gain),
      principal,
      principalPct,
      interestPct: Math.max(0, 100 - principalPct),
    };
  }, [balance, ytd]);

  return (
    <section
      className="dda-pool-widget group w-full text-left"
      aria-label={t("pages.dashboard.poolScreenLabel", { amount: formatted })}
    >
      <div className="dda-pool-widget__card">
        <div className="dda-accent-bar" />
        <div className="dda-pool-widget__glow" aria-hidden="true" />

        <div className="dda-pool-widget__body">
          <div className="dda-pool-widget__head">
            <div className="dda-nav-icon dda-nav-icon--sm">
              <PiggyBank className="h-4 w-4" strokeWidth={2.25} />
            </div>
            <p className="dda-text-kicker dda-pool-widget__title">
              {t("pages.dashboard.poolScreenTitle")}
            </p>
            <span className="dda-pool-widget__live">{t("pages.dashboard.poolScreenLive")}</span>
          </div>

          <button
            type="button"
            onClick={onClick}
            className="dda-pool-widget__balance"
          >
            <p className="dda-pool-widget__amount" aria-live="polite">
              {formatted}
            </p>
            {ytd != null ? (
              <p className="dda-pool-widget__growth">
                <ArrowUpRight className="h-3 w-3" />
                {t("pages.dashboard.poolScreenGrowth", { pct: ytd })}
              </p>
            ) : null}
          </button>

          <div className="dda-pool-widget__tabs" role="tablist" aria-label={t("pages.dashboard.poolTabsLabel")}>
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "dda-pool-widget__tab",
                    active && "dda-pool-widget__tab--active",
                  )}
                >
                  {t(`pages.dashboard.${tab.labelKey}`)}
                </button>
              );
            })}
          </div>

          <div className="dda-pool-widget__panel" role="tabpanel">
            {activeTab === "overview" ? (
              <div className="dda-pool-widget__stats">
                <div className="dda-pool-widget__stat">
                  <Users className="h-3.5 w-3.5 shrink-0 text-dda-gold-light" strokeWidth={2.25} />
                  <div className="min-w-0">
                    <p className="dda-pool-widget__stat-label">{t("pages.dashboard.poolScreenMembers")}</p>
                    <p className="dda-pool-widget__stat-value">
                      {(memberCount ?? poolSummary?.memberCount ?? 0).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="dda-pool-widget__stat">
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-dda-green-light" strokeWidth={2.25} />
                  <div className="min-w-0">
                    <p className="dda-pool-widget__stat-label">{t("pages.dashboard.poolScreenToday")}</p>
                    <p className="dda-pool-widget__stat-value dda-pool-widget__stat-value--inflow">
                      +{formatPoolCurrency(dailyInflow ?? 0)}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab === "interest" ? (
              <div className="dda-pool-widget__interest">
                <div className="dda-pool-widget__interest-hero">
                  <Percent className="h-3.5 w-3.5 text-dda-green-light" strokeWidth={2.25} />
                  <div className="min-w-0">
                    <p className="dda-pool-widget__stat-label">{t("pages.dashboard.poolInterestApy")}</p>
                    <p className="dda-pool-widget__interest-apy">{poolApy.toFixed(2)}%</p>
                  </div>
                </div>
                <div className="dda-pool-widget__stats">
                  <div className="dda-pool-widget__stat">
                    <div className="min-w-0">
                      <p className="dda-pool-widget__stat-label">{t("pages.dashboard.poolInterestDaily")}</p>
                      <p className="dda-pool-widget__stat-value dda-pool-widget__stat-value--inflow">
                        +{formatPoolCurrency(interest.daily)}
                      </p>
                    </div>
                  </div>
                  <div className="dda-pool-widget__stat">
                    <div className="min-w-0">
                      <p className="dda-pool-widget__stat-label">{t("pages.dashboard.poolInterestMonthly")}</p>
                      <p className="dda-pool-widget__stat-value dda-pool-widget__stat-value--inflow">
                        +{formatPoolCurrency(interest.monthly)}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="dda-pool-widget__meter" aria-hidden="true">
                  <span
                    className="dda-pool-widget__meter-fill dda-pool-widget__meter-fill--interest"
                    style={{ width: `${Math.min(100, Math.max(8, poolApy * 8))}%` }}
                  />
                </div>
              </div>
            ) : null}

            {activeTab === "compound" ? (
              <div className="dda-pool-widget__compound">
                <div className="dda-pool-widget__compound-head">
                  <Sparkles className="h-3.5 w-3.5 text-dda-gold-light" strokeWidth={2.25} />
                  <p className="dda-pool-widget__compound-copy">
                    {t("pages.dashboard.poolCompoundHint")}
                  </p>
                </div>
                <div className="dda-pool-widget__stack" aria-hidden="true">
                  <span
                    className="dda-pool-widget__stack-principal"
                    style={{ width: `${compound.principalPct}%` }}
                  />
                  <span
                    className="dda-pool-widget__stack-gain"
                    style={{ width: `${compound.interestPct}%` }}
                  />
                </div>
                <div className="dda-pool-widget__stats">
                  <div className="dda-pool-widget__stat">
                    <div className="min-w-0">
                      <p className="dda-pool-widget__stat-label">{t("pages.dashboard.poolCompoundBase")}</p>
                      <p className="dda-pool-widget__stat-value">
                        {formatPoolCurrency(compound.principal)}
                      </p>
                    </div>
                  </div>
                  <div className="dda-pool-widget__stat">
                    <div className="min-w-0">
                      <p className="dda-pool-widget__stat-label">{t("pages.dashboard.poolCompoundGain")}</p>
                      <p className="dda-pool-widget__stat-value dda-pool-widget__stat-value--inflow">
                        +{formatPoolCurrency(compound.gain)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <button type="button" onClick={onClick} className="dda-pool-widget__footer">
            <span>{t("pages.dashboard.poolScreenHint")}</span>
            <ArrowUpRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>
        </div>
      </div>
    </section>
  );
}
