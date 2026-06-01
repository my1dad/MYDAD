import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, CalendarDays, CheckSquare } from "lucide-react";
import { useCalendarEvents } from "../../context/CalendarEventsContext";
import { useTasks } from "../../context/TasksContext";
import { buildDashboardAlerts } from "../../lib/dashboardAlerts";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default function DashboardAlertsButton({ onNavigate }) {
  const { tasks } = useTasks();
  const { events } = useCalendarEvents();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const alerts = useMemo(
    () => buildDashboardAlerts({ tasks, events }),
    [tasks, events]
  );

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (rootRef.current?.contains(event.target)) return;
      close();
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, close]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  const handleSelect = (item) => {
    close();
    if (item.sourceType === "task") {
      onNavigate?.("tasks");
      return;
    }
    onNavigate?.("calendar");
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Alerts and notifications"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-lg border transition",
          open
            ? "border-sky-300 bg-sky-50 text-sky-700"
            : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700"
        )}
      >
        <Bell className="h-4 w-4" />
        {alerts.length > 0 ? (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-sky-600 px-1 text-[9px] font-bold text-white ring-2 ring-white">
            {alerts.length > 9 ? "9+" : alerts.length}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-[min(calc(100vw-2rem),22rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Alerts</p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              From tasks and events with alerts enabled — not project risk flags.
            </p>
          </div>

          {alerts.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Bell className="mx-auto mb-2 h-6 w-6 text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">No alerts yet</p>
              <p className="mt-1 text-xs text-slate-500">
                Turn on &quot;Add alert&quot; when creating a task or event.
              </p>
            </div>
          ) : (
            <ul className="max-h-72 overflow-y-auto py-1">
              {alerts.map((item) => {
                const Icon = item.sourceType === "task" ? CheckSquare : CalendarDays;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(item)}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                    >
                      <div
                        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ring-black/5"
                        style={{ backgroundColor: `${item.color}18`, color: item.color }}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-700">
                            {item.badge}
                          </span>
                          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                            {item.sourceType}
                          </span>
                        </div>
                        <p className="truncate text-sm font-semibold text-slate-900">{item.title}</p>
                        <p className="truncate text-xs text-slate-500">{item.subtitle}</p>
                        <p className="mt-0.5 text-[11px] font-medium text-slate-400">{item.whenLabel}</p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
