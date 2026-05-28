import { CALENDAR_EVENTS } from "../data/calendarData";

const STORAGE_KEY = "over-drive-os-calendar-events";

export function loadCalendarEvents() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data.events)) {
        return data.events;
      }
    }
  } catch (err) {
    console.warn("Could not load calendar events:", err);
  }
  return [...CALENDAR_EVENTS];
}

export function saveCalendarEvents(events) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, savedAt: new Date().toISOString(), events })
    );
  } catch (err) {
    console.warn("Could not save calendar events:", err);
  }
}
