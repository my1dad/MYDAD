import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Pencil, Trash2 } from "lucide-react";
import CalendarEventDetailPopover from "./CalendarEventDetailPopover";
import {
  CALENDAR_EVENTS,
  EVENT_TYPE_COLORS,
  EVENT_TYPE_LABELS,
  MONTH_NAMES,
  WEEKDAYS,
  getDaysInMonth,
  getEventsForDay,
  getFirstDayOfMonth,
  getEventStageColor,
  groupEventsByDay,
} from "../../data/calendarData";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

export function EventAgendaItem({ event, onSelect, onEdit, onDelete }) {
  const stageColor = getEventStageColor(event);

  const handleSelect = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    onSelect?.(event, rect);
  };

  const handleEdit = (e) => {
    e.stopPropagation();
    onEdit?.(event);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    if (window.confirm(`Delete "${event.title}"?`)) onDelete?.(event);
  };

  return (
    <li
      role="button"
      tabIndex={0}
      onClick={handleSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleSelect(e);
        }
      }}
      className="group flex w-full cursor-pointer gap-3 rounded-xl border bg-slate-50/50 p-3 text-left transition hover:border-slate-200 hover:bg-white hover:shadow-sm"
      style={{ borderColor: `${stageColor}35`, backgroundColor: `${stageColor}08` }}
    >
        <div
          className="mt-0.5 h-full w-1.5 shrink-0 self-stretch rounded-full"
          style={{ backgroundColor: stageColor }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
              style={{
                backgroundColor: `${EVENT_TYPE_COLORS[event.type]}18`,
                color: EVENT_TYPE_COLORS[event.type],
              }}
            >
              {EVENT_TYPE_LABELS[event.type]}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-slate-500">
              <Clock className="h-3 w-3" />
              {event.time}
            </span>
          </div>
          <p className="mt-1 text-sm font-semibold text-slate-900">{event.title}</p>
          {event.description ? (
            <p className="mt-1 line-clamp-2 text-xs text-slate-500">{event.description}</p>
          ) : null}
          {event.preTask ? (
            <p className="mt-1 text-[11px] text-slate-500">
              <span className="font-semibold text-slate-600">Pre-Task:</span> {event.preTask}
            </p>
          ) : null}
          {event.tags?.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {event.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-200/80"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          {event.project ? (
            <span
              className="mt-1 inline-block truncate rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{
                backgroundColor: `${stageColor}18`,
                color: stageColor,
              }}
            >
              {event.project}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col gap-1 opacity-70 transition group-hover:opacity-100">
          <button
            type="button"
            title="Edit event"
            onClick={handleEdit}
            className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Delete event"
            onClick={handleDelete}
            className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
    </li>
  );
}

export default function PortfolioMonthCalendar({
  events = CALENDAR_EVENTS,
  compact = false,
  className,
  headerAction = null,
  selectedDay: controlledSelectedDay,
  onSelectedDayChange,
  viewDate: controlledViewDate,
  onViewDateChange,
  onDayDoubleClick,
}) {
  const today = new Date();
  const [internalViewDate, setInternalViewDate] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [internalSelectedDay, setInternalSelectedDay] = useState(today.getDate());

  const viewDate = controlledViewDate ?? internalViewDate;
  const setViewDate = onViewDateChange ?? setInternalViewDate;
  const selectedDay = controlledSelectedDay ?? internalSelectedDay;
  const setSelectedDay = onSelectedDayChange ?? setInternalSelectedDay;

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const eventMap = useMemo(
    () => groupEventsByDay(events, year, month),
    [events, year, month]
  );

  const cells = useMemo(() => {
    const list = [
      ...Array(firstDay).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    while (list.length % 7 !== 0) list.push(null);
    return list;
  }, [firstDay, daysInMonth]);

  const goToday = () => {
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDay(today.getDate());
  };

  const isToday = (day) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const navBtnClass = cn(
    "flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50",
    compact ? "h-8 w-8" : "h-9 w-9"
  );

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm",
        className
      )}
    >
      {headerAction && (
        <div className="flex items-center justify-end border-b border-slate-100 px-4 py-2 sm:px-5">
          {headerAction}
        </div>
      )}

      <div
        className={cn(
          "flex items-center justify-between border-b border-slate-100",
          compact ? "px-4 py-3" : "px-5 py-4"
        )}
      >
        <button
          type="button"
          onClick={() => setViewDate(new Date(year, month - 1, 1))}
          aria-label="Previous month"
          className={navBtnClass}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-center">
          <h2
            className={cn(
              "font-bold text-slate-900",
              compact ? "text-base" : "text-lg"
            )}
          >
            {MONTH_NAMES[month]} {year}
          </h2>
          <button
            type="button"
            onClick={goToday}
            className="mt-0.5 text-xs font-medium text-sky-600 hover:text-sky-700"
          >
            Jump to today
          </button>
        </div>
        <button
          type="button"
          onClick={() => setViewDate(new Date(year, month + 1, 1))}
          aria-label="Next month"
          className={navBtnClass}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className={cn(compact ? "p-3 sm:p-4" : "p-4 sm:p-5")}>
        <div className={cn("grid grid-cols-7", compact ? "gap-1" : "gap-1 sm:gap-2")}>
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className={cn(
                "py-2 text-center font-semibold uppercase tracking-wide text-slate-400",
                compact ? "text-[10px]" : "text-[11px]"
              )}
            >
              {d}
            </div>
          ))}
          {cells.map((day, idx) => {
            if (day === null) {
              return (
                <div
                  key={`empty-${idx}`}
                  className="aspect-square w-full"
                  aria-hidden
                />
              );
            }

            const dayEvents = eventMap.get(day) ?? [];
            const selected = day === selectedDay;
            const todayCell = isToday(day);

            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDay(day)}
                onDoubleClick={(e) => {
                  e.preventDefault();
                  onDayDoubleClick?.(day, year, month);
                }}
                title={onDayDoubleClick ? "Double-click to add an event" : undefined}
                className={cn(
                  "flex aspect-square w-full min-w-0 flex-col rounded-lg border p-1 text-left transition",
                  compact ? "sm:rounded-lg sm:p-1" : "sm:rounded-xl sm:p-1.5",
                  selected
                    ? "border-sky-500 bg-sky-50 ring-2 ring-sky-500/20"
                    : todayCell
                      ? "border-sky-200 bg-sky-50/30 hover:bg-sky-50/60"
                      : "border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                )}
              >
                <span
                  className={cn(
                    "mb-0.5 flex shrink-0 items-center justify-center rounded-full font-semibold",
                    compact
                      ? "h-6 w-6 text-[10px] sm:h-6 sm:w-6 sm:text-[11px]"
                      : "h-6 w-6 text-[11px] sm:mb-1 sm:h-7 sm:w-7 sm:text-xs",
                    selected
                      ? "bg-sky-600 text-white"
                      : todayCell
                        ? "bg-sky-100 text-sky-700"
                        : "text-slate-700"
                  )}
                >
                  {day}
                </span>
                <div className="mt-auto space-y-0.5 overflow-hidden">
                  {dayEvents.slice(0, compact ? 1 : 2).map((event) => {
                    const stageColor = getEventStageColor(event);
                    return (
                      <span
                        key={event.id}
                        className={cn(
                          "block truncate rounded border-l-2 px-1 py-0.5 font-semibold leading-tight",
                          compact ? "text-[8px] sm:text-[9px]" : "text-[9px] sm:text-[10px]"
                        )}
                        style={{
                          backgroundColor: `${stageColor}22`,
                          borderLeftColor: stageColor,
                          color: stageColor,
                        }}
                      >
                        {event.title}
                      </span>
                    );
                  })}
                  {dayEvents.length > (compact ? 1 : 2) && (
                    <span
                      className={cn(
                        "block px-1 font-medium text-slate-500",
                        compact ? "text-[8px]" : "text-[9px]"
                      )}
                    >
                      +{dayEvents.length - (compact ? 1 : 2)} more
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function useCalendarSelection(events = CALENDAR_EVENTS) {
  const today = new Date();
  const [viewDate, setViewDate] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedDay, setSelectedDay] = useState(today.getDate());

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const selectedDayEvents = useMemo(
    () => getEventsForDay(events, year, month, selectedDay),
    [events, year, month, selectedDay]
  );

  const selectedLabel = `${MONTH_NAMES[month]} ${selectedDay}, ${year}`;

  return {
    viewDate,
    setViewDate,
    selectedDay,
    setSelectedDay,
    selectedDayEvents,
    selectedLabel,
    year,
    month,
  };
}

export function CalendarDaySidebar({
  selectedLabel,
  selectedDayEvents,
  onEdit,
  onDelete,
}) {
  const [detailEvent, setDetailEvent] = useState(null);
  const [anchorRect, setAnchorRect] = useState(null);

  const closeDetail = () => {
    setDetailEvent(null);
    setAnchorRect(null);
  };

  const handleSelect = (event, rect) => {
    setDetailEvent(event);
    setAnchorRect(rect);
  };

  return (
    <aside className="relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="text-sm font-semibold text-slate-900">{selectedLabel}</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          {selectedDayEvents.length === 0
            ? "No events on this day"
            : `${selectedDayEvents.length} event${selectedDayEvents.length === 1 ? "" : "s"}`}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {selectedDayEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CalendarDays className="mb-3 h-9 w-9 text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">Nothing scheduled</p>
            <p className="mt-1 max-w-[200px] text-xs text-slate-400">
              Double-click a day to add an event. Click an event to view details.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {selectedDayEvents.map((event) => (
              <EventAgendaItem
                key={event.id}
                event={event}
                onSelect={handleSelect}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </ul>
        )}
      </div>

      <CalendarEventDetailPopover
        event={detailEvent}
        anchorRect={anchorRect}
        open={Boolean(detailEvent)}
        onClose={closeDetail}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </aside>
  );
}
