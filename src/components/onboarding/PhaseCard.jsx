import { Plus } from "lucide-react";
import Select from "../ui/Select";
import Textarea from "../ui/Textarea";
import AttachmentInput from "../ui/AttachmentInput";
import PhaseTaskCard from "./PhaseTaskCard";
import { emptyTask } from "../../lib/projectUtils";
import { onboardingFieldVariant } from "./onboardingTheme";

const FIELD = onboardingFieldVariant;

export default function PhaseCard({ phase, data, onChange, projectName = "Project" }) {
  const update = (field, value) => onChange({ ...data, [field]: value });
  const tasks = data.tasks ?? [];

  const addTask = () => {
    update("tasks", [...tasks, emptyTask()]);
  };

  const updateTask = (taskId, taskData) => {
    update(
      "tasks",
      tasks.map((t) => (t.id === taskId ? taskData : t))
    );
  };

  const removeTask = (taskId) => {
    update(
      "tasks",
      tasks.filter((t) => t.id !== taskId)
    );
  };

  return (
    <div className="rounded-2xl border border-slate-300 bg-white p-5 shadow-md">
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-800">
            Editing phase
          </p>
          <h4 className="text-lg font-bold text-slate-950">{phase.title}</h4>
        </div>
        <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-[10px] font-bold text-indigo-900">
          {tasks.length} task{tasks.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="space-y-4">
        <Textarea
          variant={FIELD}
          label="Phase Objective"
          id={`${phase.id}-objective`}
          value={data.objective}
          onChange={(e) => update("objective", e.target.value)}
          placeholder={`What should ${phase.title} achieve?`}
          rows={2}
        />

        <Select
          variant={FIELD}
          label="Status"
          id={`${phase.id}-status`}
          value={data.status}
          onChange={(e) => update("status", e.target.value)}
        >
          <option value="not_started">Not Started</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="on_hold">On Hold</option>
        </Select>

        <AttachmentInput
          variant={FIELD}
          label="Attachments"
          attachments={data.attachments ?? []}
          onChange={(files) => update("attachments", files)}
          fileSource={{
            type: "project",
            label: `${projectName} · ${phase.title}`,
          }}
        />

        <div className="border-t border-slate-200 pt-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900">Phase Tasks</span>
            <button
              type="button"
              onClick={addTask}
              className="flex items-center gap-1 rounded-lg bg-indigo-700 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-indigo-800"
            >
              <Plus className="h-3 w-3" />
              Add Task
            </button>
          </div>

          {tasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-400 bg-slate-50 px-4 py-8 text-center">
              <p className="text-xs font-semibold text-slate-800">No tasks yet</p>
              <p className="mt-1 text-[11px] font-medium text-slate-600">
                Add tasks with titles, details, and dates for this phase
              </p>
              <button
                type="button"
                onClick={addTask}
                className="mt-3 text-[11px] font-bold text-indigo-800 hover:text-indigo-950"
              >
                + Add first task
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task, index) => (
                <PhaseTaskCard
                  key={task.id}
                  task={task}
                  index={index}
                  phaseId={phase.id}
                  onChange={(taskData) => updateTask(task.id, taskData)}
                  onRemove={() => removeTask(task.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
