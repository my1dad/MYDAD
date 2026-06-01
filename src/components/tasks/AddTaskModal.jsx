import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  ListTodo,
  Plus,
  X,
} from "lucide-react";
import EventTimePickerOverlay, { formatCurrentTimeLabel } from "../calendar/EventTimePickerOverlay";
import AttachmentInput from "../ui/AttachmentInput";
import AlertOptionField from "../ui/AlertOptionField";
import Input from "../ui/Input";
import Select from "../ui/Select";
import Textarea from "../ui/Textarea";
import TaskAttachmentPreviewModal, {
  TaskAttachmentPreviewList,
} from "./TaskAttachmentPreview";
import PreTasksDisplay from "./PreTasksDisplay";
import { onboardingFieldVariant, onboardingShell } from "../onboarding/onboardingTheme";
import {
  PRIORITY_BADGE_STYLES,
  TASK_PRIORITY_OPTIONS,
  TASK_STATUS_OPTIONS,
  findTaskAssigneeId,
  formatTaskDueLabel,
  getTaskPreTasks,
} from "../../data/tasksData";
import { filterActiveProjects, getProjectStageColor } from "../../lib/projectUtils";
import { lockBodyScroll } from "../../lib/modalBodyLock";
import { useTeam } from "../../context/TeamContext";

const FIELD = onboardingFieldVariant;

const STEPS = [
  { id: 1, label: "Task details", icon: ListTodo },
  { id: 2, label: "Project & schedule", icon: CalendarDays },
  { id: 3, label: "Review & create", icon: CheckCircle2 },
];

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function ReviewSection({ title, children }) {
  return (
    <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
      <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-indigo-800">{title}</h4>
      {children}
    </div>
  );
}

function ReviewRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-200 py-2 last:border-0">
      <span className="text-xs font-semibold text-slate-700">{label}</span>
      <span className="max-w-[60%] text-right text-xs font-bold text-slate-950">{value || "—"}</span>
    </div>
  );
}

function TaskReviewCard({ title, priority, description, attachments, onPreviewAttachment }) {
  const priorityLabel =
    TASK_PRIORITY_OPTIONS.find((p) => p.id === priority)?.label ?? priority;

  return (
    <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
      <p className="mb-3 text-[10px] font-bold uppercase tracking-wide text-indigo-800">
        Task preview
      </p>
      <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">{title}</p>
            <span
              className={cn(
                "shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize ring-1",
                PRIORITY_BADGE_STYLES[priority]
              )}
            >
              {priorityLabel}
            </span>
          </div>
          {description ? (
            <p className="mt-1 line-clamp-2 text-xs text-slate-500">{description}</p>
          ) : null}
        </div>
        {attachments?.length > 0 ? (
          <div className="mt-4 border-t border-slate-200 pt-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Attachments ({attachments.length})
            </p>
            <TaskAttachmentPreviewList
              attachments={attachments}
              variant="zebra"
              onPreview={onPreviewAttachment}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

const initialForm = (defaultAssigneeId = "") => ({
  title: "",
  description: "",
  priority: "medium",
  status: "todo",
  projectId: "",
  dueDate: "",
  dueTime: "",
  dueTimeSelected: false,
  assigneeId: defaultAssigneeId,
  preTasks: [],
  attachments: [],
  alertEnabled: false,
});

export default function AddTaskModal({
  open,
  mode = "add",
  editingTask = null,
  onClose,
  onSubmit,
  projects = [],
}) {
  const isEdit = mode === "edit";
  const { assignees, currentUserMemberId } = useTeam();
  const defaultAssigneeId = currentUserMemberId ?? assignees[0]?.id ?? "";
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initialForm);
  const [preTaskInput, setPreTaskInput] = useState("");
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState(null);

  const projectOptions = useMemo(
    () =>
      filterActiveProjects(projects).map((p) => ({
        id: p.id,
        name: p.projectName,
        color: getProjectStageColor(p),
      })),
    [projects]
  );

  const selectedProject = projectOptions.find((p) => p.id === form.projectId);
  const selectedAssignee = assignees.find((m) => m.id === form.assigneeId) ?? assignees[0];

  useEffect(() => {
    if (!open) return;
    if (isEdit && editingTask) {
      setForm({
        title: editingTask.title ?? "",
        description: editingTask.description ?? "",
        priority: editingTask.priority ?? "medium",
        status: editingTask.status ?? "todo",
        projectId: "",
        dueDate: editingTask.dueDateIso ?? "",
        dueTime: editingTask.dueTime ?? "",
        dueTimeSelected: Boolean(editingTask.dueTime?.trim()),
        assigneeId: findTaskAssigneeId(editingTask.assignee, assignees),
        preTasks: getTaskPreTasks(editingTask).map((item) => item.title),
        attachments: editingTask.attachments?.length ? [...editingTask.attachments] : [],
        alertEnabled: Boolean(editingTask.alertEnabled),
      });
      setPreTaskInput("");
      setTimePickerOpen(false);
      setPreviewAttachment(null);
      setStep(1);
      return;
    }
    setForm(initialForm(defaultAssigneeId));
    setPreTaskInput("");
    setTimePickerOpen(false);
    setPreviewAttachment(null);
    setStep(1);
  }, [open, isEdit, editingTask, assignees, defaultAssigneeId]);

  useEffect(() => {
    if (!open || !isEdit || !editingTask?.project) return;
    const match = projectOptions.find((p) => p.name === editingTask.project);
    if (match) setForm((f) => ({ ...f, projectId: match.id }));
  }, [open, isEdit, editingTask, projectOptions]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key !== "Escape" || timePickerOpen) return;
      if (previewAttachment) {
        setPreviewAttachment(null);
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, timePickerOpen, previewAttachment]);

  useEffect(() => {
    if (!open) return undefined;
    return lockBodyScroll();
  }, [open]);

  if (!open) return null;

  const canGoNext = step !== 1 || Boolean(form.title.trim());

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = () => {
    if (!form.title.trim()) return;
    onSubmit?.({
      title: form.title,
      description: form.description,
      priority: form.priority,
      status: form.status,
      project: selectedProject?.name ?? "",
      projectColor: selectedProject?.color ?? "#6366f1",
      dueDate: form.dueDate,
      dueTime: form.dueTimeSelected ? form.dueTime : "",
      assignee: selectedAssignee,
      preTasks: form.preTasks,
      attachments: form.attachments,
      alertEnabled: form.alertEnabled,
    });
    onClose();
  };

  const addPreTask = () => {
    const trimmed = preTaskInput.trim();
    if (!trimmed || form.preTasks.includes(trimmed)) return;
    update("preTasks", [...form.preTasks, trimmed]);
    setPreTaskInput("");
  };

  const removePreTask = (index) => {
    update(
      "preTasks",
      form.preTasks.filter((_, i) => i !== index)
    );
  };

  const next = () => {
    if (step === 1 && !form.title.trim()) return;
    setStep((s) => Math.min(s + 1, 3));
  };

  const back = () => setStep((s) => Math.max(s - 1, 1));

  const dueDateLabel = formatTaskDueLabel(
    form.dueDate,
    form.dueTimeSelected ? form.dueTime : ""
  );

  const timeFieldClassName =
    "w-full rounded-xl border border-slate-400 bg-white px-3 py-2.5 text-sm text-slate-950 shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200";

  return createPortal(
    <>
    <div className="fixed inset-0 z-[150] overflow-y-auto">
      <button
        type="button"
        aria-label="Close modal backdrop"
        className={cn("fixed inset-0", onboardingShell.backdrop)}
        onClick={() => {
          if (!timePickerOpen) onClose();
        }}
      />

      <div className="flex min-h-full items-center justify-center p-4">
      <div
        className={cn(
          "relative z-10 flex max-h-[min(calc(100vh-2rem),860px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border",
          onboardingShell.panel
        )}
      >
        <div className={cn("px-6 py-5", onboardingShell.header)}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">
                Over Drive OS
              </p>
              <h2 className="mt-0.5 text-lg font-bold text-white">
                {isEdit ? "Edit Task" : "New Task"}
              </h2>
              <p className="mt-0.5 text-xs font-medium text-slate-300">
                {isEdit
                  ? "Update task details across 3 steps"
                  : "Add work to your portfolio in 3 simple steps"}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-5 flex items-center gap-1">
            {STEPS.map((s) => {
              const done = step > s.id;
              const active = step === s.id;
              const Icon = s.icon;
              return (
                <div key={s.id} className="flex flex-1 items-center gap-1">
                  <div className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full border-2 transition",
                        done
                          ? "border-emerald-400 bg-emerald-500 text-white"
                          : active
                            ? "border-indigo-300 bg-indigo-600 text-white"
                            : "border-slate-600 bg-slate-800 text-slate-400"
                      )}
                    >
                      {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    </div>
                    <span
                      className={cn(
                        "hidden text-center text-[10px] font-semibold sm:block",
                        active ? "text-white" : "text-slate-400"
                      )}
                    >
                      {s.label}
                    </span>
                  </div>
                  {s.id < STEPS.length && (
                    <div
                      className={cn(
                        "mb-5 h-0.5 flex-1 rounded",
                        step > s.id ? "bg-emerald-500" : "bg-slate-700"
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className={cn("min-h-0 flex-1 overflow-y-auto px-6 py-6", onboardingShell.body)}>
          {step === 1 && (
            <div className="space-y-4">
              <Input
                label="Task title"
                id="task-title"
                variant={FIELD}
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder="What needs to be done?"
                required
                autoFocus
              />
              <Textarea
                label="Description"
                id="task-description"
                variant={FIELD}
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder="Context, acceptance criteria, or notes…"
                rows={4}
              />
              <Select
                label="Priority"
                id="task-priority"
                variant={FIELD}
                value={form.priority}
                onChange={(e) => update("priority", e.target.value)}
              >
                {TASK_PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </Select>

              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-900">Pre-Tasks</span>
                {form.preTasks.length > 0 ? (
                  <ul className="space-y-1.5">
                    {form.preTasks.map((item, index) => (
                      <li
                        key={`${item}-${index}`}
                        className="flex items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 shadow-sm"
                      >
                        <span className="min-w-0 flex-1 text-sm font-medium text-slate-800">{item}</span>
                        <button
                          type="button"
                          onClick={() => removePreTask(index)}
                          className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                          aria-label={`Remove pre-task ${item}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="flex gap-2">
                  <input
                    id="task-pre-task-input"
                    type="text"
                    value={preTaskInput}
                    onChange={(e) => setPreTaskInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addPreTask();
                      }
                    }}
                    placeholder="e.g. Review wireframes, confirm API scope…"
                    className="min-w-0 flex-1 rounded-xl border border-slate-400 bg-white px-3 py-2.5 text-sm text-slate-950 shadow-sm placeholder:text-slate-500 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                  <button
                    type="button"
                    onClick={addPreTask}
                    disabled={!preTaskInput.trim()}
                    className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </button>
                </div>
              </div>

              <AttachmentInput
                variant={FIELD}
                label="Attachments"
                attachments={form.attachments}
                onChange={(files) => update("attachments", files)}
                onPreview={setPreviewAttachment}
                fileSource={
                  isEdit && editingTask
                    ? { type: "task", id: editingTask.id, label: editingTask.title }
                    : { type: "task", label: form.title.trim() || "New task" }
                }
              />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <Select
                label="Project"
                id="task-project"
                variant={FIELD}
                value={form.projectId}
                onChange={(e) => update("projectId", e.target.value)}
              >
                <option value="">Select -</option>
                {projectOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name}
                  </option>
                ))}
              </Select>
              {projectOptions.length === 0 && (
                <p className="text-xs text-slate-600">
                  No active projects yet — you can still create a task without a project.
                </p>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="Due date"
                  id="task-due-date"
                  type="date"
                  variant={FIELD}
                  value={form.dueDate}
                  onChange={(e) => update("dueDate", e.target.value)}
                />
                <div className="space-y-1.5">
                  <span className={cn("block text-xs font-semibold text-slate-900")}>Time</span>
                  <button
                    type="button"
                    onClick={() => setTimePickerOpen(true)}
                    className={cn(
                      timeFieldClassName,
                      "flex items-center justify-between gap-2 text-left font-medium tabular-nums"
                    )}
                  >
                    <span
                      className={cn(
                        "flex items-center gap-2",
                        !form.dueTimeSelected && "text-slate-500"
                      )}
                    >
                      <Clock className="h-4 w-4 text-indigo-600" />
                      {form.dueTimeSelected ? form.dueTime : "Select time"}
                    </span>
                    <span className="text-[10px] font-semibold text-indigo-600">
                      {form.dueTimeSelected ? "Change" : "Set"}
                    </span>
                  </button>
                </div>
              </div>
              <Select
                label="Status"
                id="task-status"
                variant={FIELD}
                value={form.status}
                onChange={(e) => update("status", e.target.value)}
              >
                {TASK_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </Select>

              <AlertOptionField
                enabled={form.alertEnabled}
                onChange={(value) => update("alertEnabled", value)}
              />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <Select
                label="Assignee"
                id="task-assignee"
                variant={FIELD}
                value={form.assigneeId}
                onChange={(e) => update("assigneeId", e.target.value)}
              >
                {assignees.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </Select>

              <TaskReviewCard
                title={form.title}
                priority={form.priority}
                description={form.description}
                attachments={form.attachments}
                onPreviewAttachment={setPreviewAttachment}
              />

              {form.preTasks.length > 0 ? (
                <ReviewSection title="Pre-Tasks">
                  <PreTasksDisplay items={form.preTasks} />
                </ReviewSection>
              ) : null}

              <ReviewSection title="Schedule">
                <ReviewRow label="Project" value={selectedProject?.name || "Unassigned"} />
                <ReviewRow label="Due date" value={dueDateLabel} />
                <ReviewRow
                  label="Status"
                  value={TASK_STATUS_OPTIONS.find((s) => s.id === form.status)?.label}
                />
                <ReviewRow label="Alert" value={form.alertEnabled ? "On — not a risk flag" : "Off"} />
              </ReviewSection>
            </div>
          )}
        </div>

        <div className={cn("flex items-center justify-between px-6 py-4", onboardingShell.footer)}>
          <button
            type="button"
            onClick={step === 1 ? onClose : back}
            className="flex items-center gap-1.5 rounded-xl border border-slate-400 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            {step === 1 ? "Cancel" : "Back"}
          </button>

          {step < 3 ? (
            <button
              type="button"
              onClick={next}
              disabled={!canGoNext}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-700 to-indigo-600 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-indigo-900/30 hover:from-indigo-800 hover:to-indigo-700 disabled:cursor-not-allowed disabled:from-slate-400 disabled:to-slate-400 disabled:opacity-70"
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!form.title.trim()}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-700 to-indigo-600 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-indigo-900/30 hover:from-indigo-800 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <Plus className="h-4 w-4" />
              {isEdit ? "Save changes" : "Create Task"}
            </button>
          )}
        </div>
      </div>
      </div>
    </div>

      <EventTimePickerOverlay
        open={timePickerOpen}
        value={form.dueTimeSelected ? form.dueTime : formatCurrentTimeLabel()}
        zIndexClass="z-[160]"
        onClose={() => setTimePickerOpen(false)}
        onConfirm={(value) => {
          setForm((f) => ({ ...f, dueTime: value, dueTimeSelected: true }));
        }}
      />

      <TaskAttachmentPreviewModal
        attachment={previewAttachment}
        open={Boolean(previewAttachment)}
        onClose={() => setPreviewAttachment(null)}
      />
    </>,
    document.body
  );
}
