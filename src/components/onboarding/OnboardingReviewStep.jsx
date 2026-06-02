import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Calendar,
  CheckCircle2,
  Layers,
  LayoutDashboard,
  Pencil,
  Paperclip,
  Rocket,
  Target,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  emptyPhase,
  getPhaseAssigneeName,
  getPhaseTitle,
  PHASE_DEFS,
  resolvePhaseForDisplay,
} from "../../lib/projectUtils";
import { formatUsdBudget } from "../../lib/formatCurrency";
import { getStageColorLabel } from "../ui/StageColorSelect";
import PhaseCard from "./PhaseCard";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function displayValue(value) {
  if (value == null || value === "") return "—";
  return value;
}

function titleCase(value) {
  if (!value) return "—";
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

const PHASE_STATUS_STYLES = {
  not_started: "bg-slate-100 text-slate-700 ring-slate-200",
  in_progress: "bg-indigo-50 text-indigo-800 ring-indigo-200",
  completed: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  on_hold: "bg-amber-50 text-amber-900 ring-amber-200",
};

function ReviewSection({ title, icon: Icon, children, className, accentColor }) {
  return (
    <section
      className={cn(
        "flex h-full min-h-[220px] flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm",
        className
      )}
    >
      {accentColor ? (
        <div className="h-1 w-full shrink-0" style={{ backgroundColor: accentColor }} />
      ) : null}
      <header className="flex shrink-0 items-center gap-2.5 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
        {Icon ? (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm shadow-indigo-600/25">
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
        <h4 className="text-sm font-bold tracking-tight text-slate-900">{title}</h4>
      </header>
      <div className="flex flex-1 flex-col p-4">{children}</div>
    </section>
  );
}

function ReviewField({ label, value, className, fullWidth = false }) {
  return (
    <div className={cn(fullWidth && "sm:col-span-2", className)}>
      <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold leading-snug text-slate-900">
        {value ?? "—"}
      </dd>
    </div>
  );
}

const SUMMARY_TABS = [
  { id: "phases", label: "Phases" },
  { id: "tasks", label: "Tasks" },
  { id: "team", label: "Team" },
];

function glassTabClass(active) {
  return cn(
    "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-bold transition-all",
    active
      ? "bg-white/75 text-indigo-950 shadow-[0_2px_12px_rgba(99,102,241,0.12)] ring-1 ring-white/90 backdrop-blur-md"
      : "bg-white/20 text-slate-600 ring-1 ring-white/30 backdrop-blur-sm hover:bg-white/40 hover:text-slate-800"
  );
}

function ProjectSummaryPanel({
  foundation,
  phases,
  syncedTeamPreview,
  stats,
}) {
  const [activeTab, setActiveTab] = useState("phases");

  const tabContent = useMemo(() => {
    const taskRows = PHASE_DEFS.flatMap((def) =>
      (phases[def.id]?.tasks ?? []).map((task) => ({
        id: `${def.id}-${task.id}`,
        phaseTitle: getPhaseTitle(def.id, phases),
        title: task.title || "Untitled task",
        endDate: task.endDate,
      }))
    );

    return { taskRows };
  }, [phases]);

  const tabCounts = {
    phases: PHASE_DEFS.length,
    tasks: stats.taskCount,
    team: stats.teamCount,
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-w-0 shrink-0">
        <h3 className="truncate text-lg font-extrabold tracking-tight text-slate-950">
          {displayValue(foundation.projectName)}
        </h3>
        <p className="mt-0.5 font-mono text-xs font-semibold text-slate-600">
          {displayValue(foundation.projectId)}
        </p>
        <div className="mt-2 inline-flex items-center gap-2 rounded-lg bg-white/50 px-2.5 py-1 ring-1 ring-white/60 backdrop-blur-sm">
          <span
            className="h-4 w-4 rounded-md ring-1 ring-slate-200/80"
            style={{ backgroundColor: foundation.stageColor }}
            aria-hidden
          />
          <span className="text-xs font-semibold text-slate-700">
            {getStageColorLabel(foundation.stageColor)}
          </span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-1 items-center justify-center py-3">
          <div className="w-full rounded-xl bg-gradient-to-br from-slate-200/40 via-white/30 to-indigo-100/40 p-1 ring-1 ring-white/60 backdrop-blur-md">
            <div
              className="flex gap-1"
              role="tablist"
              aria-label="Project summary views"
            >
              {SUMMARY_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={glassTabClass(activeTab === tab.id)}
                >
                  {tab.label}
                  <span
                    className={cn(
                      "rounded-md px-1.5 py-0.5 text-[10px] font-extrabold tabular-nums",
                      activeTab === tab.id
                        ? "bg-indigo-100/90 text-indigo-800"
                        : "bg-white/30 text-slate-600"
                    )}
                  >
                    {tabCounts[tab.id]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {activeTab !== "phases" ? (
        <div
          className="max-h-[132px] shrink-0 overflow-y-auto rounded-xl border border-white/50 bg-white/40 p-2.5 ring-1 ring-white/70 backdrop-blur-sm"
          role="tabpanel"
        >
        {activeTab === "tasks" &&
          (tabContent.taskRows.length > 0 ? (
            <ul className="space-y-1.5">
              {tabContent.taskRows.map((task) => (
                <li
                  key={task.id}
                  className="rounded-lg bg-white/60 px-2.5 py-2 ring-1 ring-white/80"
                >
                  <p className="truncate text-xs font-semibold text-slate-900">
                    {task.title}
                  </p>
                  <p className="mt-0.5 flex items-center justify-between gap-2 text-[10px] font-medium text-slate-600">
                    <span className="truncate">{task.phaseTitle}</span>
                    <span className="shrink-0 tabular-nums">
                      {task.endDate || "No due date"}
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-xs font-medium text-slate-500">
              No tasks yet
            </p>
          ))}

        {activeTab === "team" && (
          <div className="space-y-3">
            <div className="rounded-lg bg-white/60 px-2.5 py-2 ring-1 ring-white/80">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Project owner
              </p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900">
                {displayValue(syncedTeamPreview.projectOwner)}
              </p>
            </div>
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Team members
              </p>
              <MemberChips members={syncedTeamPreview.teamMembers} />
            </div>
          </div>
        )}
        </div>
        ) : null}
      </div>
    </div>
  );
}

function PhaseRowActions({ onEdit, onDelete }) {
  const buttonClass =
    "flex h-8 w-8 items-center justify-center rounded-lg border border-transparent transition";

  return (
    <div
      className="inline-flex shrink-0 items-center gap-0.5 rounded-lg bg-white p-0.5 shadow-sm ring-1 ring-slate-200/80"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={onEdit}
        aria-label="Edit phase"
        title="Edit phase"
        className={cn(
          buttonClass,
          "text-slate-500 hover:border-indigo-100 hover:bg-indigo-50 hover:text-indigo-600"
        )}
      >
        <Pencil className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label="Clear phase"
        title="Clear phase"
        className={cn(
          buttonClass,
          "text-slate-500 hover:border-red-100 hover:bg-red-50 hover:text-red-600"
        )}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function ReviewPhaseCard({ index, phaseId, phase, members, onEdit, onDelete }) {
  const phaseTitle = getPhaseTitle(phaseId, { [phaseId]: phase });
  const tasks = phase?.tasks ?? [];
  const attachmentCount = phase?.attachments?.length ?? 0;
  const assignee = getPhaseAssigneeName(phase, members) ?? "Unassigned";
  const statusKey = phase?.status ?? "not_started";
  const statusLabel = titleCase(statusKey);
  const statusStyle =
    PHASE_STATUS_STYLES[statusKey] ?? PHASE_STATUS_STYLES.not_started;

  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-sm font-extrabold text-white shadow-sm shadow-indigo-600/25">
            {index}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-700">
              Phase {index}
            </p>
            <h5 className="mt-0.5 text-sm font-bold leading-snug text-slate-900">
              {phaseTitle}
            </h5>
            <span
              className={cn(
                "mt-2 inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1",
                statusStyle
              )}
            >
              {statusLabel}
            </span>
          </div>
        </div>
        <PhaseRowActions onEdit={onEdit} onDelete={onDelete} />
      </div>

      <div className="border-t border-slate-200/80 pt-3 lg:pl-14">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs font-semibold text-slate-600">
          <span>{assignee}</span>
          <span>
            {tasks.length} task{tasks.length !== 1 ? "s" : ""}
          </span>
          {attachmentCount > 0 ? (
            <span className="inline-flex items-center gap-1">
              <Paperclip className="h-3.5 w-3.5" />
              {attachmentCount} file{attachmentCount !== 1 ? "s" : ""}
            </span>
          ) : null}
        </div>

        {tasks.length > 0 ? (
          <ul className="mt-3 divide-y divide-slate-200/80 overflow-hidden rounded-lg border border-slate-200 bg-white">
            {tasks.map((task) => (
              <li
                key={task.id}
                className="flex items-center justify-between gap-4 px-3 py-2.5 text-xs"
              >
                <span className="min-w-0 flex-1 truncate font-medium text-slate-800">
                  {task.title || "Untitled task"}
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 font-semibold tabular-nums text-slate-500">
                  <Calendar className="h-3 w-3" />
                  {task.endDate ? task.endDate : "No due date"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs font-medium text-slate-500">No tasks added yet.</p>
        )}
      </div>
    </article>
  );
}

function MemberChips({ members }) {
  if (!members?.length) {
    return <span className="text-sm font-semibold text-slate-500">None assigned</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {members.map((member) => (
        <span
          key={member.id}
          className="inline-flex rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-900 ring-1 ring-indigo-100"
        >
          {member.name}
        </span>
      ))}
    </div>
  );
}

export default function OnboardingReviewStep({
  foundation,
  phases,
  team,
  kpis,
  members,
  syncedTeamPreview,
  projectTypeLabels,
  isEditing,
  onUpdatePhase,
  projectName,
  workloadByMemberId = {},
}) {
  const [editingPhaseId, setEditingPhaseId] = useState(null);

  const stats = useMemo(() => {
    let taskCount = 0;
    let attachmentCount = 0;
    for (const def of PHASE_DEFS) {
      const phase = phases[def.id];
      taskCount += phase?.tasks?.length ?? 0;
      attachmentCount += phase?.attachments?.length ?? 0;
    }
    return {
      taskCount,
      attachmentCount,
      teamCount: syncedTeamPreview.teamMembers.length,
    };
  }, [phases, syncedTeamPreview.teamMembers.length]);

  const editingPhase = editingPhaseId ? phases[editingPhaseId] : null;
  const editingPhaseDisplay = editingPhaseId
    ? resolvePhaseForDisplay(editingPhaseId, phases)
    : null;

  const handleClearPhase = (phaseId) => {
    const phaseTitle = getPhaseTitle(phaseId, phases);
    if (
      !window.confirm(
        `Clear "${phaseTitle}"? All tasks, attachments, and phase details will be removed.`
      )
    ) {
      return;
    }
    onUpdatePhase(phaseId, emptyPhase());
    if (editingPhaseId === phaseId) setEditingPhaseId(null);
  };

  const budgetDisplay = team.estimatedBudget
    ? formatUsdBudget(team.estimatedBudget) || team.estimatedBudget
    : "—";

  const metrics =
    kpis.successMetrics.length > 0 ? (
      <ul className="mt-1 flex flex-wrap gap-1.5">
        {kpis.successMetrics.map((metric) => (
          <li
            key={metric}
            className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-800"
          >
            {metric}
          </li>
        ))}
      </ul>
    ) : (
      <span className="text-sm font-semibold text-slate-500">None defined</span>
    );

  return (
    <div className="space-y-5">
      <p className="text-sm font-medium text-slate-600">
        {isEditing
          ? "Confirm your updates before saving the project."
          : "Review everything below, then create your project when ready."}
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-stretch">
        <ReviewSection
          title="Project summary"
          icon={LayoutDashboard}
          accentColor={foundation.stageColor}
        >
          <ProjectSummaryPanel
            foundation={foundation}
            phases={phases}
            syncedTeamPreview={syncedTeamPreview}
            stats={stats}
          />
        </ReviewSection>

        <ReviewSection title="Project foundation" icon={Rocket}>
          <dl className="grid flex-1 gap-3">
            <ReviewField
              label="Project type"
              value={
                projectTypeLabels[foundation.projectType] ?? foundation.projectType
              }
            />
            <ReviewField label="Category" value={titleCase(foundation.clientType)} />
            <ReviewField label="Priority" value={titleCase(foundation.priority)} />
            <ReviewField label="Launch date" value={displayValue(foundation.targetLaunchDate)} />
            <ReviewField
              label="Description"
              value={
                foundation.description ? (
                  <span className="line-clamp-4 block whitespace-pre-wrap font-medium text-slate-700">
                    {foundation.description}
                  </span>
                ) : (
                  "—"
                )
              }
            />
          </dl>
        </ReviewSection>

        <ReviewSection title="Team & timeline" icon={Users}>
          <dl className="grid gap-3">
            <ReviewField
              label="Project owner"
              value={displayValue(syncedTeamPreview.projectOwner)}
            />
            <ReviewField label="Sprint length" value={titleCase(team.sprintLength)} />
            <ReviewField label="Timeline" value={titleCase(team.timelineType)} />
            <ReviewField label="Estimated budget" value={budgetDisplay} />
          </dl>
          <div className="mt-auto border-t border-slate-100 pt-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Team members
            </p>
            <div className="mt-2">
              <MemberChips members={syncedTeamPreview.teamMembers} />
            </div>
          </div>
        </ReviewSection>

        <ReviewSection title="KPIs & success" icon={Target}>
          <div className="flex flex-1 flex-col gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Success metrics
              </p>
              {metrics}
            </div>
            <dl className="grid gap-3">
              <ReviewField
                label="Revenue goal"
                value={displayValue(
                  kpis.revenueGoal
                    ? formatUsdBudget(kpis.revenueGoal) || kpis.revenueGoal
                    : ""
                )}
              />
              <ReviewField label="Risk level" value={titleCase(kpis.riskLevel)} />
              <ReviewField
                label="Expected users"
                value={titleCase(kpis.expectedUserVolume)}
              />
            </dl>
            {kpis.notes ? (
              <div className="mt-auto rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Notes
                </p>
                <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm font-medium text-slate-700">
                  {kpis.notes}
                </p>
              </div>
            ) : null}
          </div>
        </ReviewSection>
      </div>

      <ReviewSection title="Roadmap phases" icon={Layers}>
        <div className="flex flex-col gap-3">
          {PHASE_DEFS.map((phaseDef, index) => (
            <ReviewPhaseCard
              key={phaseDef.id}
              index={index + 1}
              phaseId={phaseDef.id}
              phase={phases[phaseDef.id]}
              members={members}
              onEdit={() => setEditingPhaseId(phaseDef.id)}
              onDelete={() => handleClearPhase(phaseDef.id)}
            />
          ))}
        </div>
      </ReviewSection>

      <p className="flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/80 px-4 py-3 text-center text-xs font-semibold text-indigo-900">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        {isEditing
          ? "Use Update to save from any step, or Save Changes to finish."
          : "All steps complete — create the project when this looks right."}
      </p>

      {editingPhaseId && editingPhase && editingPhaseDisplay
        ? createPortal(
            <div
              className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-phase-title"
            >
              <div className="flex max-h-[min(90vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-700">
                      Edit phase
                    </p>
                    <h3
                      id="edit-phase-title"
                      className="text-base font-bold text-slate-900"
                    >
                      {getPhaseTitle(editingPhaseId, phases)}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingPhaseId(null)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-5 py-4">
                  <PhaseCard
                    phase={editingPhaseDisplay}
                    data={editingPhase}
                    onChange={(data) => onUpdatePhase(editingPhaseId, data)}
                    projectName={projectName}
                    members={members}
                    workloadByMemberId={workloadByMemberId}
                  />
                </div>
                <div className="border-t border-slate-200 bg-slate-50 px-5 py-3">
                  <button
                    type="button"
                    onClick={() => setEditingPhaseId(null)}
                    className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white hover:bg-indigo-700"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
