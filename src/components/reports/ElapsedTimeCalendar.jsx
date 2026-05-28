import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarClock, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import {
  HEAT_CELL_CLASSES,
  WEEKDAY_LABELS,
  aggregatePortfolioElapsedByDay,
  formatElapsedHoursMinutes,
  getMonthCalendarCells,
  getMonthDateKeys,
  getWeekDateKeys,
  heatLevelForMs,
  portfolioHasLiveElapsed,
  startOfMonth,
  toDateKey,
} from "../../lib/elapsedTimeCalendar";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function ElapsedStatCard({ label, subtitle, ms, accent, compact = false }) {
  const { hours, minutes, shortLabel } = formatElapsedHoursMinutes(ms);
  const accents = {
    indigo: "from-indigo-500/10 to-white ring-indigo-200",
    violet: "from-violet-500/10 to-white ring-violet-200",
    sky: "from-sky-500/10 to-white ring-sky-200",
  };

  if (compact) {
    return (
      <div
        className={cn(
          "rounded-lg border bg-gradient-to-br p-2.5 ring-1 ring-inset",
          accents[accent] ?? accents.indigo
        )}
      >
        <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-1 text-lg font-bold tabular-nums leading-none text-slate-900">
          {shortLabel}
        </p>
        <p className="mt-0.5 truncate text-[9px] text-slate-500">{subtitle}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border bg-gradient-to-br p-4 ring-1 ring-inset shadow-sm",
        accents[accent] ?? accents.indigo
      )}
    >
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-slate-900">
        {shortLabel}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        {hours}h {minutes}m · {subtitle}
      </p>
    </div>
  );
}

function DayElapsedTooltip({ anchor }) {
  if (!anchor) return null;

  const { dateKey, ms, x, y } = anchor;
  const { hours, minutes, shortLabel } = formatElapsedHoursMinutes(ms);
  const dateLabel = new Date(`${dateKey}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return createPortal(
    <div
      role="tooltip"
      className="pointer-events-none fixed z-[100] w-max max-w-[min(220px,calc(100vw-2rem))] rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg ring-1 ring-slate-100"
      style={{
        left: x,
        top: y,
        transform: "translate(-50%, calc(-100% - 8px))",
      }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {dateLabel}
      </p>
      <p className="mt-1 text-base font-bold tabular-nums leading-none text-slate-900">
        {ms > 0 ? shortLabel : "0h 0m"}
      </p>
      <p className="mt-1 text-[10px] text-slate-500">
        {ms > 0
          ? `${hours} hour${hours === 1 ? "" : "s"}${minutes > 0 ? ` ${minutes} min` : ""} elapsed`
          : "No elapsed time this day"}
      </p>
    </div>,
    document.body
  );
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function ElapsedTimeCalendar({ projects = [], compact = false, className }) {
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [selectedKey, setSelectedKey] = useState(() => toDateKey(new Date()));
  const [hoverTip, setHoverTip] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  const hasLive = useMemo(
    () => portfolioHasLiveElapsed(projects, now),
    [projects, now]
  );

  useEffect(() => {
    if (!hasLive) {
      setNow(Date.now());
      return undefined;
    }
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [hasLive, projects]);

  const byDay = useMemo(
    () => aggregatePortfolioElapsedByDay(projects, now),
    [projects, now]
  );

  const monthKeys = useMemo(
    () => getMonthDateKeys(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const maxMonthMs = useMemo(
    () => Math.max(0, ...monthKeys.map((key) => byDay[key] ?? 0)),
    [monthKeys, byDay]
  );

  const cells = useMemo(
    () => getMonthCalendarCells(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const selectedMs = byDay[selectedKey] ?? 0;
  const weekMs = sumWeekMs(
    byDay,
    getWeekDateKeys(new Date(`${selectedKey}T12:00:00`))
  );
  const monthMs = sumWeekMs(byDay, monthKeys);

  const shiftMonth = (delta) => {
    const next = startOfMonth(viewYear, viewMonth + delta);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const monthLabel = `${MONTH_NAMES[viewMonth].slice(0, 3)} ${viewYear}`;

  return (
    <section
      className={cn(
        "relative flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm",
        !compact && "mb-6",
        className
      )}
    >
      <DayElapsedTooltip anchor={hoverTip} />
      <div
        className={cn(
          "shrink-0 border-b border-slate-100",
          compact ? "px-3 py-2.5" : "px-5 py-4 sm:px-6"
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div
              className={cn(
                "flex shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 ring-1 ring-indigo-500/15",
                compact ? "h-7 w-7" : "h-10 w-10 rounded-xl"
              )}
            >
              <CalendarClock className={compact ? "h-3.5 w-3.5" : "h-5 w-5"} />
            </div>
            <div className="min-w-0">
              <h3 className={cn("font-semibold text-slate-900", compact ? "text-xs" : "text-sm")}>
                Elapsed time calendar
              </h3>
              {!compact ? (
                <p className="mt-0.5 max-w-xl text-xs text-slate-500">
                  Standalone time gauge from portfolio task timers — not linked to your events
                  calendar.
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="rounded-md border border-slate-200 p-1 text-slate-500 hover:bg-slate-50"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-[4.5rem] text-center text-[11px] font-semibold text-slate-800">
              {monthLabel}
            </span>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="rounded-md border border-slate-200 p-1 text-slate-500 hover:bg-slate-50"
              aria-label="Next month"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className={cn("flex min-h-0 flex-1 flex-col", compact ? "px-3 py-3" : "px-5 py-5 sm:px-6")}>
        <div className={cn("grid grid-cols-7", compact ? "mb-1.5 gap-1.5" : "mb-2 gap-1.5 sm:gap-2")}>
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className={cn(
                "text-center font-bold uppercase tracking-wide text-slate-400",
                compact ? "py-0 text-[8px]" : "py-1 text-[10px]"
              )}
            >
              {compact ? label.charAt(0) : label}
            </div>
          ))}
        </div>

        <div className={cn("grid grid-cols-7", compact ? "gap-1.5" : "gap-1.5 sm:gap-2")}>
          {cells.map((cell) => {
            if (cell.type === "pad") {
              return (
                <div
                  key={cell.key}
                  className={compact ? "aspect-square w-full min-w-0" : "aspect-square"}
                  aria-hidden
                />
              );
            }

            const ms = byDay[cell.dateKey] ?? 0;
            const level = heatLevelForMs(ms, maxMonthMs);
            const isSelected = cell.dateKey === selectedKey;
            const isToday = cell.dateKey === toDateKey(new Date());
            const { shortLabel } = formatElapsedHoursMinutes(ms);

            return (
              <button
                key={cell.key}
                type="button"
                onClick={() => setSelectedKey(cell.dateKey)}
                onMouseEnter={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  setHoverTip({
                    dateKey: cell.dateKey,
                    ms,
                    x: rect.left + rect.width / 2,
                    y: rect.top,
                  });
                }}
                onMouseLeave={() => setHoverTip(null)}
                className={cn(
                  "relative flex aspect-square w-full min-w-0 items-center justify-center overflow-hidden rounded-md ring-1 ring-inset transition",
                  compact ? "text-[10px] hover:ring-indigo-400" : "flex-col rounded-xl hover:ring-2 hover:ring-indigo-300",
                  HEAT_CELL_CLASSES[level],
                  isSelected && "ring-2 ring-inset ring-indigo-600",
                  isToday && !isSelected && "ring-2 ring-inset ring-slate-300"
                )}
              >
                <span className="font-bold leading-none">{cell.day}</span>
                {!compact && ms > 0 ? (
                  <span className="mt-1 max-w-full truncate px-0.5 text-[9px] font-semibold leading-none opacity-90">
                    {shortLabel}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className={cn("grid grid-cols-3", compact ? "mt-3 gap-2" : "mt-5 gap-4")}>
          <ElapsedStatCard
            compact={compact}
            label="Daily"
            subtitle={new Date(`${selectedKey}T12:00:00`).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
            ms={selectedMs}
            accent="sky"
          />
          <ElapsedStatCard
            compact={compact}
            label="Weekly"
            subtitle="This week"
            ms={weekMs}
            accent="indigo"
          />
          <ElapsedStatCard
            compact={compact}
            label="Monthly"
            subtitle={MONTH_NAMES[viewMonth]}
            ms={monthMs}
            accent="violet"
          />
        </div>

        {Object.keys(byDay).length === 0 ? (
          <p
            className={cn(
              "mt-3 flex items-center gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50 text-slate-500",
              compact ? "px-2 py-1.5 text-[10px]" : "px-3 py-2.5 text-xs"
            )}
          >
            <Clock className="h-3 w-3 shrink-0" />
            Start task timers to populate elapsed time.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function sumWeekMs(byDay, keys) {
  return keys.reduce((sum, key) => sum + (byDay[key] ?? 0), 0);
}
