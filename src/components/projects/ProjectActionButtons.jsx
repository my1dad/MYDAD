import { Pencil, Trash2 } from "lucide-react";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default function ProjectActionButtons({ onEdit, onDelete, size = "md", className }) {
  const iconClass = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const buttonClass =
    size === "sm"
      ? "flex h-7 w-7 items-center justify-center rounded-lg border border-transparent"
      : "flex h-8 w-8 items-center justify-center rounded-lg border border-transparent";

  return (
    <div
      className={cn("inline-flex items-center gap-0.5 rounded-lg bg-white/90 p-0.5 shadow-sm ring-1 ring-slate-200/80 backdrop-blur-sm", className)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={onEdit}
        aria-label="Edit project"
        title="Edit project"
        className={cn(
          buttonClass,
          "text-slate-500 transition hover:border-indigo-100 hover:bg-indigo-50 hover:text-indigo-600"
        )}
      >
        <Pencil className={iconClass} />
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete project"
        title="Delete project"
        className={cn(
          buttonClass,
          "text-slate-500 transition hover:border-red-100 hover:bg-red-50 hover:text-red-600"
        )}
      >
        <Trash2 className={iconClass} />
      </button>
    </div>
  );
}
