import { useEffect, useRef } from "react";
import { Clock, Pencil, Trash2, X } from "lucide-react";
import {
  EVENT_TYPE_COLORS,
  EVENT_TYPE_LABELS,
  MONTH_NAMES,
  getEventStageColor,
  parseEventDate,
} from "../../data/calendarData";

function formatEventDateLabel(dateStr) {
  const { year, month, day } = parseEventDate(dateStr);
  return `${MONTH_NAMES[month]} ${day}, ${year}`;
}

export default function CalendarEventDetailPopover({
  event,
  anchorRect,
  open,
  onClose,
  onEdit,
  onDelete,
}) {
  const popoverRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (popoverRef.current?.contains(e.target)) return;
      onClose();
    };
    const timer = window.setTimeout(() => {
      document.addEventListener("mousedown", onPointerDown);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open, onClose]);

  if (!open || !event) return null;

  const stageColor = getEventStageColor(event);
  const popoverWidth = 288;
  const style = anchorRect
    ? {
        position: "fixed",
        top: Math.min(Math.max(8, anchorRect.top), window.innerHeight - 320),
        left: Math.max(
          8,
          Math.min(anchorRect.left - popoverWidth - 8, window.innerWidth - popoverWidth - 8)
        ),
        width: popoverWidth,
      }
    : {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: 320,
      };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/20" aria-hidden onClick={onClose} />
      <div
        ref={popoverRef}
        role="dialog"
        aria-labelledby="event-detail-title"
        className="z-50 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        style={style}
      >
        <div
          className="border-b px-4 py-3"
          style={{
            borderColor: `${stageColor}40`,
            background: `linear-gradient(to right, ${stageColor}14, white)`,
          }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white"
                  style={{ backgroundColor: stageColor }}
                />
                <span
                  className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                  style={{
                    backgroundColor: `${EVENT_TYPE_COLORS[event.type]}18`,
                    color: EVENT_TYPE_COLORS[event.type],
                  }}
                >
                  {EVENT_TYPE_LABELS[event.type]}
                </span>
              </div>
              <h3 id="event-detail-title" className="text-sm font-bold text-slate-900">
                {event.title}
              </h3>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                <Clock className="h-3 w-3" />
                {formatEventDateLabel(event.date)} · {event.time}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="max-h-[240px] space-y-3 overflow-y-auto p-4 text-sm">
          {event.description ? (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Description
              </p>
              <p className="mt-1 text-slate-700 leading-relaxed">{event.description}</p>
            </div>
          ) : (
            <p className="text-xs text-slate-400">No description</p>
          )}

          {event.project ? (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Project</p>
              <p className="mt-1 font-medium" style={{ color: stageColor }}>
                {event.project}
              </p>
            </div>
          ) : null}

          {event.preTask ? (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Pre-Task</p>
              <p className="mt-1 font-medium text-slate-700">{event.preTask}</p>
            </div>
          ) : null}

          {event.tags?.length > 0 ? (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Tags</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {event.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-200/80"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex gap-2 border-t border-slate-100 bg-slate-50/80 p-3">
          <button
            type="button"
            onClick={() => {
              onEdit(event);
              onClose();
            }}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Delete "${event.title}"?`)) {
                onDelete(event);
                onClose();
              }
            }}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      </div>
    </>
  );
}
