export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const MONTH_NAMES = [
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

export const EVENT_TYPE_COLORS = {
  milestone: "#8b5cf6",
  deadline: "#f59e0b",
  event: "#3b82f6",
  meeting: "#10b981",
};

export const EVENT_TYPE_LABELS = {
  milestone: "Milestone",
  deadline: "Deadline",
  event: "Event",
  meeting: "Meeting",
};

export const CALENDAR_LEGEND = [
  { type: "milestone", label: "Milestone" },
  { type: "deadline", label: "Deadline" },
  { type: "event", label: "Event" },
  { type: "meeting", label: "Meeting" },
];

export const CALENDAR_TYPE_FILTERS = [
  { id: "all", label: "All" },
  { id: "milestone", label: "Milestones" },
  { id: "deadline", label: "Deadlines" },
  { id: "event", label: "Events" },
  { id: "meeting", label: "Meetings" },
];

/** @typedef {"milestone" | "deadline" | "event" | "meeting"} CalendarEventType */

/**
 * @typedef {{
 *   id: string;
 *   date: string;
 *   type: CalendarEventType;
 *   title: string;
 *   time: string;
 *   project: string;
 *   projectColor: string;
 *   description?: string;
 *   tags?: string[];
 *   projectId?: string;
 *   preTask?: string;
 * }} CalendarEvent
 */

/** @type {CalendarEvent[]} */
export const CALENDAR_EVENTS = [
  {
    id: "e1",
    date: "2026-05-03",
    type: "meeting",
    title: "Sprint planning — CRM",
    time: "9:00 AM",
    project: "CRM System",
    projectColor: "#6366f1",
  },
  {
    id: "e2",
    date: "2026-05-07",
    type: "deadline",
    title: "Finance API integration cutoff",
    time: "5:00 PM",
    project: "Finance Integration",
    projectColor: "#06b6d4",
  },
  {
    id: "e3",
    date: "2026-05-12",
    type: "milestone",
    title: "Analytics phase 1 review",
    time: "11:00 AM",
    project: "Analytics Dashboard",
    projectColor: "#10b981",
  },
  {
    id: "e4",
    date: "2026-05-12",
    type: "event",
    title: "Design system workshop",
    time: "2:00 PM",
    project: "CRM System",
    projectColor: "#6366f1",
  },
  {
    id: "e5",
    date: "2026-05-15",
    type: "meeting",
    title: "Mobile app UX walkthrough",
    time: "10:30 AM",
    project: "Mobile App",
    projectColor: "#f59e0b",
  },
  {
    id: "e6",
    date: "2026-05-18",
    type: "deadline",
    title: "Inventory sync go-live",
    time: "End of day",
    project: "Inventory Management",
    projectColor: "#3b82f6",
  },
  {
    id: "e7",
    date: "2026-05-18",
    type: "milestone",
    title: "Lead automation beta launch",
    time: "12:00 PM",
    project: "Lead Automation",
    projectColor: "#8b5cf6",
  },
  {
    id: "e8",
    date: "2026-05-22",
    type: "event",
    title: "Portfolio stakeholder demo",
    time: "3:00 PM",
    project: "Analytics Dashboard",
    projectColor: "#10b981",
  },
  {
    id: "e9",
    date: "2026-05-24",
    type: "milestone",
    title: "CRM phase 2 feature freeze",
    time: "6:00 PM",
    project: "CRM System",
    projectColor: "#6366f1",
  },
  {
    id: "e10",
    date: "2026-05-26",
    type: "meeting",
    title: "Weekly roadmap sync",
    time: "9:30 AM",
    project: "Over Drive OS",
    projectColor: "#6366f1",
  },
  {
    id: "e11",
    date: "2026-05-26",
    type: "event",
    title: "Q2 planning session",
    time: "1:00 PM",
    project: "Finance Integration",
    projectColor: "#06b6d4",
  },
  {
    id: "e12",
    date: "2026-05-28",
    type: "deadline",
    title: "Mobile onboarding QA sign-off",
    time: "4:00 PM",
    project: "Mobile App",
    projectColor: "#f59e0b",
  },
  {
    id: "e13",
    date: "2026-06-02",
    type: "meeting",
    title: "Cross-team retro",
    time: "10:00 AM",
    project: "Lead Automation",
    projectColor: "#8b5cf6",
  },
  {
    id: "e14",
    date: "2026-06-05",
    type: "milestone",
    title: "Analytics dashboard public beta",
    time: "9:00 AM",
    project: "Analytics Dashboard",
    projectColor: "#10b981",
  },
];

export function parseEventDate(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return { year, month: month - 1, day };
}

export function eventInMonth(event, year, month) {
  const { year: y, month: m } = parseEventDate(event.date);
  return y === year && m === month;
}

export function getEventsForDay(events, year, month, day) {
  return events.filter((event) => {
    const parsed = parseEventDate(event.date);
    return parsed.year === year && parsed.month === month && parsed.day === day;
  });
}

export function groupEventsByDay(events, year, month) {
  const map = new Map();
  for (const event of events) {
    if (!eventInMonth(event, year, month)) continue;
    const { day } = parseEventDate(event.date);
    if (!map.has(day)) map.set(day, []);
    map.get(day).push(event);
  }
  return map;
}

export function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

export function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

export function formatCalendarDate(year, month, day) {
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

export function createCalendarEvent(fields) {
  return {
    id: `e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    date: fields.date,
    type: fields.type ?? "event",
    title: fields.title?.trim() || "Untitled event",
    time: fields.time?.trim() || "9:00 AM",
    project: fields.project?.trim() ?? "",
    projectColor: fields.projectColor ?? "#6366f1",
    description: fields.description?.trim() ?? "",
    tags: Array.isArray(fields.tags) ? fields.tags.filter(Boolean) : [],
    projectId: fields.projectId ?? null,
    preTask: fields.preTask?.trim() ?? "",
  };
}

export function mergeCalendarEvent(existing, fields) {
  return {
    ...existing,
    date: fields.date ?? existing.date,
    type: fields.type ?? existing.type,
    title: fields.title?.trim() || existing.title,
    time: fields.time?.trim() || existing.time,
    project: fields.project?.trim() ?? existing.project ?? "",
    projectColor: fields.projectColor ?? existing.projectColor,
    description: fields.description?.trim() ?? existing.description ?? "",
    tags: Array.isArray(fields.tags) ? fields.tags.filter(Boolean) : existing.tags ?? [],
    projectId: fields.projectId !== undefined ? fields.projectId : existing.projectId,
    preTask:
      fields.preTask !== undefined ? fields.preTask.trim() : (existing.preTask ?? ""),
  };
}

export function getEventStageColor(event) {
  return event.projectColor || EVENT_TYPE_COLORS[event.type] || "#6366f1";
}

export function getCalendarProjectOptions(events = CALENDAR_EVENTS) {
  const seen = new Map();
  for (const event of events) {
    if (!seen.has(event.project)) {
      seen.set(event.project, event.projectColor);
    }
  }
  if (!seen.has("Over Drive OS")) {
    seen.set("Over Drive OS", "#6366f1");
  }
  return Array.from(seen.entries()).map(([name, color]) => ({ name, color }));
}
