import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  easternNow,
  formatEasternLiveClock,
  formatEasternLongDate,
  getEasternTimezoneAbbreviation,
} from "../../lib/dateTime";
import { useLocale } from "../../i18n/LocaleContext";

/** Local 1s tick — keeps the live clock updating without re-rendering the app tree. */
export default function EasternLiveClock({ variant = "compact", className }) {
  const { t, locale } = useLocale();
  const [now, setNow] = useState(() => easternNow());

  useEffect(() => {
    setNow(easternNow());
    const id = window.setInterval(() => setNow(easternNow()), 1_000);
    return () => window.clearInterval(id);
  }, []);

  const longDate = formatEasternLongDate(now, locale);
  const clock = formatEasternLiveClock(now, locale, true);
  const timezoneAbbr = getEasternTimezoneAbbreviation(now, locale);

  if (variant === "sidebar") {
    return (
      <div className={cn("space-y-0.5 text-right", className)} aria-live="polite" aria-atomic="true">
        <div className="flex items-center justify-end gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
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
