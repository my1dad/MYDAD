import { useEffect, useMemo, useState } from "react";
import {
  Check,
  CheckSquare,
  Circle,
  Clock,
  ListTodo,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Trash2,
  User,
} from "lucide-react";
import { PRIORITY_BADGE_STYLES, TASK_STATUS_FILTERS } from "../../data/tasksData";
import { useTasks } from "../../context/TasksContext";
import RoadmapProgressBar from "../roadmap/RoadmapProgressBar";
import AddTaskModal from "./AddTaskModal";
import TaskDetailModal from "./TaskDetailModal";
import TaskDreamboardIcon from "./TaskDreamboardIcon";
import TaskDueDisplay from "./TaskDueDisplay";

const CURRENT_USER_NAME = "Enis";

/** Shared desktop table layout — due date column reserved for full date + time */
const TASK_TABLE_GRID =
  "md:grid-cols-[36px_minmax(0,1.65fr)_minmax(0,1fr)_minmax(13rem,1.65fr)_minmax(5.5rem,0.85fr)_minmax(5rem,0.75fr)_48px_92px]";

const STATUS_LABEL_STYLES = {
  Done: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "In progress": "bg-violet-50 text-violet-700 ring-violet-200",
  "To do": "bg-slate-100 text-slate-600 ring-slate-200",
};

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function TaskStatCard({ icon: Icon, label, value, subtitle, accent }) {
  const accents = {
    slate: "bg-slate-500/10 text-slate-700 ring-slate-500/15",
    indigo: "bg-indigo-500/10 text-indigo-700 ring-indigo-500/15",
    amber: "bg-amber-500/10 text-amber-700 ring-amber-500/15",
    emerald: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/15",
  };

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div
        className={cn(
          "mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg ring-1",
          accents[accent] ?? accents.slate
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-2xl font-bold tabular-nums text-slate-900">{value}</p>
      <p className="mt-0.5 text-xs font-semibold text-slate-700">{label}</p>
      <p className="mt-1 text-[11px] text-slate-500">{subtitle}</p>
    </div>
  );
}

function AssigneeAvatar({ assignee }) {
  if (assignee.avatarUrl) {
    return (
      <img
        src={assignee.avatarUrl}
        alt={assignee.name}
        title={assignee.name}
        className="h-8 w-8 shrink-0 rounded-full object-cover ring-2 ring-white"
      />
    );
  }

  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
      style={{ backgroundColor: assignee.color }}
      title={assignee.name}
    >
      {assignee.initials}
    </div>
  );
}

function TaskHeatProgressBar({ stats }) {
  const completion = stats.total === 0 ? 0 : Math.round((stats.done / stats.total) * 100);

  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="px-4 py-4 sm:px-5">
        <div className="mb-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Task completion
          </p>
          <p className="mt-0.5 text-sm font-semibold text-slate-800">
            {stats.done} of {stats.total} tasks complete
          </p>
        </div>
        <RoadmapProgressBar
          progress={completion}
          color="#7c3aed"
          variant="heatmap"
          heightClass="h-10"
          showBadge
          className="w-full"
        />
      </div>
    </div>
  );
}

export default function TasksPage({
  projects = [],
  openAddOnMount = false,
  onAddMountHandled,
}) {
  const { tasks, addTask, updateTask, deleteTask } = useTasks();
  const [addOpen, setAddOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [detailTask, setDetailTask] = useState(null);

  useEffect(() => {
    if (!openAddOnMount) return;
    setAddOpen(true);
    onAddMountHandled?.();
  }, [openAddOnMount, onAddMountHandled]);
  const [filter, setFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [completedIds, setCompletedIds] = useState(
    () => new Set(tasks.filter((t) => t.completed).map((t) => t.id))
  );

  const projectNames = useMemo(
    () => [...new Set(tasks.map((t) => t.project).filter(Boolean))].sort(),
    [tasks]
  );

  const stats = useMemo(() => {
    const open = tasks.filter((t) => !completedIds.has(t.id));
    return {
      total: tasks.length,
      todo: open.filter((t) => t.status === "todo").length,
      inProgress: open.filter((t) => t.status === "in_progress").length,
      done: completedIds.size,
      mine: tasks.filter((t) => t.assignee.name === CURRENT_USER_NAME).length,
    };
  }, [tasks, completedIds]);

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();

    return tasks.filter((task) => {
      const isDone = completedIds.has(task.id);

      if (projectFilter !== "all" && task.project !== projectFilter) return false;

      if (query) {
        const haystack = `${task.title} ${task.project} ${task.assignee.name}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      if (filter === "all") return true;
      if (filter === "mine") return task.assignee.name === CURRENT_USER_NAME;
      if (filter === "done") return isDone;
      if (filter === "todo") return !isDone && task.status === "todo";
      if (filter === "in_progress") return !isDone && task.status === "in_progress";
      return true;
    });
  }, [tasks, filter, projectFilter, search, completedIds]);

  const detailTaskLive = useMemo(
    () => (detailTask ? tasks.find((t) => t.id === detailTask.id) ?? detailTask : null),
    [tasks, detailTask]
  );

  const toggleTask = (id, e) => {
    e?.stopPropagation();
    setCompletedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteTask = (task) => {
    deleteTask(task.id);
    setCompletedIds((prev) => {
      const next = new Set(prev);
      next.delete(task.id);
      return next;
    });
    if (detailTask?.id === task.id) setDetailTask(null);
  };

  const handleEditTask = (task) => {
    setAddOpen(false);
    setEditingTask(task);
  };

  return (
    <div className="mx-auto max-w-[1600px]">
      <AddTaskModal
        open={addOpen && !editingTask}
        onClose={() => {
          setAddOpen(false);
          setEditingTask(null);
        }}
        onSubmit={addTask}
        projects={projects}
      />

      <AddTaskModal
        open={Boolean(editingTask)}
        mode="edit"
        editingTask={editingTask}
        onClose={() => {
          setEditingTask(null);
          setAddOpen(false);
        }}
        onSubmit={(fields) => {
          if (editingTask) updateTask(editingTask.id, fields);
          setEditingTask(null);
          setAddOpen(false);
        }}
        projects={projects}
      />

      <TaskDetailModal
        task={detailTaskLive}
        open={Boolean(detailTaskLive)}
        isDone={detailTaskLive ? completedIds.has(detailTaskLive.id) : false}
        onClose={() => setDetailTask(null)}
        onEdit={handleEditTask}
        onDelete={handleDeleteTask}
        onAttachmentsChange={(attachments) => {
          if (!detailTaskLive) return;
          const updated = updateTask(detailTaskLive.id, { attachments });
          if (updated) setDetailTask(updated);
        }}
      />

      <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-violet-50/40 p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-xl bg-violet-500/10 px-4 py-2 text-base font-bold text-violet-700 ring-1 ring-violet-500/15">
              <CheckSquare className="h-5 w-5" />
              Tasks
            </div>
            <p className="max-w-xl text-sm font-semibold text-slate-600">
              Track work across projects — filter by status, project, or search.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/20 transition hover:bg-violet-700"
          >
            <Plus className="h-4 w-4" />
            Add Task
          </button>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TaskStatCard
          icon={ListTodo}
          label="Total tasks"
          value={stats.total}
          subtitle={`${stats.mine} assigned to you`}
          accent="slate"
        />
        <TaskStatCard
          icon={Circle}
          label="To do"
          value={stats.todo}
          subtitle="Not started yet"
          accent="indigo"
        />
        <TaskStatCard
          icon={Clock}
          label="In progress"
          value={stats.inProgress}
          subtitle="Active work right now"
          accent="amber"
        />
        <TaskStatCard
          icon={Check}
          label="Completed"
          value={stats.done}
          subtitle="Marked done on this page"
          accent="emerald"
        />
      </div>

      <TaskHeatProgressBar stats={stats} />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative min-w-0 flex-1 lg:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks, projects, assignees…"
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-violet-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="tasks-project-filter">
                Filter by project
              </label>
              <select
                id="tasks-project-filter"
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              >
                <option value="all">All projects</option>
                {projectNames.map((project) => (
                  <option key={project} value={project}>
                    {project}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-1 border-b border-slate-100 pb-0">
            {TASK_STATUS_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cn(
                  "border-b-2 px-3 py-2 text-xs font-medium transition",
                  filter === f.id
                    ? "border-violet-600 text-violet-600"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <CheckSquare className="mb-3 h-10 w-10 text-slate-300" />
            <p className="text-sm font-semibold text-slate-700">No tasks match your filters</p>
            <p className="mt-1 max-w-sm text-xs text-slate-500">
              Try a different status, project, or search term.
            </p>
          </div>
        ) : (
          <>
            <div
              className={cn(
                "hidden items-center gap-5 border-b border-slate-100 bg-slate-50/80 px-5 py-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400 md:grid",
                TASK_TABLE_GRID
              )}
            >
              <span />
              <span>Task</span>
              <span>Project</span>
              <span>Due date</span>
              <span>Status</span>
              <span>Priority</span>
              <span className="text-center">
                <User className="mx-auto h-3.5 w-3.5" />
              </span>
              <span />
            </div>

            <ul className="divide-y divide-slate-100">
              {filteredTasks.map((task) => {
                const isDone = completedIds.has(task.id);
                const statusLabel = isDone
                  ? "Done"
                  : task.status === "in_progress"
                    ? "In progress"
                    : "To do";

                return (
                  <li
                    key={task.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setDetailTask(task)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setDetailTask(task);
                      }
                    }}
                    className={cn(
                      "group grid cursor-pointer grid-cols-[36px_1fr] items-center gap-3 px-4 py-4 transition hover:bg-slate-50/80 sm:px-5 md:gap-5 md:py-3.5",
                      TASK_TABLE_GRID,
                      isDone && "opacity-75"
                    )}
                  >
                    <button
                      type="button"
                      onClick={(e) => toggleTask(task.id, e)}
                      aria-label={isDone ? "Mark incomplete" : "Mark complete"}
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition",
                        isDone
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : "border-slate-300 hover:border-violet-400"
                      )}
                    >
                      {isDone && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                    </button>

                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <p
                          className={cn(
                            "min-w-0 truncate text-sm font-medium text-slate-900",
                            isDone && "line-through text-slate-500"
                          )}
                        >
                          {task.title}
                        </p>
                        <TaskDreamboardIcon task={task} />
                        {task.attachments?.length > 0 ? (
                          <Paperclip
                            className="h-3.5 w-3.5 shrink-0 text-violet-500"
                            title={`${task.attachments.length} attachment${task.attachments.length === 1 ? "" : "s"}`}
                            aria-label={`${task.attachments.length} attachment${task.attachments.length === 1 ? "" : "s"}`}
                          />
                        ) : null}
                      </div>
                      <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] font-medium text-slate-500 md:hidden">
                        <span>{task.project}</span>
                        <span aria-hidden>·</span>
                        <TaskDueDisplay task={task} compact />
                        <span aria-hidden>·</span>
                        <span>{statusLabel}</span>
                      </p>
                    </div>

                    <span
                      className="hidden min-w-0 truncate rounded-full px-2.5 py-0.5 text-[11px] font-medium md:inline-block"
                      style={{
                        backgroundColor: `${task.projectColor}15`,
                        color: task.projectColor,
                      }}
                    >
                      {task.project || "—"}
                    </span>

                    <div className="hidden md:block">
                      <TaskDueDisplay task={task} />
                    </div>

                    <span
                      className={cn(
                        "hidden w-fit shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold ring-1 md:inline-block",
                        STATUS_LABEL_STYLES[statusLabel] ?? STATUS_LABEL_STYLES["To do"]
                      )}
                    >
                      {statusLabel}
                    </span>

                    <span
                      className={cn(
                        "hidden w-fit shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize ring-1 md:inline-block",
                        PRIORITY_BADGE_STYLES[task.priority]
                      )}
                    >
                      {task.priority}
                    </span>

                    <div className="hidden justify-center md:flex">
                      <AssigneeAvatar assignee={task.assignee} />
                    </div>

                    <div className="hidden items-center justify-end gap-1 md:flex">
                      <button
                        type="button"
                        title="Edit task"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditTask(task);
                        }}
                        className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 opacity-70 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 group-hover:opacity-100"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Delete task"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Delete "${task.title}"?`)) handleDeleteTask(task);
                        }}
                        className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 opacity-70 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
