import { Trash2 } from "lucide-react";
import Input from "../ui/Input";
import Textarea from "../ui/Textarea";
import { onboardingFieldVariant } from "./onboardingTheme";

const FIELD = onboardingFieldVariant;

export default function PhaseTaskCard({ task, index, phaseId, onChange, onRemove }) {
  const update = (field, value) => onChange({ ...task, [field]: value });

  return (
    <div className="rounded-xl border border-slate-300 bg-slate-50 p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-700">
          Task {index + 1}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 transition hover:bg-red-100 hover:text-red-700"
          aria-label="Remove task"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-3">
        <Input
          variant={FIELD}
          label="Task Title"
          id={`${phaseId}-task-${task.id}-title`}
          placeholder="e.g. Set up authentication flow"
          value={task.title}
          onChange={(e) => update("title", e.target.value)}
        />

        <Textarea
          variant={FIELD}
          label="Details"
          id={`${phaseId}-task-${task.id}-details`}
          placeholder="Scope, acceptance criteria, dependencies..."
          value={task.details}
          onChange={(e) => update("details", e.target.value)}
          rows={3}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            variant={FIELD}
            label="Start Date"
            id={`${phaseId}-task-${task.id}-start`}
            type="date"
            value={task.startDate}
            onChange={(e) => update("startDate", e.target.value)}
          />
          <Input
            variant={FIELD}
            label="End Date"
            id={`${phaseId}-task-${task.id}-end`}
            type="date"
            value={task.endDate}
            onChange={(e) => update("endDate", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
