import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  easternNow,
  formatEasternIsoDate,
  formatEasternLiveClock,
  formatEasternLongDate,
  formatRelativeTimeFromNow,
  getEasternTimezoneAbbreviation,
} from "../lib/dateTime";
import { getAppSettings, getAppSettingsRevision, subscribeAppSettings } from "../lib/appSettings";
import { useLocale } from "../i18n/LocaleContext";

const EasternTimeContext = createContext(null);

const RELATIVE_TICK_MS = 30_000;
const DAY_CHECK_MS = 60_000;

export function EasternTimeProvider({ children }) {
  const { locale } = useLocale();
  const settingsRevision = useSyncExternalStore(
    subscribeAppSettings,
    getAppSettingsRevision,
    () => 0,
  );
  const appSettings = useMemo(() => getAppSettings(), [settingsRevision]);
  const [relativeTick, setRelativeTick] = useState(0);
  const [easternDay, setEasternDay] = useState(() => formatEasternIsoDate());

  // Relative labels refresh periodically; live clock ticks live only in EasternLiveClock.
  useEffect(() => {
    const relativeId = window.setInterval(() => setRelativeTick((tick) => tick + 1), RELATIVE_TICK_MS);
    return () => window.clearInterval(relativeId);
  }, []);

  // Day-boundary cashflow processing — check once a minute, not every second.
  useEffect(() => {
    const checkDay = () => {
      const day = formatEasternIsoDate();
      setEasternDay((prev) => {
        if (day === prev) return prev;
        void import("../lib/recurringCashflow")
          .then(({ processRecurringCashflows }) => processRecurringCashflows())
          .catch(() => {});
        return day;
      });
    };
    checkDay();
    const dayId = window.setInterval(checkDay, DAY_CHECK_MS);
    return () => window.clearInterval(dayId);
  }, []);

  const value = useMemo(
    () => ({
      relativeTick,
      easternDay,
      longDate: formatEasternLongDate(easternNow(), locale),
      timezoneAbbr: getEasternTimezoneAbbreviation(easternNow(), locale),
      formatClock: (withSeconds = true) => formatEasternLiveClock(easternNow(), locale, withSeconds),
    }),
    [relativeTick, easternDay, locale, appSettings.timezone],
  );

  return <EasternTimeContext.Provider value={value}>{children}</EasternTimeContext.Provider>;
}

export function useEasternLiveTime() {
  const ctx = useContext(EasternTimeContext);
  if (!ctx) throw new Error("useEasternLiveTime must be used within EasternTimeProvider");
  return ctx;
}

export function useLiveRelativeTime(iso, options = {}) {
  const { t, locale } = useLocale();
  const { relativeTick } = useEasternLiveTime();
  const fallback = options.fallback ?? t("common.justNow");

  return useMemo(() => {
    if (!iso) return fallback;
    const label = formatRelativeTimeFromNow(iso, t, locale);
    return label || fallback;
  }, [iso, t, locale, relativeTick, fallback]);
}
