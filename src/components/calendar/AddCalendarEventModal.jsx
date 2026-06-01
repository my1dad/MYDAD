import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarPlus, Check, Clock, ListTodo, Pencil, Plus, X } from "lucide-react";
import {
  CALENDAR_TYPE_FILTERS,
  EVENT_TYPE_LABELS,
  MONTH_NAMES,
  getEventPreTasks,
} from "../../data/calendarData";
import { useWorkspaceSettings } from "../../context/WorkspaceSettingsContext";
import {
  PROJECT_STAGE_COLORS,
  filterActiveProjects,
  getProjectStageColor,
  getProjectTaskGroups,
} from "../../lib/projectUtils";
import { lockBodyScroll } from "../../lib/modalBodyLock";
import AlertOptionField from "../ui/AlertOptionField";
import EventTimePickerOverlay, { formatCurrentTimeLabel } from "./EventTimePickerOverlay";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

const FORM_ID = "calendar-event-form";

const inputClassName =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20";

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
  const [preTasks, setPreTasks] = useState([]);
  const [preTaskInput, setPreTaskInput] = useState("");
  const [eventDate, setEventDate] = useState(defaultDate);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [alertEnabled, setAlertEnabled] = useState(false);

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
      setPreTasks(getEventPreTasks(editingEvent));
      setPreTaskInput("");
      setEventDate(editingEvent.date ?? defaultDate);
      setAlertEnabled(Boolean(editingEvent.alertEnabled));
      setTimePickerOpen(false);
      return;
    }
    setTitle("");
    setDescription("");
    setType("event");
    setTime(formatCurrentTimeLabel());
    setProjectId("");
    setStageColor(PROJECT_STAGE_COLORS[0]);
    setSelectedTags([]);
    setPreTasks([]);
    setPreTaskInput("");
    setEventDate(defaultDate);
    setAlertEnabled(false);
    setTimePickerOpen(false);
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
    if (!open) return undefined;
    return lockBodyScroll();
  }, [open]);

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

  const addPreTask = (value) => {
    const trimmed = value?.trim();
    if (!trimmed || preTasks.includes(trimmed)) return;
    setPreTasks((prev) => [...prev, trimmed]);
    setPreTaskInput("");
  };

  const removePreTask = (index) => {
    setPreTasks((prev) => prev.filter((_, i) => i !== index));
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
      preTasks,
      alertEnabled,
    });
    onClose();
  };

  return createPortal(
    <>
      <EventTimePickerOverlay
        open={timePickerOpen}
        value={time}
        zIndexClass="z-[160]"
        onClose={() => setTimePickerOpen(false)}
        onConfirm={setTime}
      />

      <div className="fixed inset-0 z-[150] overflow-y-auto">
        <button
          type="button"
          aria-label="Close"
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm"
          onClick={() => {
            if (!timePickerOpen) onClose();
          }}
        />

        <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
          <div
            role="dialog"
            aria-labelledby="calendar-event-form-title"
            aria-modal="true"
            className="relative z-10 flex max-h-[min(calc(100vh-2rem),760px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="shrink-0 border-b border-slate-100 bg-gradient-to-r from-sky-600 to-sky-500 px-5 py-4 text-white sm:px-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-2 inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 ring-white/20">
                    {isEdit ? (
                      <Pencil className="h-3.5 w-3.5" />
                    ) : (
                      <CalendarPlus className="h-3.5 w-3.5" />
                    )}
                    {isEdit ? "Edit event" : "New event"}
                  </div>
                  <h2 id="calendar-event-form-title" className="text-lg font-bold tracking-tight">
                    {isEdit ? "Update calendar event" : "Add calendar event"}
                  </h2>
                  {dateLabel ? (
                    <p className="mt-1 text-xs font-medium text-sky-100">{dateLabel}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="shrink-0 rounded-lg p-1.5 text-sky-100 transition hover:bg-white/15 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <form
              id={FORM_ID}
              onSubmit={handleSubmit}
              className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6"
            >
              {isEdit ? (
                <div className="space-y-1.5">
                  <label
                    htmlFor="event-date"
                    className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
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
                <label
                  htmlFor="event-title"
                  className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
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
                <label
                  htmlFor="event-description"
                  className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
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

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label
                    htmlFor="event-type"
                    className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
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
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Time
                  </span>
                  <button
                    type="button"
                    onClick={() => setTimePickerOpen(true)}
                    className={cn(
                      inputClassName,
                      "flex items-center justify-between gap-2 text-left font-medium tabular-nums"
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Clock className="h-4 w-4 shrink-0 text-sky-500" />
                      <span className="truncate">{time}</span>
                    </span>
                    <span className="shrink-0 text-[10px] font-semibold text-sky-600">Change</span>
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="event-project"
                  className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Project
                </label>
                <select
                  id="event-project"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className={inputClassName}
                >
                  <option value="">No project</option>
                  {projectOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Stage color
                </span>
                <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
                  {PROJECT_STAGE_COLORS.map((color) => {
                    const selected = stageColor === color;
                    return (
                      <button
                        key={color}
                        type="button"
                        aria-label="Select stage color"
                        aria-pressed={selected}
                        onClick={() => setStageColor(color)}
                        className={cn(
                          "relative aspect-square w-full rounded-lg transition",
                          "ring-1 ring-slate-200/80 hover:ring-slate-300",
                          "focus:outline-none focus:ring-2 focus:ring-sky-500/40",
                          selected && "ring-2 ring-sky-600 ring-offset-2"
                        )}
                        style={{ backgroundColor: color }}
                      >
                        {selected ? (
                          <Check
                            className="absolute inset-0 m-auto h-3.5 w-3.5 text-white drop-shadow-sm"
                            strokeWidth={3}
                          />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>

              {projectOptions.length === 0 ? (
                <p className="text-[11px] text-slate-500">
                  No projects yet — you can still save this event with a stage color.
                </p>
              ) : null}

              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <ListTodo className="h-3.5 w-3.5" />
                  Pre-Tasks
                </span>

                {preTasks.length > 0 ? (
                  <ul className="space-y-1.5">
                    {preTasks.map((item, index) => (
                      <li
                        key={`${item}-${index}`}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
                      >
                        <span className="min-w-0 flex-1 text-sm font-medium text-slate-800">
                          {item}
                        </span>
                        <button
                          type="button"
                          onClick={() => removePreTask(index)}
                          className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-50 hover:text-red-600"
                          aria-label={`Remove pre-task ${item}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[11px] text-slate-500">No pre-tasks added yet.</p>
                )}

                <div className="flex gap-2">
                  <input
                    id="event-pre-task-input"
                    type="text"
                    value={preTaskInput}
                    onChange={(e) => setPreTaskInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addPreTask(preTaskInput);
                      }
                    }}
                    placeholder="Add a pre-task for this event"
                    className={cn(inputClassName, "min-w-0 flex-1")}
                  />
                  <button
                    type="button"
                    onClick={() => addPreTask(preTaskInput)}
                    disabled={!preTaskInput.trim()}
                    className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-sky-600 px-3 py-2.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </button>
                </div>

                {projectTaskOptions.length > 0 ? (
                  <select
                    id="event-pre-task-from-project"
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) {
                        addPreTask(e.target.value);
                        e.target.value = "";
                      }
                    }}
                    className={inputClassName}
                  >
                    <option value="">Add from project tasks…</option>
                    {projectTaskOptions.map((task) => (
                      <option key={task.id} value={task.label}>
                        {task.phaseTitle}: {task.label}
                      </option>
                    ))}
                  </select>
                ) : null}

                <p className="text-[11px] text-slate-500">
                  Work that should be finished before this event.
                </p>
              </div>

              <AlertOptionField enabled={alertEnabled} onChange={setAlertEnabled} />

              <div className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Tags
                </span>
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
                              ? "bg-sky-600 text-white ring-sky-600"
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
            </form>

            <div className="flex shrink-0 gap-2 border-t border-slate-100 bg-white px-5 py-4 sm:px-6">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                form={FORM_ID}
                disabled={!title.trim()}
                className={cn(
                  "flex-1 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-600/20 transition hover:bg-sky-700",
                  !title.trim() && "cursor-not-allowed opacity-50"
                )}
              >
                {isEdit ? "Save changes" : "Add event"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

export function formatAddEventDateLabel(year, month, day) {
  return `${MONTH_NAMES[month]} ${day}, ${year}`;
}
