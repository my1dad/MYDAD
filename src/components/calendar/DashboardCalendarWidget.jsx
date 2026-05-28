import { useCalendarEvents } from "../../context/CalendarEventsContext";
import PortfolioMonthCalendar, { useCalendarSelection } from "./PortfolioMonthCalendar";
import { useAddCalendarEventModal } from "./useAddCalendarEventModal";

export default function DashboardCalendarWidget({ onViewFullCalendar, projects = [] }) {
  const { events, addEvent } = useCalendarEvents();
  const { viewDate, setViewDate, selectedDay, setSelectedDay } = useCalendarSelection(events);

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
        events={events}
        compact
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
