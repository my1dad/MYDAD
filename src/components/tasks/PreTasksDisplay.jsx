import { ListTodo } from "lucide-react";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default function PreTasksDisplay({
  items = [],
  variant = "default",
  embedded = false,
  className,
}) {
  if (!items.length) return null;

  const isCompact = variant === "compact";

  const list = (
    <ol className={cn("divide-y divide-slate-100", embedded && "border-t border-slate-100")}>
      {items.map((item, index) => (
        <li
          key={`${item}-${index}`}
          className={cn(
            "flex items-start gap-3",
            embedded ? "px-5 py-3" : isCompact ? "px-4 py-2.5" : "px-5 py-3.5",
            index % 2 === 0 ? "bg-white" : "bg-slate-50/90"
          )}
        >
          <span
            className={cn(
              "mt-0.5 flex shrink-0 items-center justify-center rounded-full bg-violet-100 font-bold text-violet-700 ring-1 ring-violet-200/80",
              embedded || !isCompact ? "h-6 w-6 text-[11px]" : "h-5 w-5 text-[10px]"
            )}
          >
            {index + 1}
          </span>
          <p
            className={cn(
              "min-w-0 flex-1 font-medium leading-snug text-slate-800",
              embedded || !isCompact ? "text-sm" : "text-xs"
            )}
          >
            {item}
          </p>
        </li>
      ))}
    </ol>
  );

  if (embedded) {
    return (
      <div className={className}>
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-5 py-3">
          <ListTodo className="h-3.5 w-3.5 shrink-0 text-violet-600" />
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Pre-Tasks
            <span className="ml-1.5 font-semibold text-violet-700">({items.length})</span>
          </p>
        </div>
        {list}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-slate-200/90 bg-white",
        className
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-5",
          isCompact ? "py-2.5" : "py-3"
        )}
      >
        <ListTodo className="h-3.5 w-3.5 shrink-0 text-violet-600" />
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
          Pre-Tasks
          <span className="ml-1.5 font-semibold text-violet-700">({items.length})</span>
        </p>
      </div>
      {list}
    </div>
  );
}
