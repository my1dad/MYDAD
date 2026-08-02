import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  easternNow,
  formatEasternIsoDate,
  formatEasternLongDate,
  formatRelativeTimeFromNow,
} from "../lib/dateTime";
import { getAppSettings, getAppSettingsRevision, subscribeAppSettings } from "../lib/appSettings";
import { useLocale } from "../i18n/LocaleContext";

const EasternTimeContext = createContext(null);

const RELATIVE_TICK_MS = 30_000;
const DAY_CHECK_MS = 60_000;

/**
 * Shell-wide provider — NO relativeTick here.
 * A 30s tick in this value was re-rendering AppShell + active page + nav.
 */
export function EasternTimeProvider({ children }) {
  const { locale } = useLocale();
  const settingsRevision = useSyncExternalStore(
    subscribeAppSettings,
    getAppSettingsRevision,
    () => 0,
  );
  const appSettings = useMemo(() => getAppSettings(), [settingsRevision]);
  const [easternDay, setEasternDay] = useState(() => formatEasternIsoDate());

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
      easternDay,
      longDate: formatEasternLongDate(easternNow(), locale),
    }),
    [easternDay, locale, appSettings.timezone],
  );

  return <EasternTimeContext.Provider value={value}>{children}</EasternTimeContext.Provider>;
}

export function useEasternLiveTime() {
  const ctx = useContext(EasternTimeContext);
  if (!ctx) throw new Error("useEasternLiveTime must be used within EasternTimeProvider");
  return ctx;
}

/** Local tick — only remounts the leaf that shows a relative timestamp. */
export function useLiveRelativeTime(iso, options = {}) {
  const { t, locale } = useLocale();
  const [relativeTick, setRelativeTick] = useState(0);
  const fallback = options.fallback ?? t("common.justNow");

  useEffect(() => {
    const id = window.setInterval(() => setRelativeTick((tick) => tick + 1), RELATIVE_TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  return useMemo(() => {
    void relativeTick;
    if (!iso) return fallback;
    const label = formatRelativeTimeFromNow(iso, t, locale);
    return label || fallback;
  }, [iso, t, locale, relativeTick, fallback]);
}
