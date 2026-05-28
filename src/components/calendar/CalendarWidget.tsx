import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import {
  calendarEvents,
  eventTypeColors,
  type CalendarEventType,
} from "@/data/mockData";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const legend: { type: CalendarEventType; label: string }[] = [
  { type: "milestone", label: "Milestone" },
  { type: "deadline", label: "Deadline" },
  { type: "event", label: "Event" },
  { type: "meeting", label: "Meeting" },
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export function CalendarWidget() {
  const today = new Date();
  const [viewDate, setViewDate] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedDay, setSelectedDay] = useState(today.getDate());

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const eventMap = useMemo(() => {
    const map = new Map<number, CalendarEventType[]>();
    calendarEvents.forEach((e) => map.set(e.date, e.types));
    return map;
  }, []);

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () =>
    setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () =>
    setViewDate(new Date(year, month + 1, 1));

  const isToday = (day: number) =>
    day === today.getDate() &&
    month === today.getMonth() &&
    year === today.getFullYear();

  return (
    <Card title="Calendar">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={prevMonth}
          aria-label="Previous month"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h4 className="text-sm font-semibold text-slate-800">
          {MONTH_NAMES[month]} {year}
        </h4>
        <button
          type="button"
          onClick={nextMonth}
          aria-label="Next month"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400"
          >
            {d}
          </div>
        ))}
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} className="aspect-square" />;
          }
          const events = eventMap.get(day) ?? [];
          const selected = day === selectedDay;
          const todayCell = isToday(day);

          return (
            <button
              key={day}
              type="button"
              onClick={() => setSelectedDay(day)}
              className={cn(
                "relative flex aspect-square flex-col items-center justify-center rounded-xl text-xs font-medium transition",
                selected
                  ? "bg-gradient-to-br from-violet-600 to-blue-500 text-white shadow-md shadow-violet-500/25"
                  : todayCell
                    ? "ring-2 ring-violet-300 ring-offset-1 text-violet-700"
                    : "text-slate-700 hover:bg-slate-100"
              )}
            >
              {day}
              {events.length > 0 && (
                <div className="absolute bottom-1 flex gap-0.5">
                  {events.slice(0, 3).map((type, i) => (
                    <span
                      key={`${day}-${type}-${i}`}
                      className="h-1 w-1 rounded-full"
                      style={{
                        backgroundColor: selected
                          ? "rgba(255,255,255,0.9)"
                          : eventTypeColors[type],
                      }}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-3 border-t border-slate-100 pt-4">
        {legend.map(({ type, label }) => (
          <div key={type} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: eventTypeColors[type] }}
            />
            <span className="text-[10px] text-slate-500">{label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
