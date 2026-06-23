import { useMemo } from "react";
import { ArrowUpRight, PiggyBank, Users } from "lucide-react";
import { formatPoolCurrency } from "../../data/mockData";
import { useLocale } from "../../i18n/LocaleContext";

function formatPoolTotal(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function PoolDigitalDisplay({ amount, memberCount, dailyInflow, ytdGrowthPct, onClick }) {
  const { t } = useLocale();
  const formatted = useMemo(() => formatPoolTotal(amount), [amount]);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("pages.dashboard.poolScreenLabel", { amount: formatted })}
      className="dda-pool-widget group w-full text-left"
    >
      <div className="dda-pool-widget__card">
        <div className="dda-accent-bar" />

        <div className="dda-pool-widget__glow" aria-hidden="true" />

        <div className="relative z-[1] space-y-4 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="dda-nav-icon">
              <PiggyBank className="h-5 w-5" strokeWidth={2.25} />
            </div>
            <span className="dda-pool-widget__live">{t("pages.dashboard.poolScreenLive")}</span>
          </div>

          <div>
            <p className="dda-text-kicker">{t("pages.dashboard.poolScreenTitle")}</p>
            <p className="dda-pool-widget__amount mt-2" aria-live="polite">
              {formatted}
            </p>
            {ytdGrowthPct != null ? (
              <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-dda-green/10 px-2.5 py-1 text-[11px] font-semibold text-dda-green-light ring-1 ring-dda-green/20">
                <ArrowUpRight className="h-3.5 w-3.5" />
                {t("pages.dashboard.poolScreenGrowth", { pct: ytdGrowthPct })}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="dda-pool-widget__stat">
              <Users className="h-3.5 w-3.5 text-dda-gold-light" strokeWidth={2.25} />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  {t("pages.dashboard.poolScreenMembers")}
                </p>
                <p className="truncate text-sm font-bold tabular-nums text-white">
                  {memberCount?.toLocaleString() ?? "—"}
                </p>
              </div>
            </div>
            <div className="dda-pool-widget__stat">
              <ArrowUpRight className="h-3.5 w-3.5 text-dda-green-light" strokeWidth={2.25} />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  {t("pages.dashboard.poolScreenToday")}
                </p>
                <p className="truncate text-sm font-bold tabular-nums text-dda-green-light">
                  +{formatPoolCurrency(dailyInflow ?? 0)}
                </p>
              </div>
            </div>
          </div>

          <div className="dda-pool-widget__footer">
            <span>{t("pages.dashboard.poolScreenHint")}</span>
            <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </div>
        </div>
      </div>
    </button>
  );
}
