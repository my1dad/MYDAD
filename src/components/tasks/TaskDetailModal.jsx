import { useEffect, useState } from "react";
import {
  CalendarDays,
  Flag,
  FolderKanban,
  Pencil,
  Paperclip,
  Trash2,
  User,
  X,
} from "lucide-react";
import AttachmentInput from "../ui/AttachmentInput";
import {
  PRIORITY_BADGE_STYLES,
  TASK_STATUS_OPTIONS,
  getTaskDueDisplay,
} from "../../data/tasksData";
import TaskAttachmentPreviewModal from "./TaskAttachmentPreview";
import PreTasksDisplay from "./PreTasksDisplay";
import TaskDreamboardIcon from "./TaskDreamboardIcon";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

const PANEL_X = "px-6";
const SECTION_STACK = "space-y-5";

function Partition({ title, icon: Icon, children, className, bodyClassName }) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className={cn("flex items-center gap-2 border-b border-slate-100 bg-slate-50/80", PANEL_X, "py-3")}>
        {Icon ? <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden /> : null}
        <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{title}</h3>
      </div>
      <div className={cn(PANEL_X, "py-5", bodyClassName)}>{children}</div>
    </div>
  );
}

function DetailSection({ title, icon: Icon, children, className, contentClassName }) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm",
        className
      )}
    >
      <div className={cn("flex items-center gap-2 border-b border-slate-100 bg-slate-50/80", PANEL_X, "py-3")}>
        {Icon ? <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden /> : null}
        <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{title}</h3>
      </div>
      <div className={cn(PANEL_X, "py-5", contentClassName)}>{children}</div>
    </section>
  );
}

function MetaRow({ icon: Icon, label, children }) {
  return (
    <div className="flex gap-3 border-b border-slate-100 py-3.5 last:border-0 last:pb-0 first:pt-0">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <Icon className="h-4 w-4" aria-hidden />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
        <div className="mt-1 text-sm font-semibold text-slate-900">{children}</div>
      </div>
    </div>
  );
}

export default function TaskDetailModal({
  task,
  open,
  isDone = false,
  onClose,
  onEdit,
  onDelete,
  onAttachmentsChange,
}) {
  const [previewAttachment, setPreviewAttachment] = useState(null);

  useEffect(() => {
    if (!open) setPreviewAttachment(null);
  }, [open, task?.id]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      if (previewAttachment) {
        setPreviewAttachment(null);
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, previewAttachment]);

  if (!open || !task) return null;

  const statusLabel = isDone
    ? "Done"
    : TASK_STATUS_OPTIONS.find((s) => s.id === task.status)?.label ?? task.status;

  const attachments = task.attachments ?? [];
  const preTaskItems = task.preTasks?.length ? task.preTasks : task.preTask ? [task.preTask] : [];
  const dueLabel = getTaskDueDisplay(task);

  return (
    <>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6">
        <button
          type="button"
          aria-label="Close"
          className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
          onClick={onClose}
        />
        <div
          role="dialog"
          aria-labelledby="task-detail-title"
          className="relative z-10 flex max-h-[min(92vh,860px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/50 shadow-2xl"
        >
          {/* Header */}
          <header
            className={cn("shrink-0 border-b bg-white", PANEL_X, "pb-5 pt-5")}
            style={{
              borderColor: `${task.projectColor}30`,
              background: `linear-gradient(180deg, ${task.projectColor}12 0%, white 72%)`,
            }}
          >
            <div className="flex items-start gap-4">
              <div className="min-w-0 flex-1">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize ring-1",
                      PRIORITY_BADGE_STYLES[task.priority]
                    )}
                  >
                    {task.priority}
                  </span>
                  <span className="rounded-md bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700 ring-1 ring-violet-200/60">
                    {statusLabel}
                  </span>
                  {task.project ? (
                    <span
                      className="rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset"
                      style={{
                        backgroundColor: `${task.projectColor}14`,
                        color: task.projectColor,
                        borderColor: `${task.projectColor}35`,
                      }}
                    >
                      {task.project}
                    </span>
                  ) : null}
                </div>
                <div className="flex min-w-0 items-center gap-2">
                  <h2
                    id="task-detail-title"
                    className="min-w-0 text-xl font-bold leading-snug tracking-tight text-slate-900 sm:text-2xl"
                  >
                    {task.title}
                  </h2>
                  <TaskDreamboardIcon task={task} className="h-4 w-4" />
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </header>

          {/* Body */}
          <div className={cn("min-h-0 flex-1 overflow-y-auto", PANEL_X, "py-5")}>
            <div className={SECTION_STACK}>
              <section className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
                <div className="grid lg:grid-cols-[minmax(0,1fr)_272px]">
                  <div className="min-w-0 border-b border-slate-100 lg:border-b-0 lg:border-r">
                    <Partition title="Description">
                      {task.description ? (
                        <p className="text-sm leading-relaxed text-slate-700">{task.description}</p>
                      ) : (
                        <p className="text-sm italic text-slate-400">No description provided.</p>
                      )}
                    </Partition>

                    {preTaskItems.length > 0 ? (
                      <div className="border-t border-slate-100">
                        <PreTasksDisplay items={preTaskItems} embedded />
                      </div>
                    ) : null}
                  </div>

                  <Partition title="Task details" bodyClassName="!py-4">
                    <MetaRow icon={FolderKanban} label="Project">
                      <span className="truncate" style={{ color: task.projectColor }}>
                        {task.project || "Unassigned"}
                      </span>
                    </MetaRow>
                    <MetaRow icon={CalendarDays} label="Due date">
                      {dueLabel || <span className="font-medium text-slate-400">Not set</span>}
                    </MetaRow>
                    <MetaRow icon={User} label="Assignee">
                      {task.assignee?.name ?? "—"}
                    </MetaRow>
                    <MetaRow icon={Flag} label="Priority">
                      <span className="capitalize">{task.priority}</span>
                    </MetaRow>
                  </Partition>
                </div>
              </section>

              <DetailSection title="Attachments" icon={Paperclip}>
                <AttachmentInput
                  label={attachments.length > 0 ? "Add more files" : "Upload files"}
                  attachments={attachments}
                  onChange={(files) => onAttachmentsChange?.(files)}
                  onPreview={setPreviewAttachment}
                  fileSource={{ type: "task", id: task.id, label: task.title }}
                  listVariant="zebra"
                />
              </DetailSection>
            </div>
          </div>

          {/* Footer */}
          <footer
            className={cn(
              "flex shrink-0 gap-3 border-t border-slate-200 bg-white",
              PANEL_X,
              "py-4"
            )}
          >
            <button
              type="button"
              onClick={() => {
                onEdit(task);
                onClose();
              }}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              <Pencil className="h-4 w-4" />
              Edit task
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Delete "${task.title}"?`)) {
                  onDelete(task);
                  onClose();
                }
              }}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </footer>
        </div>
      </div>

      <TaskAttachmentPreviewModal
        attachment={previewAttachment}
        open={Boolean(previewAttachment)}
        onClose={() => setPreviewAttachment(null)}
      />
    </>
  );
}
