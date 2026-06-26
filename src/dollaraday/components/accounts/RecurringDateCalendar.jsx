import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "../../i18n/LocaleContext";
import {
  buildRecurringOccurrenceMap,
  getRecurringOccurrencesForDate,
} from "../../lib/recurringCashflow";
import { formatPoolCurrency } from "../../data/mockData";
import {
  getActiveTimezone,
  easternDateAt,
  formatEasternIsoDate,
  formatEasternShortDate,
  formatEasternTodayLabel,
  getEasternYmd,
} from "../../lib/dateTime";
import RecurringCalendarDayModal from "./RecurringCalendarDayModal";

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
    timeZone: getActiveTimezone(),
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

function buildDayAriaLabel(cell, summary, locale, t) {
  const dateLabel = formatEasternShortDate(cell.ymd, locale);
  if (!summary) return dateLabel;

  const parts = [];
  if (summary.income > 0) {
    parts.push(t("pages.accounts.recurringCalendarDayIncome", { count: summary.income }));
  }
  if (summary.expense > 0) {
    parts.push(t("pages.accounts.recurringCalendarDayExpense", { count: summary.expense }));
  }
  if (summary.transfer > 0) {
    parts.push(t("pages.accounts.recurringCalendarDayTransfer", { count: summary.transfer }));
  }

  return `${dateLabel} · ${parts.join(", ")}`;
}

function RecurringDayHoverPopover({ anchor, occurrences, locale, t, onMouseEnter, onMouseLeave }) {
  const popoverRef = useRef(null);
  const [position, setPosition] = useState(null);

  const updatePosition = useCallback(() => {
    if (!anchor?.rect || !popoverRef.current) {
      setPosition(null);
      return;
    }

    const popover = popoverRef.current;
    const { rect } = anchor;
    const pad = 12;
    const gap = 10;
    const width = popover.offsetWidth;
    const height = popover.offsetHeight;

    const centerX = rect.left + rect.width / 2;
    const left = Math.min(
      Math.max(centerX, pad + width / 2),
      window.innerWidth - pad - width / 2,
    );

    const spaceAbove = rect.top - pad;
    const spaceBelow = window.innerHeight - rect.bottom - pad;
    const placeAbove = spaceAbove >= height + gap || spaceAbove >= spaceBelow;

    let top;
    let transform;
    if (placeAbove) {
      top = rect.top - gap;
      transform = "translate(-50%, -100%)";
    } else {
      top = rect.bottom + gap;
      transform = "translate(-50%, 0)";
    }

    setPosition({ left, top, transform, placeAbove });
  }, [anchor]);

  useLayoutEffect(() => {
    updatePosition();
  }, [updatePosition, occurrences.length]);

  useEffect(() => {
    if (!anchor?.rect) return undefined;

    const handleReposition = () => updatePosition();
    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);

    return () => {
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
  }, [anchor?.rect, updatePosition]);

  if (!anchor?.rect) return null;

  return createPortal(
    <div
      ref={popoverRef}
      className="dda-recurring-calendar__hover"
      style={
        position
          ? {
              left: `${position.left}px`,
              top: `${position.top}px`,
              transform: position.transform,
            }
          : {
              left: `${anchor.rect.left + anchor.rect.width / 2}px`,
              top: `${anchor.rect.top - 8}px`,
              transform: "translate(-50%, -100%)",
              visibility: "hidden",
            }
      }
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      role="tooltip"
    >
      <p className="dda-recurring-calendar__hover-title">
        {formatEasternShortDate(anchor.ymd, locale)}
      </p>
      <ul className="dda-recurring-calendar__hover-list">
        {occurrences.map(({ schedule, settled }) => {
          const sign =
            schedule.type === "income" ? "+" : schedule.type === "expense" ? "−" : "↔";
          return (
            <li key={schedule.id} className="dda-recurring-calendar__hover-item">
              <div className="dda-recurring-calendar__hover-row">
                <span
                  className={cn(
                    "dda-recurring-calendar__hover-type",
                    schedule.type === "income" && "dda-recurring-calendar__hover-type--income",
                    schedule.type === "expense" && "dda-recurring-calendar__hover-type--expense",
                    schedule.type === "transfer" && "dda-recurring-calendar__hover-type--transfer",
                  )}
                >
                  {t(
                    `pages.accounts.recurring${schedule.type.charAt(0).toUpperCase()}${schedule.type.slice(1)}`,
                  )}
                </span>
                <span
                  className={cn(
                    "dda-recurring-calendar__hover-amount tabular-nums",
                    schedule.type === "income" && "text-dda-green-light",
                    schedule.type === "expense" && "text-red-400",
                    schedule.type === "transfer" && "text-sky-300",
                  )}
                >
                  {sign}
                  {formatPoolCurrency(schedule.amount)}
                </span>
              </div>
              <p className="dda-recurring-calendar__hover-label">
                {schedule.label || t("pages.accounts.recurringUntitled")}
              </p>
              {settled ? (
                <span className="dda-recurring-calendar__hover-paid">
                  {t("pages.accounts.recurringCalendarPaid")}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="dda-recurring-calendar__hover-foot">
        {t("pages.accounts.recurringCalendarHoverFoot")}
      </p>
    </div>,
    document.body,
  );
}

export default function RecurringDateCalendar({
  value,
  onChange,
  schedules = [],
  onEditSchedule,
  onDeleteSchedule,
  onPayOccurrence,
}) {
  const { t, locale } = useLocale();
  const todayYmd = formatEasternIsoDate();
  const selected = parseYmd(value) ?? getEasternYmd();
  const hoverTimerRef = useRef(null);

  const [viewYear, setViewYear] = useState(selected.year);
  const [viewMonth, setViewMonth] = useState(selected.month);
  const [hoverAnchor, setHoverAnchor] = useState(null);
  const [modalYmd, setModalYmd] = useState(null);
  const [payStatus, setPayStatus] = useState(null);

  useEffect(() => {
    const next = parseYmd(value);
    if (!next) return;
    setViewYear(next.year);
    setViewMonth(next.month);
  }, [value]);

  const monthLabel = useMemo(() => {
    const date = easternDateAt(viewYear, viewMonth, 1, 12);
    return new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", {
      timeZone: getActiveTimezone(),
      month: "long",
      year: "numeric",
    }).format(date);
  }, [viewYear, viewMonth, locale]);

  const cells = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const occurrenceMap = useMemo(() => {
    if (!schedules.length || !cells.length) return new Map();
    const fromYmd = cells[0].ymd;
    const toYmd = cells[cells.length - 1].ymd;
    return buildRecurringOccurrenceMap(schedules, fromYmd, toYmd);
  }, [schedules, cells]);

  const modalOccurrences = useMemo(
    () => (modalYmd ? getRecurringOccurrencesForDate(schedules, modalYmd) : []),
    [modalYmd, schedules],
  );

  const hoverOccurrences = useMemo(
    () => (hoverAnchor?.ymd ? getRecurringOccurrencesForDate(schedules, hoverAnchor.ymd) : []),
    [hoverAnchor?.ymd, schedules],
  );

  const hasScheduledItems = schedules.some((item) => item.enabled);

  const clearHoverTimer = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  const scheduleHover = (ymd, rect) => {
    clearHoverTimer();
    hoverTimerRef.current = setTimeout(() => {
      setHoverAnchor({ ymd, rect });
    }, 120);
  };

  const clearHover = () => {
    clearHoverTimer();
    hoverTimerRef.current = setTimeout(() => {
      setHoverAnchor(null);
    }, 80);
  };

  const keepHover = () => {
    clearHoverTimer();
  };

  useEffect(() => () => clearHoverTimer(), []);

  const goMonth = (delta) => {
    const next = shiftMonth(viewYear, viewMonth, delta);
    setViewYear(next.year);
    setViewMonth(next.month);
    setHoverAnchor(null);
  };

  const jumpToToday = () => {
    const { year, month } = getEasternYmd();
    setViewYear(year);
    setViewMonth(month);
    onChange(todayYmd);
  };

  const handleDayClick = (cell, hasOccurrences) => {
    onChange(cell.ymd);
    if (hasOccurrences) {
      setPayStatus(null);
      setModalYmd(cell.ymd);
    }
  };

  const handleCloseModal = () => {
    setModalYmd(null);
    setPayStatus(null);
  };

  const handleEdit = useCallback(
    (schedule) => {
      handleCloseModal();
      onEditSchedule?.(schedule);
    },
    [onEditSchedule],
  );

  const handleDelete = useCallback(
    (scheduleId) => {
      onDeleteSchedule?.(scheduleId);
      if (modalOccurrences.length <= 1) {
        handleCloseModal();
      }
    },
    [onDeleteSchedule, modalOccurrences.length],
  );

  const handlePayNow = useCallback(
    (scheduleId, dayYmd) => {
      setPayStatus(null);
      const result = onPayOccurrence?.(scheduleId, dayYmd);
      if (result === "ok") {
        setPayStatus({ type: "success", message: t("pages.accounts.recurringPayNowSuccess") });
      } else if (result === "already_paid") {
        setPayStatus({ type: "error", message: t("pages.accounts.recurringPayNowAlready") });
      } else if (result === "failed") {
        setPayStatus({ type: "error", message: t("pages.accounts.recurringPayNowFailed") });
      } else {
        setPayStatus({ type: "error", message: t("pages.accounts.recurringPayNowFailed") });
      }
    },
    [onPayOccurrence, t],
  );

  return (
    <>
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

        {hasScheduledItems ? (
          <p className="dda-recurring-calendar__hint">{t("pages.accounts.recurringCalendarHint")}</p>
        ) : null}

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
            const summary = occurrenceMap.get(cell.ymd);
            const hasOccurrences = Boolean(
              summary && (summary.income > 0 || summary.expense > 0 || summary.transfer > 0),
            );

            return (
              <button
                key={`${cell.ymd}-${cell.inMonth ? "in" : "out"}`}
                type="button"
                onClick={() => handleDayClick(cell, hasOccurrences)}
                onMouseEnter={(event) => {
                  if (!hasOccurrences) return;
                  scheduleHover(cell.ymd, event.currentTarget.getBoundingClientRect());
                }}
                onMouseLeave={clearHover}
                className={cn(
                  "dda-recurring-calendar__day",
                  !cell.inMonth && "dda-recurring-calendar__day--muted",
                  isSelected && "dda-recurring-calendar__day--selected",
                  isToday && !isSelected && "dda-recurring-calendar__day--today",
                  hasOccurrences && "dda-recurring-calendar__day--scheduled",
                  hasOccurrences && summary.income > 0 && "dda-recurring-calendar__day--income",
                  hasOccurrences && summary.expense > 0 && "dda-recurring-calendar__day--expense",
                  hasOccurrences && summary.transfer > 0 && "dda-recurring-calendar__day--transfer",
                  modalYmd === cell.ymd && "dda-recurring-calendar__day--open",
                )}
                aria-label={buildDayAriaLabel(cell, summary, locale, t)}
                aria-pressed={isSelected}
              >
                <span className="dda-recurring-calendar__day-num">{cell.day}</span>
                {hasOccurrences ? (
                  <span className="dda-recurring-calendar__dots" aria-hidden="true">
                    {summary.income > 0 ? (
                      <span className="dda-recurring-calendar__dot dda-recurring-calendar__dot--income" />
                    ) : null}
                    {summary.expense > 0 ? (
                      <span className="dda-recurring-calendar__dot dda-recurring-calendar__dot--expense" />
                    ) : null}
                    {summary.transfer > 0 ? (
                      <span className="dda-recurring-calendar__dot dda-recurring-calendar__dot--transfer" />
                    ) : null}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {hasScheduledItems ? (
          <ul className="dda-recurring-calendar__legend">
            <li>
              <span className="dda-recurring-calendar__dot dda-recurring-calendar__dot--income" />
              {t("pages.accounts.recurringIncome")}
            </li>
            <li>
              <span className="dda-recurring-calendar__dot dda-recurring-calendar__dot--expense" />
              {t("pages.accounts.recurringExpense")}
            </li>
            <li>
              <span className="dda-recurring-calendar__dot dda-recurring-calendar__dot--transfer" />
              {t("pages.accounts.recurringTransfer")}
            </li>
          </ul>
        ) : null}

        <button type="button" onClick={jumpToToday} className="dda-recurring-calendar__today">
          {formatEasternTodayLabel(locale)}
        </button>
      </div>

      <RecurringDayHoverPopover
        anchor={hoverAnchor}
        occurrences={hoverOccurrences}
        locale={locale}
        t={t}
        onMouseEnter={keepHover}
        onMouseLeave={clearHover}
      />

      <RecurringCalendarDayModal
        open={Boolean(modalYmd)}
        dayYmd={modalYmd}
        occurrences={modalOccurrences}
        onClose={handleCloseModal}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onPayNow={handlePayNow}
        payStatus={payStatus}
      />
    </>
  );
}
