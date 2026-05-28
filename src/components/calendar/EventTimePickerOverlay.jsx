import { useEffect, useMemo, useState } from "react";
import { Clock, X } from "lucide-react";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

export function formatCurrentTimeLabel(date = new Date()) {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function parseTimeLabel(label) {
  const match = label.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
  if (period === "AM" && hour === 12) hour = 0;
  if (period === "PM" && hour !== 12) hour += 12;
  return { hour, minute, period };
}

function toTimeLabel(hour12, minute, period) {
  const h = Math.min(12, Math.max(1, hour12));
  const m = Math.min(59, Math.max(0, minute));
  return `${h}:${String(m).padStart(2, "0")} ${period}`;
}

function fromDate(date) {
  const hours = date.getHours();
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return { hour12, minute: date.getMinutes(), period };
}

export default function EventTimePickerOverlay({
  open,
  value,
  onClose,
  onConfirm,
  zIndexClass = "z-[60]",
}) {
  const initial = useMemo(() => {
    const parsed = parseTimeLabel(value);
    if (parsed) {
      const hour12 = parsed.period === "AM" ? (parsed.hour === 0 ? 12 : parsed.hour) : parsed.hour === 12 ? 12 : parsed.hour - 12;
      return { hour12, minute: parsed.minute, period: parsed.period };
    }
    return fromDate(new Date());
  }, [value, open]);

  const [hour12, setHour12] = useState(initial.hour12);
  const [minute, setMinute] = useState(initial.minute);
  const [period, setPeriod] = useState(initial.period);

  useEffect(() => {
    if (!open) return;
    setHour12(initial.hour12);
    setMinute(initial.minute);
    setPeriod(initial.period);
  }, [open, initial]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5);

  const handleConfirm = () => {
    onConfirm(toTimeLabel(hour12, minute, period));
    onClose();
  };

  const handleNow = () => {
    const now = fromDate(new Date());
    setHour12(now.hour12);
    setMinute(now.minute);
    setPeriod(now.period);
  };

  return (
    <div className={cn("fixed inset-0 flex items-center justify-center p-4", zIndexClass)}>
      <button
        type="button"
        aria-label="Close time picker"
        className="absolute inset-0 bg-slate-900/35 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-labelledby="event-time-picker-title"
        className="relative z-10 w-full max-w-xs overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-sky-600" />
            <h3 id="event-time-picker-title" className="text-sm font-semibold text-slate-900">
              Set time
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 p-4">
          <p className="text-center text-lg font-bold tabular-nums text-slate-900">
            {toTimeLabel(hour12, minute, period)}
          </p>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Hour</p>
              <div className="max-h-32 overflow-y-auto rounded-lg border border-slate-200">
                {hours.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setHour12(h)}
                    className={cn(
                      "block w-full px-2 py-1.5 text-sm font-medium tabular-nums",
                      hour12 === h ? "bg-sky-600 text-white" : "text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Min</p>
              <div className="max-h-32 overflow-y-auto rounded-lg border border-slate-200">
                {minutes.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMinute(m)}
                    className={cn(
                      "block w-full px-2 py-1.5 text-sm font-medium tabular-nums",
                      minute === m ? "bg-sky-600 text-white" : "text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    {String(m).padStart(2, "0")}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">AM/PM</p>
              <div className="rounded-lg border border-slate-200">
                {["AM", "PM"].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPeriod(p)}
                    className={cn(
                      "block w-full px-2 py-2 text-sm font-semibold",
                      period === p ? "bg-sky-600 text-white" : "text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleNow}
              className="flex-1 rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Use now
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="flex-1 rounded-lg bg-sky-600 py-2 text-xs font-semibold text-white hover:bg-sky-700"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
