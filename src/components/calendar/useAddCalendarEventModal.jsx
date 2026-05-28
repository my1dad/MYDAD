import { useCallback, useState } from "react";
import { formatCalendarDate } from "../../data/calendarData";
import AddCalendarEventModal, { formatAddEventDateLabel } from "./AddCalendarEventModal";

export function useAddCalendarEventModal({ events, addEvent, onDaySelected, projects = [] }) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(null);

  const openForDay = useCallback(
    (day, year, month) => {
      onDaySelected?.(day);
      setTarget({ year, month, day });
      setOpen(true);
    },
    [onDaySelected]
  );

  const close = useCallback(() => setOpen(false), []);

  const defaultDate = target ? formatCalendarDate(target.year, target.month, target.day) : "";
  const dateLabel = target
    ? formatAddEventDateLabel(target.year, target.month, target.day)
    : "";

  const modal = (
    <AddCalendarEventModal
      open={open}
      dateLabel={dateLabel}
      defaultDate={defaultDate}
      projects={projects}
      onClose={close}
      onSubmit={addEvent}
    />
  );

  return { openForDay, modal };
}
