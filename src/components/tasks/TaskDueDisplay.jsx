import { CalendarDays, Clock } from "lucide-react";
import { getTaskDueParts } from "../../data/tasksData";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default function TaskDueDisplay({ task, className, compact = false }) {
  const { date, time, full } = getTaskDueParts(task);

  if (!full) {
    return (
      <span className={cn("text-xs text-slate-400", className)} aria-label="No due date">
        —
      </span>
    );
  }

  if (compact) {
    return (
      <span className={cn("whitespace-nowrap text-[11px] text-slate-600", className)} title={full}>
        {full}
      </span>
    );
  }

  return (
    <div
      className={cn(
        "flex min-w-[12.5rem] shrink-0 items-center gap-2.5 whitespace-nowrap",
        className
      )}
      title={full}
    >
      <span className="flex items-center gap-1.5 text-xs font-medium leading-none text-slate-700">
        <CalendarDays className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
        {date}
      </span>
      {time ? (
        <span className="flex items-center gap-1 text-[11px] leading-none text-slate-500">
          <Clock className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
          {time}
        </span>
      ) : null}
    </div>
  );
}
