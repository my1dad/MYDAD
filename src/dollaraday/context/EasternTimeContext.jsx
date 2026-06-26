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
import { processRecurringCashflows } from "../lib/recurringCashflow";
import { useLocale } from "../i18n/LocaleContext";

const EasternTimeContext = createContext(null);

const RELATIVE_TICK_MS = 30_000;

export function EasternTimeProvider({ children }) {
  const { locale } = useLocale();
  const settingsRevision = useSyncExternalStore(
    subscribeAppSettings,
    getAppSettingsRevision,
    () => 0,
  );
  const appSettings = useMemo(() => getAppSettings(), [settingsRevision]);
  const [now, setNow] = useState(() => easternNow());
  const [relativeTick, setRelativeTick] = useState(0);
  const [easternDay, setEasternDay] = useState(() => formatEasternIsoDate());

  useEffect(() => {
    setNow(easternNow());
    const clockId = window.setInterval(() => setNow(easternNow()), 1_000);
    const relativeId = window.setInterval(() => setRelativeTick((tick) => tick + 1), RELATIVE_TICK_MS);
    return () => {
      window.clearInterval(clockId);
      window.clearInterval(relativeId);
    };
  }, []);

  useEffect(() => {
    const day = formatEasternIsoDate(now);
    if (day === easternDay) return;
    setEasternDay(day);
    processRecurringCashflows();
  }, [now, easternDay]);

  const value = useMemo(
    () => ({
      now,
      relativeTick,
      longDate: formatEasternLongDate(now, locale),
      clock: formatEasternLiveClock(now, locale, true),
      clockShort: formatEasternLiveClock(now, locale, false),
      timezoneAbbr: getEasternTimezoneAbbreviation(now, locale),
    }),
    [now, relativeTick, locale, appSettings.timezone],
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
