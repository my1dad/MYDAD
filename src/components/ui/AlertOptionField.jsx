import { Bell } from "lucide-react";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default function AlertOptionField({
  enabled,
  onChange,
  className,
  compact = false,
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-xl border transition",
        enabled
          ? "border-sky-200 bg-sky-50/80 ring-1 ring-sky-100"
          : "border-slate-200 bg-white hover:border-slate-300",
        compact ? "px-3 py-2.5" : "px-4 py-3",
        className
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg",
          compact ? "h-8 w-8" : "h-9 w-9",
          enabled ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-500"
        )}
      >
        <Bell className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn("font-semibold text-slate-900", compact ? "text-xs" : "text-sm")}>
          Add alert
        </p>
        <p className={cn("mt-0.5 text-slate-500", compact ? "text-[10px]" : "text-xs")}>
          Shows in dashboard notifications. This is an alert, not a project risk flag.
        </p>
      </div>
      <input
        type="checkbox"
        checked={Boolean(enabled)}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-sky-600 focus:ring-sky-500/30"
      />
    </label>
  );
}
