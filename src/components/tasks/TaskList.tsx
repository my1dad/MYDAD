import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { tasks, type TaskStatus } from "@/data/mockData";
import { cn } from "@/lib/utils";

type Filter = "all" | TaskStatus;

const filters: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "todo", label: "To Do" },
  { id: "in_progress", label: "In Progress" },
  { id: "done", label: "Done" },
];

const priorityVariant = {
  low: "neutral" as const,
  medium: "warning" as const,
  high: "danger" as const,
};

export function TaskList() {
  const [filter, setFilter] = useState<Filter>("all");
  const [completedIds, setCompletedIds] = useState<Set<string>>(
    () => new Set(tasks.filter((t) => t.completed).map((t) => t.id))
  );

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const isDone = completedIds.has(task.id);
      if (filter === "all") return true;
      if (filter === "done") return isDone;
      if (filter === "todo") return !isDone && task.status === "todo";
      if (filter === "in_progress")
        return !isDone && task.status === "in_progress";
      return true;
    });
  }, [filter, completedIds]);

  const toggleTask = (id: string) => {
    setCompletedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Card title="Tasks" className="flex flex-col">
      <div className="mb-4 flex flex-wrap gap-1 rounded-xl bg-slate-100/80 p-1">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition",
              filter === f.id
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <ul className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
        {filteredTasks.map((task) => {
          const isDone = completedIds.has(task.id);
          return (
            <li
              key={task.id}
              className={cn(
                "flex items-center gap-3 rounded-xl border border-slate-100 p-3 transition hover:border-slate-200 hover:bg-slate-50/50",
                isDone && "opacity-60"
              )}
            >
              <button
                type="button"
                onClick={() => toggleTask(task.id)}
                aria-label={isDone ? "Mark incomplete" : "Mark complete"}
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition",
                  isDone
                    ? "border-violet-500 bg-violet-500 text-white"
                    : "border-slate-300 hover:border-violet-400"
                )}
              >
                {isDone && <Check className="h-3 w-3" strokeWidth={3} />}
              </button>

              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "truncate text-sm font-medium text-slate-800",
                    isDone && "line-through text-slate-500"
                  )}
                >
                  {task.title}
                </p>
                <span
                  className="mt-0.5 inline-block rounded-md px-1.5 py-0.5 text-[10px] font-medium"
                  style={{
                    backgroundColor: `${task.projectColor}18`,
                    color: task.projectColor,
                  }}
                >
                  {task.project}
                </span>
              </div>

              <span className="hidden shrink-0 text-xs text-slate-500 sm:inline">
                {task.dueDate}
              </span>

              <Badge variant={priorityVariant[task.priority]} className="hidden sm:inline-flex">
                {task.priority}
              </Badge>

              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ backgroundColor: task.assignee.color }}
                title={task.assignee.name}
              >
                {task.assignee.initials}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
