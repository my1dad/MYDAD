import { useEffect, useMemo, useState } from "react";
import { CalendarPlus, ChevronDown, Clock, Pencil, X } from "lucide-react";
import {
  CALENDAR_TYPE_FILTERS,
  EVENT_TYPE_LABELS,
  MONTH_NAMES,
} from "../../data/calendarData";
import { useWorkspaceSettings } from "../../context/WorkspaceSettingsContext";
import {
  PROJECT_STAGE_COLORS,
  filterActiveProjects,
  getProjectStageColor,
  getProjectTaskGroups,
} from "../../lib/projectUtils";
import EventTimePickerOverlay, { formatCurrentTimeLabel } from "./EventTimePickerOverlay";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

const inputClassName =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-500/20";

export default function AddCalendarEventModal({
  open,
  mode = "add",
  editingEvent = null,
  dateLabel,
  defaultDate,
  projects = [],
  onClose,
  onSubmit,
}) {
  const isEdit = mode === "edit";
  const { eventTags } = useWorkspaceSettings();
  const projectOptions = useMemo(
    () =>
      filterActiveProjects(projects).map((p) => ({
        id: p.id,
        name: p.projectName,
        color: getProjectStageColor(p),
      })),
    [projects]
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("event");
  const [time, setTime] = useState(() => formatCurrentTimeLabel());
  const [projectId, setProjectId] = useState("");
  const [stageColor, setStageColor] = useState(PROJECT_STAGE_COLORS[0]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [preTask, setPreTask] = useState("");
  const [eventDate, setEventDate] = useState(defaultDate);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [colorMenuOpen, setColorMenuOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (isEdit && editingEvent) {
      setTitle(editingEvent.title ?? "");
      setDescription(editingEvent.description ?? "");
      setType(editingEvent.type ?? "event");
      setTime(editingEvent.time ?? formatCurrentTimeLabel());
      setProjectId(editingEvent.projectId ?? "");
      setStageColor(editingEvent.projectColor ?? PROJECT_STAGE_COLORS[0]);
      setSelectedTags(editingEvent.tags ?? []);
      setPreTask(editingEvent.preTask ?? "");
      setEventDate(editingEvent.date ?? defaultDate);
      setTimePickerOpen(false);
      setColorMenuOpen(false);
      return;
    }
    setTitle("");
    setDescription("");
    setType("event");
    setTime(formatCurrentTimeLabel());
    setProjectId("");
    setStageColor(PROJECT_STAGE_COLORS[0]);
    setSelectedTags([]);
    setPreTask("");
    setEventDate(defaultDate);
    setTimePickerOpen(false);
    setColorMenuOpen(false);
  }, [open, defaultDate, isEdit, editingEvent]);

  useEffect(() => {
    if (!open || !isEdit || !editingEvent?.project || editingEvent.projectId) return;
    const match = projectOptions.find((p) => p.name === editingEvent.project);
    if (match) setProjectId(match.id);
  }, [open, isEdit, editingEvent, projectOptions]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !timePickerOpen) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, timePickerOpen]);

  useEffect(() => {
    if (!projectId) return;
    const project = projectOptions.find((p) => p.id === projectId);
    if (project) setStageColor(project.color);
  }, [projectId, projectOptions]);

  const selectedProjectRecord = useMemo(
    () => projects.find((p) => p.id === projectId),
    [projects, projectId]
  );

  const projectTaskOptions = useMemo(() => {
    if (!selectedProjectRecord) return [];
    return getProjectTaskGroups(selectedProjectRecord).flatMap((group) =>
      (group.tasks ?? [])
        .filter((task) => !task.completed)
        .map((task) => ({
          id: task.id,
          label: task.title || "Untitled task",
          phaseTitle: group.title,
        }))
    );
  }, [selectedProjectRecord]);

  if (!open) return null;

  const selectedProject = projectOptions.find((p) => p.id === projectId);

  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!title.trim()) return;
    onSubmit({
      date: isEdit ? eventDate : defaultDate,
      type,
      title: title.trim(),
      description: description.trim(),
      time: time.trim() || formatCurrentTimeLabel(),
      project: selectedProject?.name ?? "",
      projectId: projectId || null,
      projectColor: stageColor,
      tags: selectedTags,
      preTask: preTask.trim(),
    });
    onClose();
  };

  return (
    <>
      <EventTimePickerOverlay
        open={timePickerOpen}
        value={time}
        onClose={() => setTimePickerOpen(false)}
        onConfirm={setTime}
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
        <button
          type="button"
          aria-label="Close"
          className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm"
          onClick={onClose}
        />
        <div
          role="dialog"
          aria-labelledby="calendar-event-form-title"
          className="relative z-10 flex max-h-[min(92vh,720px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        >
          <div className="shrink-0 border-b border-slate-100 bg-gradient-to-r from-sky-50 to-white px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <div
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wide ring-1",
                      isEdit
                        ? "bg-violet-100 text-violet-800 ring-violet-200/80"
                        : "bg-sky-100 text-sky-800 ring-sky-200/80"
                    )}
                  >
                    {isEdit ? (
                      <Pencil className="h-3.5 w-3.5" />
                    ) : (
                      <CalendarPlus className="h-3.5 w-3.5" />
                    )}
                    {isEdit ? "Edit event" : "New event"}
                  </div>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setColorMenuOpen((v) => !v)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
                    >
                      <span
                        className="h-3 w-3 shrink-0 rounded-full ring-1 ring-slate-200/80"
                        style={{ backgroundColor: stageColor }}
                      />
                      Stage color
                      <ChevronDown
                        className={cn("h-3 w-3 text-slate-400 transition", colorMenuOpen && "rotate-180")}
                      />
                    </button>
                    {colorMenuOpen && (
                      <div className="absolute left-0 top-full z-20 mt-1 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
                        <div className="grid grid-cols-5 gap-1.5">
                          {PROJECT_STAGE_COLORS.map((color) => (
                            <button
                              key={color}
                              type="button"
                              title="Stage color"
                              onClick={() => {
                                setStageColor(color);
                                setColorMenuOpen(false);
                              }}
                              className={cn(
                                "h-6 w-6 rounded-full ring-2 ring-offset-1 transition",
                                stageColor === color ? "ring-slate-400" : "ring-transparent hover:ring-slate-200"
                              )}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <h2 id="calendar-event-form-title" className="text-lg font-bold text-slate-900">
                  {isEdit ? "Edit event" : "Add event"}
                </h2>
                <p className="mt-1 text-xs text-slate-600">{dateLabel}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
            {isEdit ? (
              <div className="space-y-1.5">
                <label htmlFor="event-date" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Date
                </label>
                <input
                  id="event-date"
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className={inputClassName}
                  required
                />
              </div>
            ) : null}

            <div className="space-y-1.5">
              <label htmlFor="event-title" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Title
              </label>
              <input
                id="event-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Sprint review, deadline, etc."
                className={inputClassName}
                autoFocus
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="event-description" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Description
              </label>
              <textarea
                id="event-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Notes, agenda, or context for this event…"
                rows={3}
                className={cn(inputClassName, "resize-none")}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="event-type" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Type
                </label>
                <select
                  id="event-type"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className={inputClassName}
                >
                  {CALENDAR_TYPE_FILTERS.filter((f) => f.id !== "all").map((f) => (
                    <option key={f.id} value={f.id}>
                      {EVENT_TYPE_LABELS[f.id] ?? f.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Time</span>
                <button
                  type="button"
                  onClick={() => setTimePickerOpen(true)}
                  className={cn(
                    inputClassName,
                    "flex items-center justify-between gap-2 text-left font-medium tabular-nums"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-sky-500" />
                    {time}
                  </span>
                  <span className="text-[10px] font-semibold text-sky-600">Change</span>
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="event-project" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Project
              </label>
              <select
                id="event-project"
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  setPreTask("");
                }}
                className={inputClassName}
              >
                <option value="">Select -</option>
                {projectOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name}
                  </option>
                ))}
              </select>
              {projectOptions.length === 0 && (
                <p className="text-[11px] text-slate-500">
                  No projects yet — you can still save this event with a stage color.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="event-pre-task" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Pre-Task
              </label>
              {projectTaskOptions.length > 0 ? (
                <select
                  id="event-pre-task"
                  value={preTask}
                  onChange={(e) => setPreTask(e.target.value)}
                  className={inputClassName}
                >
                  <option value="">Select -</option>
                  {projectTaskOptions.map((task) => (
                    <option key={task.id} value={task.label}>
                      {task.phaseTitle}: {task.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="event-pre-task"
                  type="text"
                  value={preTask}
                  onChange={(e) => setPreTask(e.target.value)}
                  placeholder={
                    projectId
                      ? "No open tasks in this project — enter a pre-task manually"
                      : "Task to complete before this event"
                  }
                  className={inputClassName}
                />
              )}
              <p className="text-[11px] text-slate-500">
                Work that should be finished before this event.
              </p>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tags</span>
              {eventTags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {eventTags.map((tag) => {
                    const active = selectedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset transition",
                          active
                            ? "bg-indigo-600 text-white ring-indigo-600"
                            : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
                        )}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500">
                  Add tags in Settings → Event tags to use them here.
                </p>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className={cn(
                  "flex-1 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-600/20 transition hover:bg-sky-700",
                  !title.trim() && "cursor-not-allowed opacity-50"
                )}
                disabled={!title.trim()}
              >
                {isEdit ? "Save changes" : "Add event"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

export function formatAddEventDateLabel(year, month, day) {
  return `${MONTH_NAMES[month]} ${day}, ${year}`;
}
