import { useMemo, useState } from "react";
import {
  Calendar,
  CalendarDays,
  Clock,
  Flag,
  Plus,
  Users,
} from "lucide-react";
import {
  CALENDAR_TYPE_FILTERS,
  eventInMonth,
  parseEventDate,
} from "../../data/calendarData";
import { useCalendarEvents } from "../../context/CalendarEventsContext";
import AddCalendarEventModal, { formatAddEventDateLabel } from "./AddCalendarEventModal";
import PortfolioMonthCalendar, {
  CalendarDaySidebar,
  useCalendarSelection,
} from "./PortfolioMonthCalendar";
import { useAddCalendarEventModal } from "./useAddCalendarEventModal";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function CalendarStatCard({ icon: Icon, label, value, subtitle, accent }) {
  const accents = {
    slate: "bg-slate-500/10 text-slate-700 ring-slate-500/15",
    sky: "bg-sky-500/10 text-sky-700 ring-sky-500/15",
    violet: "bg-violet-500/10 text-violet-700 ring-violet-500/15",
    amber: "bg-amber-500/10 text-amber-700 ring-amber-500/15",
    emerald: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/15",
  };

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div
        className={cn(
          "mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg ring-1",
          accents[accent] ?? accents.slate
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-2xl font-bold tabular-nums text-slate-900">{value}</p>
      <p className="mt-0.5 text-xs font-semibold text-slate-700">{label}</p>
      <p className="mt-1 text-[11px] text-slate-500">{subtitle}</p>
    </div>
  );
}

export default function CalendarPage({ projects = [] }) {
  const { events, addEvent, updateEvent, deleteEvent } = useCalendarEvents();
  const [typeFilter, setTypeFilter] = useState("all");
  const [editingEvent, setEditingEvent] = useState(null);

  const filteredEvents = useMemo(() => {
    if (typeFilter === "all") return events;
    return events.filter((e) => e.type === typeFilter);
  }, [typeFilter, events]);

  const {
    viewDate,
    setViewDate,
    selectedDay,
    setSelectedDay,
    selectedDayEvents,
    selectedLabel,
    year,
    month,
  } = useCalendarSelection(filteredEvents);

  const { openForDay, modal } = useAddCalendarEventModal({
    events,
    addEvent,
    onDaySelected: setSelectedDay,
    projects,
  });

  const editDateLabel = editingEvent
    ? (() => {
        const { year: y, month: m, day: d } = parseEventDate(editingEvent.date);
        return formatAddEventDateLabel(y, m, d);
      })()
    : "";

  const handleDeleteEvent = (event) => {
    deleteEvent(event.id);
  };

  const monthStats = useMemo(() => {
    const inMonth = filteredEvents.filter((e) => eventInMonth(e, year, month));
    return {
      total: inMonth.length,
      milestones: inMonth.filter((e) => e.type === "milestone").length,
      deadlines: inMonth.filter((e) => e.type === "deadline").length,
      meetings: inMonth.filter((e) => e.type === "meeting").length,
    };
  }, [filteredEvents, year, month]);

  return (
    <div className="mx-auto max-w-[1600px]">
      {modal}

      <AddCalendarEventModal
        open={Boolean(editingEvent)}
        mode="edit"
        editingEvent={editingEvent}
        dateLabel={editDateLabel}
        defaultDate={editingEvent?.date ?? ""}
        projects={projects}
        onClose={() => setEditingEvent(null)}
        onSubmit={(fields) => {
          if (editingEvent) updateEvent(editingEvent.id, fields);
          setEditingEvent(null);
        }}
      />

      <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-sky-50/40 p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-xl bg-sky-500/10 px-4 py-2 text-base font-bold text-sky-700 ring-1 ring-sky-500/15">
              <Calendar className="h-5 w-5" />
              Calendar
            </div>
          </div>
          <button
            type="button"
            onClick={() => openForDay(selectedDay, year, month)}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-600/20 transition hover:bg-sky-700"
          >
            <Plus className="h-4 w-4" />
            Add Event
          </button>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CalendarStatCard
          icon={CalendarDays}
          label="This month"
          value={monthStats.total}
          subtitle="Scheduled items"
          accent="sky"
        />
        <CalendarStatCard
          icon={Flag}
          label="Milestones"
          value={monthStats.milestones}
          subtitle="Key delivery dates"
          accent="violet"
        />
        <CalendarStatCard
          icon={Clock}
          label="Deadlines"
          value={monthStats.deadlines}
          subtitle="Due dates to watch"
          accent="amber"
        />
        <CalendarStatCard
          icon={Users}
          label="Meetings"
          value={monthStats.meetings}
          subtitle="Syncs and reviews"
          accent="emerald"
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-1">
        {CALENDAR_TYPE_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setTypeFilter(f.id)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition",
              typeFilter === f.id
                ? "bg-sky-600 text-white shadow-sm"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <PortfolioMonthCalendar
          events={filteredEvents}
          viewDate={viewDate}
          onViewDateChange={setViewDate}
          selectedDay={selectedDay}
          onSelectedDayChange={setSelectedDay}
          onDayDoubleClick={openForDay}
        />
        <CalendarDaySidebar
          selectedLabel={selectedLabel}
          selectedDayEvents={selectedDayEvents}
          onEdit={setEditingEvent}
          onDelete={handleDeleteEvent}
        />
      </div>
    </div>
  );
}
