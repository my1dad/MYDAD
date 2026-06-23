import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "../../i18n/LocaleContext";
import {
  DDA_TIMEZONE,
  easternDateAt,
  formatEasternIsoDate,
  formatEasternShortDate,
  formatEasternTodayLabel,
  getEasternYmd,
} from "../../lib/dateTime";

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function ymdFromParts(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseYmd(ymd) {
  if (!ymd) return null;
  const [year, month, day] = ymd.split("-").map(Number);
  if (!year || !month || !day) return null;
  return { year, month, day };
}

function weekdayIndex(year, month, day) {
  const date = easternDateAt(year, month, day, 12);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: DDA_TIMEZONE,
    weekday: "short",
  }).format(date);
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[weekday] ?? 0;
}

function daysInMonth(year, month) {
  for (let day = 31; day >= 28; day -= 1) {
    const iso = formatEasternIsoDate(easternDateAt(year, month, day, 12));
    const [y, m] = iso.split("-");
    if (Number(y) === year && Number(m) === month) return day;
  }
  return 30;
}

function shiftMonth(year, month, delta) {
  let nextMonth = month + delta;
  let nextYear = year;
  while (nextMonth < 1) {
    nextMonth += 12;
    nextYear -= 1;
  }
  while (nextMonth > 12) {
    nextMonth -= 12;
    nextYear += 1;
  }
  return { year: nextYear, month: nextMonth };
}

function buildMonthGrid(year, month) {
  const totalDays = daysInMonth(year, month);
  const leading = weekdayIndex(year, month, 1);
  const cells = [];

  const { year: prevYear, month: prevMonth } = shiftMonth(year, month, -1);
  const prevMonthDays = daysInMonth(prevYear, prevMonth);

  for (let i = leading - 1; i >= 0; i -= 1) {
    const day = prevMonthDays - i;
    cells.push({
      ymd: ymdFromParts(prevYear, prevMonth, day),
      day,
      inMonth: false,
    });
  }

  for (let day = 1; day <= totalDays; day += 1) {
    cells.push({
      ymd: ymdFromParts(year, month, day),
      day,
      inMonth: true,
    });
  }

  let nextDay = 1;
  const { year: nextYear, month: nextMonth } = shiftMonth(year, month, 1);
  while (cells.length % 7 !== 0) {
    cells.push({
      ymd: ymdFromParts(nextYear, nextMonth, nextDay),
      day: nextDay,
      inMonth: false,
    });
    nextDay += 1;
  }

  return cells;
}

export default function RecurringDateCalendar({ value, onChange }) {
  const { t, locale } = useLocale();
  const todayYmd = formatEasternIsoDate();
  const selected = parseYmd(value) ?? getEasternYmd();

  const [viewYear, setViewYear] = useState(selected.year);
  const [viewMonth, setViewMonth] = useState(selected.month);

  useEffect(() => {
    const next = parseYmd(value);
    if (!next) return;
    setViewYear(next.year);
    setViewMonth(next.month);
  }, [value]);

  const monthLabel = useMemo(() => {
    const date = easternDateAt(viewYear, viewMonth, 1, 12);
    return new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", {
      timeZone: DDA_TIMEZONE,
      month: "long",
      year: "numeric",
    }).format(date);
  }, [viewYear, viewMonth, locale]);

  const cells = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const goMonth = (delta) => {
    const next = shiftMonth(viewYear, viewMonth, delta);
    setViewYear(next.year);
    setViewMonth(next.month);
  };

  const jumpToToday = () => {
    const { year, month } = getEasternYmd();
    setViewYear(year);
    setViewMonth(month);
    onChange(todayYmd);
  };

  return (
    <div className="dda-recurring-calendar">
      <div className="dda-recurring-calendar__header">
        <button
          type="button"
          onClick={() => goMonth(-1)}
          className="dda-recurring-calendar__nav"
          aria-label={t("pages.accounts.recurringCalendarPrev")}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-white">{monthLabel}</p>
        </div>
        <button
          type="button"
          onClick={() => goMonth(1)}
          className="dda-recurring-calendar__nav"
          aria-label={t("pages.accounts.recurringCalendarNext")}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="dda-recurring-calendar__weekdays">
        {WEEKDAY_KEYS.map((key) => (
          <span key={key} className="dda-recurring-calendar__weekday">
            {t(`pages.accounts.recurringWeekday.${key}`)}
          </span>
        ))}
      </div>

      <div className="dda-recurring-calendar__grid">
        {cells.map((cell) => {
          const isSelected = cell.ymd === value;
          const isToday = cell.ymd === todayYmd;
          return (
            <button
              key={`${cell.ymd}-${cell.inMonth ? "in" : "out"}`}
              type="button"
              onClick={() => onChange(cell.ymd)}
              className={cn(
                "dda-recurring-calendar__day",
                !cell.inMonth && "dda-recurring-calendar__day--muted",
                isSelected && "dda-recurring-calendar__day--selected",
                isToday && !isSelected && "dda-recurring-calendar__day--today",
              )}
              aria-label={formatEasternShortDate(cell.ymd, locale)}
              aria-pressed={isSelected}
            >
              {cell.day}
            </button>
          );
        })}
      </div>

      <button type="button" onClick={jumpToToday} className="dda-recurring-calendar__today">
        {formatEasternTodayLabel(locale)}
      </button>
    </div>
  );
}
