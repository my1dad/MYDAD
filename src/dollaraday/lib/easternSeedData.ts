import { todaysDonations as seedDonations, poolBalanceHistory as seedBalanceHistory } from "../data/mockData";
import {
  buildEasternFirstOfMonthAudit,
  easternDateAt,
  easternMidnight,
  easternNow,
  formatContributionDueLabel,
  formatEasternLongDate,
  formatEasternMonthDay,
  formatEasternMonthShort,
  formatEasternNowLabel,
  formatEasternTimeWithZone,
  formatEasternTodayLabel,
  formatEasternWeekdayShort,
  formatRelativeTimeFromNow,
  getEasternYmd,
  subtractDays,
  type DdaLocale,
} from "./dateTime";

const DONATION_MINUTE_OFFSETS = [4, 11, 18, 26, 33, 41, 52, 63, 74, 82, 95, 108, 121, 136, 149, 164, 178, 192];

function formatEasternHourLabel(hour: number, locale: DdaLocale = "en"): string {
  const { year, month, day } = getEasternYmd(easternNow());
  return formatEasternTimeWithZone(easternDateAt(year, month, day, hour), locale);
}

export function buildEasternDonationTimes(locale: DdaLocale = "en"): string[] {
  const midnight = easternMidnight();
  return DONATION_MINUTE_OFFSETS.map((minutes) =>
    formatEasternTimeWithZone(new Date(midnight.getTime() + minutes * 60_000), locale),
  );
}

export function buildEasternTodaysDonations(locale: DdaLocale = "en") {
  const times = buildEasternDonationTimes(locale);
  return seedDonations.map((donation, index) => ({
    ...donation,
    time: times[index] ?? donation.time,
  }));
}

export function buildEasternPoolBalanceHistory(locale: DdaLocale = "en") {
  const now = easternNow();
  const { year, month } = getEasternYmd(now);

  const oneDay = seedBalanceHistory["1d"].map((point, index) => {
    const hour = index * 2;
    const label =
      index === seedBalanceHistory["1d"].length - 1
        ? formatEasternNowLabel(locale)
        : formatEasternHourLabel(hour, locale);
    return { ...point, label };
  });

  const oneWeek = seedBalanceHistory["1w"].map((point, index) => {
    const offset = 6 - index;
    const label =
      offset === 0
        ? formatEasternTodayLabel(locale)
        : formatEasternWeekdayShort(subtractDays(now, offset), locale);
    return { ...point, label };
  });

  const oneMonth = seedBalanceHistory["1m"].map((point, index) => {
    const offset = 10 - index;
    const date = subtractDays(now, offset * 3);
    const label =
      offset === 0
        ? formatEasternMonthDay(now, locale)
        : formatEasternMonthDay(date, locale);
    return { ...point, label };
  });

  const oneYear = seedBalanceHistory["1y"].map((point, index) => {
    const monthOffset = 11 - index;
    const date = new Date(year, month - 1 - monthOffset, 1);
    return {
      ...point,
      label: formatEasternMonthShort(date, locale),
    };
  });

  return {
    "1d": oneDay,
    "1w": oneWeek,
    "1m": oneMonth,
    "1y": oneYear,
  };
}

export function buildEasternDailyAllocationSummary(locale: DdaLocale = "en") {
  const now = easternNow();
  return {
    dateLabel: formatEasternLongDate(now, locale),
    lastUpdated: formatRelativeTimeFromNow(now, (key, vars) => {
      if (key === "common.minutesAgo") return locale === "es" ? `hace ${vars?.count} min` : `${vars?.count} min ago`;
      if (key === "common.justNow") return locale === "es" ? "ahora mismo" : "Just now";
      return key;
    }, locale),
  };
}

export function buildEasternPoolSeed(locale: DdaLocale = "en") {
  return {
    dateLabel: formatEasternLongDate(easternNow(), locale),
    lastUpdated: buildEasternDailyAllocationSummary(locale).lastUpdated,
    lastAudit: buildEasternFirstOfMonthAudit(locale),
    nextContributionDue: formatContributionDueLabel(locale),
    todaysDonations: buildEasternTodaysDonations(locale),
    poolBalanceHistory: buildEasternPoolBalanceHistory(locale),
  };
}

export function syncEasternPoolLabels(locale: DdaLocale = "en") {
  return buildEasternPoolSeed(locale);
}
