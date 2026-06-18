import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPoolCurrency } from "../../data/mockData";
import { useLocale } from "../../i18n/LocaleContext";

function formatHighlightValue(value, format) {
  if (format === "currency") return formatPoolCurrency(value);
  if (format === "percent") return `${value.toFixed(2)}%`;
  return value.toLocaleString();
}

function getDelta(previous, current) {
  if (previous === 0) return { pct: 0, direction: "flat" };
  const pct = ((current - previous) / previous) * 100;
  if (pct > 0) return { pct, direction: "up" };
  if (pct < 0) return { pct, direction: "down" };
  return { pct: 0, direction: "flat" };
}

function HighlightCard({ item, t }) {
  const delta = getDelta(item.previous, item.current);
  const DeltaIcon =
    delta.direction === "up" ? TrendingUp : delta.direction === "down" ? TrendingDown : Minus;

  return (
    <div className="dda-glass-btn relative flex min-w-0 flex-col p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            {item.label}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">{item.caption}</p>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
            delta.direction === "up"
              ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20"
              : delta.direction === "down"
                ? "bg-red-500/10 text-red-400 ring-red-500/20"
                : "bg-white/5 text-gray-400 ring-white/10"
          )}
        >
          <DeltaIcon className="h-3 w-3" />
          {delta.pct > 0 ? "+" : ""}
          {delta.pct.toFixed(1)}%
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="dda-panel rounded-xl p-3">
          <p className="text-[10px] uppercase tracking-wide text-gray-500">{t("common.then")}</p>
          <p className="mt-1 text-sm font-bold tabular-nums text-gray-300 sm:text-base">
            {formatHighlightValue(item.previous, item.format)}
          </p>
        </div>
        <div className="dda-panel rounded-xl p-3 ring-1 ring-emerald-500/20">
          <p className="text-[10px] uppercase tracking-wide text-emerald-400/80">{t("common.now")}</p>
          <p className="mt-1 text-sm font-bold tabular-nums text-white sm:text-base">
            {formatHighlightValue(item.current, item.format)}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function InvestmentHighlights({ highlights }) {
  const { t } = useLocale();

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {highlights.map((item) => (
        <HighlightCard key={item.id} item={item} t={t} />
      ))}
    </section>
  );
}
