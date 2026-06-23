import { Minus, Target, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPoolCurrency } from "../../data/mockData";
import { useLocale } from "../../i18n/LocaleContext";

function formatComparisonValue(value, format) {
  if (format === "currency") return formatPoolCurrency(value);
  if (format === "milestone") return value.toLocaleString();
  return value.toLocaleString();
}

function getDelta(previous, current) {
  if (previous === 0) return { pct: 0, direction: "flat" };
  const pct = ((current - previous) / previous) * 100;
  if (pct > 0) return { pct, direction: "up" };
  if (pct < 0) return { pct, direction: "down" };
  return { pct: 0, direction: "flat" };
}

function ComparisonCard({ item, t }) {
  const { previous, current, target, format } = item;
  const delta = getDelta(previous, current);
  const isMilestone = format === "milestone" && target;
  const milestonePct = isMilestone ? Math.round((current / target) * 1000) / 10 : null;

  const DeltaIcon =
    delta.direction === "up" ? TrendingUp : delta.direction === "down" ? TrendingDown : Minus;

  const deltaColor =
    delta.direction === "up"
      ? "text-dda-green-light"
      : delta.direction === "down"
        ? "text-red-400"
        : "text-gray-400";

  return (
    <div className="dda-glass-btn relative flex min-w-0 flex-col p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            {item.label}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">{item.caption}</p>
        </div>
        {isMilestone ? (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-dda-gold/15 text-dda-gold-light ring-1 ring-dda-gold/25">
            <Target className="h-4 w-4" strokeWidth={2.25} />
          </span>
        ) : (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
              delta.direction === "up"
                ? "bg-dda-green/10 text-dda-green-light ring-dda-green/20"
                : delta.direction === "down"
                  ? "bg-red-500/10 text-red-400 ring-red-500/20"
                  : "bg-white/5 text-gray-400 ring-white/10"
            )}
          >
            <DeltaIcon className="h-3 w-3" />
            {delta.pct > 0 ? "+" : ""}
            {delta.pct.toFixed(1)}%
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="dda-panel rounded-xl p-3">
          <p className="text-[10px] uppercase tracking-wide text-gray-500">{t("common.then")}</p>
          <p className="mt-1 text-sm font-bold tabular-nums text-gray-300 sm:text-base">
            {formatComparisonValue(previous, format)}
          </p>
        </div>
        <div className="dda-panel rounded-xl p-3 ring-1 ring-dda-green/20">
          <p className="text-[10px] uppercase tracking-wide text-dda-green-light/80">{t("common.now")}</p>
          <p className="mt-1 text-sm font-bold tabular-nums text-white sm:text-base">
            {formatComparisonValue(current, format)}
          </p>
        </div>
      </div>

      {isMilestone ? (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[11px] text-gray-500">
            <span>{t("common.progressTo", { target: target.toLocaleString() })}</span>
            <span className="font-semibold text-dda-gold-light">{milestonePct}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-dda-gold to-dda-green-light"
              style={{ width: `${Math.min(100, milestonePct)}%` }}
            />
          </div>
        </div>
      ) : (
        <p className="mt-3 text-[11px] text-gray-500">
          <span className={deltaColor}>
            {delta.direction === "up" ? "+" : ""}
            {(current - previous).toLocaleString()}
          </span>{" "}
          {t("common.vsPrior")}
        </p>
      )}
    </div>
  );
}

export default function AllocationAnalyticsGrid({ comparisons }) {
  const { t } = useLocale();

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {comparisons.map((item) => (
        <ComparisonCard key={item.id} item={item} t={t} />
      ))}
    </section>
  );
}
