import { useMemo } from "react";
import { useCalendarEvents } from "../../context/CalendarEventsContext";
import { filterCalendarEventsByStatus } from "../../data/calendarData";
import PortfolioMonthCalendar, { useCalendarSelection } from "./PortfolioMonthCalendar";
import { useAddCalendarEventModal } from "./useAddCalendarEventModal";

export default function DashboardCalendarWidget({
  onViewFullCalendar,
  projects = [],
  className,
}) {
  const { events, addEvent } = useCalendarEvents();
  const activeEvents = useMemo(
    () => filterCalendarEventsByStatus(events, "active"),
    [events]
  );
  const { viewDate, setViewDate, selectedDay, setSelectedDay } = useCalendarSelection(activeEvents);

  const { openForDay, modal } = useAddCalendarEventModal({
    events,
    addEvent,
    onDaySelected: setSelectedDay,
    projects,
  });

  return (
    <>
      {modal}
      <PortfolioMonthCalendar
        events={activeEvents}
        compact
        className={className}
        viewDate={viewDate}
        onViewDateChange={setViewDate}
        selectedDay={selectedDay}
        onSelectedDayChange={setSelectedDay}
        onDayDoubleClick={openForDay}
        headerAction={
          onViewFullCalendar ? (
            <button
              type="button"
              onClick={onViewFullCalendar}
              className="text-xs font-medium text-sky-600 hover:text-sky-700"
            >
              View full calendar
            </button>
          ) : null
        }
      />
    </>
  );
}
