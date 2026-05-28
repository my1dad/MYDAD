import { getProjectTaskProgressLog } from "./projectUtils";

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function toDateKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfMonth(year, month) {
  return new Date(year, month, 1);
}

export function endOfMonth(year, month) {
  return new Date(year, month + 1, 0);
}

/** Spread task elapsed ms across calendar days between start and end. */
export function distributeMsToDays(startedAt, completedAt, elapsedMs, now, addMs) {
  if (!elapsedMs || elapsedMs <= 0) return;

  const end = completedAt ? new Date(completedAt) : new Date(now);
  let start = startedAt ? new Date(startedAt) : end;
  if (start > end) start = end;

  const startDay = startOfDay(start);
  const endDay = startOfDay(end);
  const days = [];

  for (let cur = startDay.getTime(); cur <= endDay.getTime(); cur += 86400000) {
    days.push(new Date(cur));
  }

  if (days.length === 0) {
    addMs(toDateKey(end), elapsedMs);
    return;
  }

  const perDay = elapsedMs / days.length;
  for (const day of days) {
    addMs(toDateKey(day), perDay);
  }
}

export function aggregatePortfolioElapsedByDay(projects, now = Date.now()) {
  const byDay = {};

  const addMs = (dateKey, ms) => {
    if (!dateKey || !ms) return;
    byDay[dateKey] = (byDay[dateKey] ?? 0) + ms;
  };

  for (const project of projects ?? []) {
    const entries = getProjectTaskProgressLog(project, now);
    for (const entry of entries) {
      distributeMsToDays(
        entry.startedAt,
        entry.completedAt,
        entry.elapsedMs,
        now,
        addMs
      );
    }
  }

  return byDay;
}

export function formatElapsedHoursMinutes(ms) {
  const safe = Math.max(0, ms ?? 0);
  const totalMinutes = Math.floor(safe / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return {
    hours,
    minutes,
    shortLabel: `${hours}h ${minutes}m`,
    longLabel: `${hours} hour${hours === 1 ? "" : "s"} ${minutes} min`,
  };
}

export function sumMsForDateKeys(byDay, keys) {
  return keys.reduce((sum, key) => sum + (byDay[key] ?? 0), 0);
}

export function getMonthCalendarCells(year, month) {
  const first = startOfMonth(year, month);
  const last = endOfMonth(year, month);
  const startPad = first.getDay();
  const daysInMonth = last.getDate();
  const cells = [];

  for (let i = 0; i < startPad; i += 1) {
    cells.push({ type: "pad", key: `pad-${i}` });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    cells.push({
      type: "day",
      key: toDateKey(date),
      date,
      dateKey: toDateKey(date),
      day,
      weekday: date.getDay(),
    });
  }

  return cells;
}

export function getWeekDateKeys(referenceDate = new Date()) {
  const ref = startOfDay(referenceDate);
  const day = ref.getDay();
  const weekStart = new Date(ref);
  weekStart.setDate(ref.getDate() - day);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return toDateKey(d);
  });
}

export function getMonthDateKeys(year, month) {
  const last = endOfMonth(year, month);
  const keys = [];
  for (let day = 1; day <= last.getDate(); day += 1) {
    keys.push(toDateKey(new Date(year, month, day)));
  }
  return keys;
}

export function getWeekdayTotalsForMonth(byDay, year, month) {
  const totals = [0, 0, 0, 0, 0, 0, 0];
  for (const key of getMonthDateKeys(year, month)) {
    const weekday = new Date(`${key}T12:00:00`).getDay();
    totals[weekday] += byDay[key] ?? 0;
  }
  return totals.map((ms, index) => ({
    weekday: index,
    label: WEEKDAY_LABELS[index],
    ms,
  }));
}

export function heatLevelForMs(ms, maxMs) {
  if (!ms || ms <= 0) return 0;
  if (!maxMs || maxMs <= 0) return 1;
  const ratio = ms / maxMs;
  if (ratio < 0.2) return 1;
  if (ratio < 0.4) return 2;
  if (ratio < 0.6) return 3;
  if (ratio < 0.8) return 4;
  return 5;
}

export const HEAT_CELL_CLASSES = {
  0: "bg-slate-50 text-slate-400 ring-slate-100",
  1: "bg-sky-50 text-sky-800 ring-sky-100",
  2: "bg-sky-100 text-sky-900 ring-sky-200",
  3: "bg-indigo-100 text-indigo-900 ring-indigo-200",
  4: "bg-violet-200 text-violet-950 ring-violet-300",
  5: "bg-violet-400 text-white ring-violet-500",
};

export function portfolioHasLiveElapsed(projects, now = Date.now()) {
  for (const project of projects ?? []) {
    const entries = getProjectTaskProgressLog(project, now);
    if (entries.some((e) => e.inProgress)) return true;
  }
  return false;
}
