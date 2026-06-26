import { Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEasternLiveTime } from "../../context/EasternTimeContext";
import { useLocale } from "../../i18n/LocaleContext";

export default function EasternLiveClock({ variant = "compact", className }) {
  const { t } = useLocale();
  const { longDate, clock, timezoneAbbr } = useEasternLiveTime();

  if (variant === "sidebar") {
    return (
      <div className={cn("space-y-0.5", className)} aria-live="polite" aria-atomic="true">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
          <Clock3 className="h-3 w-3 shrink-0" aria-hidden="true" />
          {t("common.easternTime")}
        </div>
        <p className="text-[11px] leading-snug text-gray-400">{longDate}</p>
        <p className="font-mono text-sm font-semibold tabular-nums tracking-tight text-white">{clock}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5 text-xs",
        className,
      )}
      aria-live="polite"
      aria-atomic="true"
      title={longDate}
    >
      <Clock3 className="h-3.5 w-3.5 shrink-0 text-dda-green-light" aria-hidden="true" />
      <span className="hidden font-medium text-gray-400 sm:inline">{timezoneAbbr}</span>
      <span className="font-mono font-semibold tabular-nums text-white">{clock}</span>
    </div>
  );
}
