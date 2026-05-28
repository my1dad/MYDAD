import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createCalendarEvent, mergeCalendarEvent } from "../data/calendarData";
import { loadCalendarEvents, saveCalendarEvents } from "../lib/calendarStorage";

const CalendarEventsContext = createContext(null);

export function CalendarEventsProvider({ children }) {
  const [events, setEvents] = useState(() => loadCalendarEvents());

  useEffect(() => {
    saveCalendarEvents(events);
  }, [events]);

  const addEvent = useCallback((fields) => {
    const event = createCalendarEvent(fields);
    setEvents((prev) => [...prev, event]);
    return event;
  }, []);

  const updateEvent = useCallback((id, fields) => {
    let updated = null;
    setEvents((prev) =>
      prev.map((event) => {
        if (event.id !== id) return event;
        updated = mergeCalendarEvent(event, fields);
        return updated;
      })
    );
    return updated;
  }, []);

  const deleteEvent = useCallback((id) => {
    setEvents((prev) => prev.filter((event) => event.id !== id));
  }, []);

  const value = useMemo(
    () => ({ events, addEvent, updateEvent, deleteEvent }),
    [events, addEvent, updateEvent, deleteEvent]
  );

  return (
    <CalendarEventsContext.Provider value={value}>{children}</CalendarEventsContext.Provider>
  );
}

export function useCalendarEvents() {
  const ctx = useContext(CalendarEventsContext);
  if (!ctx) {
    throw new Error("useCalendarEvents must be used within CalendarEventsProvider");
  }
  return ctx;
}
