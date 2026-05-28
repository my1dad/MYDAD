import { StickyNote } from "lucide-react";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default function TaskDreamboardIcon({ task, className }) {
  if (!task?.dreamboardNoteId) return null;

  return (
    <StickyNote
      className={cn("h-3.5 w-3.5 shrink-0 text-amber-500", className)}
      title="From Dreamboard sticky note"
      aria-label="From Dreamboard sticky note"
    />
  );
}
