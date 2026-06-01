import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  createCalendarEvent,
  mergeCalendarEvent,
  normalizeCalendarEvent,
} from "../data/calendarData";
import { loadCalendarEvents, saveCalendarEvents } from "../lib/calendarStorage";
import { archiveDeletedItem } from "../lib/deletedItemsStorage";
import { logWorkspaceActivity } from "../lib/workspaceActivityLog";

const CalendarEventsContext = createContext(null);

export function CalendarEventsProvider({ children }) {
  const [events, setEvents] = useState(() => loadCalendarEvents());

  useEffect(() => {
    setEvents((prev) => {
      const next = prev.map(normalizeCalendarEvent);
      const changed = next.some(
        (event, index) =>
          JSON.stringify(event.preTasks) !== JSON.stringify(prev[index]?.preTasks) ||
          event.preTask !== prev[index]?.preTask
      );
      return changed ? next : prev;
    });
  }, []);

  useEffect(() => {
    saveCalendarEvents(events);
  }, [events]);

  const addEvent = useCallback((fields) => {
    const event = createCalendarEvent(fields);
    setEvents((prev) => [...prev, event]);
    logWorkspaceActivity({
      type: "event_added",
      message: event.title || "Untitled event",
      meta: event.date || "",
    });
    return event;
  }, []);

  const updateEvent = useCallback((id, fields) => {
    let updated = null;
    let previous = null;
    setEvents((prev) =>
      prev.map((event) => {
        if (event.id !== id) return event;
        previous = event;
        updated = mergeCalendarEvent(event, fields);
        return updated;
      })
    );
    if (updated && previous) {
      const wasComplete = Boolean(previous.completed);
      const isNowComplete = Boolean(updated.completed);
      const completionOnly =
        Object.keys(fields ?? {}).length > 0 &&
        Object.keys(fields).every((key) => key === "completed");

      if (!wasComplete && isNowComplete) {
        logWorkspaceActivity({
          type: "event_completed",
          message: updated.title || "Untitled event",
          meta: updated.date || "",
        });
      } else if (!completionOnly) {
        logWorkspaceActivity({
          type: "event_edited",
          message: updated.title || "Untitled event",
          meta: updated.date || "",
        });
      }
    }
    return updated;
  }, []);

  const deleteEvent = useCallback((id, { skipArchive = false } = {}) => {
    let deleted = null;

    setEvents((prev) => {
      deleted = prev.find((item) => item.id === id) ?? null;
      return prev.filter((item) => item.id !== id);
    });

    if (deleted) {
      if (!skipArchive) {
        archiveDeletedItem("event", deleted);
      }
      logWorkspaceActivity({
        type: "event_deleted",
        message: deleted.title || "Untitled event",
        meta: deleted.date || "",
      });
    }
  }, []);

  const restoreEvent = useCallback((snapshot) => {
    const event = normalizeCalendarEvent(snapshot);
    if (!event?.id) return false;

    let restored = false;
    setEvents((prev) => {
      if (prev.some((item) => item.id === event.id)) return prev;
      restored = true;
      return [...prev, event];
    });
    return restored;
  }, []);

  const value = useMemo(
    () => ({ events, addEvent, updateEvent, deleteEvent, restoreEvent }),
    [events, addEvent, updateEvent, deleteEvent, restoreEvent]
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
