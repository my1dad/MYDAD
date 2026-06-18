export const DDA_TIMEZONE = "America/New_York";

export type DdaLocale = "en" | "es";

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

function resolveLocale(locale: DdaLocale): string {
  return locale === "es" ? "es-US" : "en-US";
}

export function easternNow(): Date {
  return new Date();
}

export function formatInEastern(
  date: Date | string | number = easternNow(),
  options: Intl.DateTimeFormatOptions,
  locale: DdaLocale = "en",
): string {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return "";
  return new Intl.DateTimeFormat(resolveLocale(locale), {
    timeZone: DDA_TIMEZONE,
    ...options,
  }).format(value);
}

export function formatEasternLongDate(date: Date | string | number = easternNow(), locale: DdaLocale = "en") {
  return formatInEastern(
    date,
    { weekday: "long", month: "long", day: "numeric", year: "numeric" },
    locale,
  );
}

export function formatEasternShortDate(date: Date | string | number = easternNow(), locale: DdaLocale = "en") {
  return formatInEastern(date, { month: "short", day: "numeric", year: "numeric" }, locale);
}

export function formatEasternMonthDay(date: Date | string | number = easternNow(), locale: DdaLocale = "en") {
  return formatInEastern(date, { month: "short", day: "numeric" }, locale);
}

export function formatEasternTime(date: Date | string | number = easternNow(), locale: DdaLocale = "en") {
  return formatInEastern(date, { hour: "numeric", minute: "2-digit", hour12: true }, locale);
}

export function formatEasternDateTime(date: Date | string | number = easternNow(), locale: DdaLocale = "en") {
  return formatInEastern(
    date,
    {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZoneName: "short",
    },
    locale,
  );
}

export function formatEasternIsoDate(date: Date | string | number = easternNow()): string {
  const formatted = formatInEastern(date, { year: "numeric", month: "2-digit", day: "2-digit" });
  const [month, day, year] = formatted.split("/");
  if (!month || !day || !year) return "";
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function formatEasternWeekdayShort(date: Date | string | number = easternNow(), locale: DdaLocale = "en") {
  return formatInEastern(date, { weekday: "short" }, locale);
}

export function formatEasternMonthShort(date: Date | string | number = easternNow(), locale: DdaLocale = "en") {
  return formatInEastern(date, { month: "short" }, locale);
}

export function formatContributionDueLabel(locale: DdaLocale = "en") {
  return locale === "es" ? "Hoy, 11:59 PM ET" : "Today, 11:59 PM ET";
}

export function formatEasternNowLabel(locale: DdaLocale = "en") {
  return locale === "es" ? "Ahora" : "Now";
}

export function formatEasternTodayLabel(locale: DdaLocale = "en") {
  return locale === "es" ? "Hoy" : "Today";
}

export function subtractDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() - days);
  return next;
}

export function getEasternYmd(date: Date = easternNow()): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: DDA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  return {
    year: Number(parts.find((part) => part.type === "year")?.value ?? 0),
    month: Number(parts.find((part) => part.type === "month")?.value ?? 0),
    day: Number(parts.find((part) => part.type === "day")?.value ?? 0),
  };
}

/** UTC instant for a clock time on the given Eastern calendar day. */
export function easternDateAt(
  year: number,
  month: number,
  day: number,
  hours = 0,
  minutes = 0,
): Date {
  for (let utcHour = 0; utcHour < 24; utcHour += 1) {
    const candidate = new Date(Date.UTC(year, month - 1, day, utcHour, minutes));
    const eastern = getEasternYmd(candidate);
    const easternHour = Number(
      formatInEastern(candidate, { hour: "numeric", hour12: false }),
    );

    if (eastern.year === year && eastern.month === month && eastern.day === day && easternHour === hours) {
      return candidate;
    }
  }

  return new Date(Date.UTC(year, month - 1, day, hours + 5, minutes));
}

export function easternMidnight(date: Date = easternNow()): Date {
  const { year, month, day } = getEasternYmd(date);
  return easternDateAt(year, month, day, 0, 0);
}

export function formatRelativeTimeFromNow(
  date: Date | string | number,
  t: TranslateFn,
  locale: DdaLocale = "en",
): string {
  const timestamp = new Date(date).getTime();
  if (Number.isNaN(timestamp)) return t("common.justNow");

  const diffMs = Date.now() - timestamp;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return t("common.justNow");
  if (minutes < 60) return t("common.minutesAgo", { count: minutes });

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("common.hoursAgo", { count: hours });

  const days = Math.floor(hours / 24);
  if (days < 7) return t("common.daysAgo", { count: days });

  return formatEasternShortDate(date, locale);
}

export function formatRelativeTimeFromIso(
  iso: string,
  t: TranslateFn,
  locale: DdaLocale = "en",
): string {
  return formatRelativeTimeFromNow(iso, t, locale);
}

export function buildRecentEasternMonthDays(count: number, locale: DdaLocale = "en"): string[] {
  const labels: string[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    labels.push(formatEasternMonthDay(subtractDays(easternNow(), offset), locale));
  }
  return labels;
}

export function buildEasternFirstOfMonthAudit(locale: DdaLocale = "en"): string {
  const now = easternNow();
  const { year, month } = getEasternYmd(now);
  return formatEasternShortDate(easternDateAt(year, month, 1, 12), locale);
}

const MAX_CATCH_UP_DAYS = 30;

/** Eastern calendar days after `lastProcessed` through `today` (inclusive). */
export function getMissedEasternDays(
  lastProcessed: string | undefined,
  today = formatEasternIsoDate(),
): string[] {
  if (!today) return [];

  const start = lastProcessed?.trim();
  if (!start || start >= today) {
    if (start === today) return [];
    return [today];
  }

  const days: string[] = [];
  let cursor = addEasternDays(start, 1);

  while (cursor <= today && days.length < MAX_CATCH_UP_DAYS) {
    days.push(cursor);
    if (cursor === today) break;
    cursor = addEasternDays(cursor, 1);
  }

  return days;
}

function addEasternDays(ymd: string, delta: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const base = easternDateAt(year, month, day, 12);
  base.setUTCDate(base.getUTCDate() + delta);
  return formatEasternIsoDate(base);
}
