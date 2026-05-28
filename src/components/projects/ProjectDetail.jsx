import {
  ArrowLeft,
  CheckCircle2,
  FolderKanban,
  Target,
  User,
} from "lucide-react";
import { calcProgress, countProjectTasks, getProjectStageColor, isProjectStarted, isProjectTasksComplete, projectUsesTaskProgress, stageColorBg } from "../../lib/projectUtils";
import PhaseProgressPanel from "./PhaseProgressPanel";
import ProjectActionButtons from "./ProjectActionButtons";
import ProjectTaskChecklist from "./ProjectTaskChecklist";
import ProjectTaskProgressLog from "./ProjectTaskProgressLog";

const PRIORITY_STYLES = {
  low: "bg-emerald-50 text-emerald-700",
  medium: "bg-amber-50 text-amber-700",
  high: "bg-red-50 text-red-700",
  critical: "bg-purple-50 text-purple-700",
};

const TYPE_LABELS = {
  web_app: "Web App",
  mobile_app: "Mobile App",
  integration: "Integration",
  platform: "Platform",
  internal_tool: "Internal Tool",
};

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

const RISK_STYLES = {
  low: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  medium: "bg-amber-50 text-amber-700 ring-amber-100",
  high: "bg-red-50 text-red-700 ring-red-100",
};

function formatLabel(value) {
  if (!value) return null;
  return String(value).replace(/_/g, " ");
}

function DetailCard({ title, icon: Icon, children }) {
  return (
    <section className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-center gap-2.5 border-b border-slate-100 pb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100/80">
          <Icon className="h-4 w-4" />
        </div>
        <h2 className="text-base font-semibold tracking-tight text-slate-900">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function DetailPartition({ title, children, className }) {
  return (
    <div className={cn("mb-4 last:mb-0", className)}>
      <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {title}
      </h3>
      {children}
    </div>
  );
}

function DetailField({ label, value, children, className }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2.5 ring-1 ring-inset ring-slate-100/80",
        className
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      {children ?? (
        <p
          className={cn(
            "mt-1 text-xs font-semibold capitalize text-slate-900",
            !value && "font-normal italic text-slate-400"
          )}
        >
          {value || "Not set"}
        </p>
      )}
    </div>
  );
}

function DetailTextBlock({ label, value, emptyText = "Not provided." }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-3 ring-1 ring-inset ring-slate-100/80">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p
        className={cn(
          "mt-1.5 text-xs leading-relaxed",
          value ? "font-medium text-slate-800" : "italic text-slate-400"
        )}
      >
        {value || emptyText}
      </p>
    </div>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ProjectDetail({ project, onBack, onUpdate, onEdit, onDelete }) {
  const color = getProjectStageColor(project);
  const progress = project.progress ?? calcProgress(project.phases);
  const isComplete = isProjectTasksComplete(project);
  const isStarted = isProjectStarted(project);
  const teamMembers = project.team?.teamMembers ?? [];
  const successMetrics = project.kpis?.successMetrics ?? [];
  const taskDriven = projectUsesTaskProgress(project);
  const { done: tasksDone, total: tasksTotal } = countProjectTasks(project);

  return (
    <div className="mx-auto max-w-[1600px]">
      <button
        type="button"
        onClick={onBack}
        className="mb-5 flex items-center gap-1.5 text-sm font-medium text-slate-600 transition hover:text-indigo-600"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Projects
      </button>

      {/* Hero header */}
      <div
        className="mb-6 rounded-2xl border border-slate-200/70 p-6 shadow-sm sm:p-8"
        style={{ backgroundColor: stageColorBg(color, 0.12) }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl sm:h-[4.5rem] sm:w-[4.5rem]"
              style={{ backgroundColor: `${color}18`, color }}
            >
              <FolderKanban className="h-8 w-8" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{project.projectName}</h1>
                <ProjectActionButtons
                  onEdit={() => onEdit?.(project)}
                  onDelete={() => onDelete?.(project.id)}
                />
              </div>
              <p className="mt-1.5 text-base text-slate-500">
                {TYPE_LABELS[project.projectType] ?? project.projectType}
                {" · "}
                <span className="capitalize">{project.clientType}</span>
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <span
                  className={cn(
                    "inline-block rounded-full px-3 py-1.5 text-sm font-semibold capitalize",
                    PRIORITY_STYLES[project.priority] ?? PRIORITY_STYLES.medium
                  )}
                >
                  {project.priority} priority
                </span>
                {isComplete ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    Completed
                  </span>
                ) : isStarted ? (
                  <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700">
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-500">
                    Inactive
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="sm:text-right">
            <p className="text-4xl font-bold tabular-nums text-slate-900">{progress}%</p>
            <p className="mt-1 text-sm text-slate-500">
              Overall progress
              {taskDriven && (
                <span className="ml-1 font-semibold text-slate-600">
                  · {tasksDone}/{tasksTotal} tasks
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="mt-5">
          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                background: `linear-gradient(90deg, ${color}88, ${color})`,
              }}
            />
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
          <ProjectTaskChecklist project={project} onUpdate={onUpdate} embedded />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DetailCard title="Project Overview" icon={FolderKanban}>
          <DetailPartition title="Identity">
            <div className="grid gap-2 sm:grid-cols-2">
              <DetailField label="Project Type" value={TYPE_LABELS[project.projectType]} />
              <DetailField label="Client / Internal" value={project.clientType} />
              <DetailField label="Priority">
                <span
                  className={cn(
                    "mt-1 inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold capitalize ring-1 ring-inset",
                    PRIORITY_STYLES[project.priority] ?? PRIORITY_STYLES.medium
                  )}
                >
                  {project.priority || "Not set"}
                </span>
              </DetailField>
              <DetailField label="Project ID">
                <p className="mt-1 break-all font-mono text-[10px] font-semibold text-slate-800">
                  {project.id}
                </p>
              </DetailField>
            </div>
          </DetailPartition>

          <DetailPartition title="Schedule & Progress">
            <div className="grid gap-2 sm:grid-cols-3">
              <DetailField label="Target Launch" value={formatDate(project.targetLaunchDate)} />
              <DetailField label="Created" value={formatDate(project.createdAt)} />
              <DetailField label="Progress" value={`${progress}%`} />
            </div>
          </DetailPartition>

          <DetailPartition title="Description">
            <DetailTextBlock label="Project Summary" value={project.description} />
          </DetailPartition>
        </DetailCard>

        <DetailCard title="Team & Goals" icon={Target}>
          <DetailPartition title="Team">
            <div className="grid gap-2 sm:grid-cols-2">
              <DetailField label="Project Owner" value={project.team?.projectOwner} />
              <DetailField label="Estimated Budget" value={project.team?.estimatedBudget} />
              <DetailField label="Sprint Length" value={formatLabel(project.team?.sprintLength)} />
              <DetailField label="Timeline Type" value={formatLabel(project.team?.timelineType)} />
            </div>
            <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-3 ring-1 ring-inset ring-slate-100/80">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Team Members
              </p>
              {teamMembers.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {teamMembers.map((member, i) => (
                    <span
                      key={member?.id ?? i}
                      className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200"
                    >
                      <User className="h-3 w-3 text-indigo-500" />
                      {typeof member === "string" ? member : member?.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-1.5 text-xs italic text-slate-400">No team members assigned.</p>
              )}
            </div>
          </DetailPartition>

          <DetailPartition title="KPIs & Success">
            <div className="grid gap-2 sm:grid-cols-3">
              <DetailField label="Revenue Goal" value={project.kpis?.revenueGoal} />
              <DetailField label="Risk Level">
                <span
                  className={cn(
                    "mt-1 inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold capitalize ring-1 ring-inset",
                    RISK_STYLES[project.kpis?.riskLevel] ?? RISK_STYLES.medium
                  )}
                >
                  {project.kpis?.riskLevel || "Not set"}
                </span>
              </DetailField>
              <DetailField
                label="Expected User Volume"
                value={formatLabel(project.kpis?.expectedUserVolume)}
              />
            </div>

            <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-3 ring-1 ring-inset ring-slate-100/80">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Success Metrics
              </p>
              {successMetrics.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {successMetrics.map((metric) => (
                    <span
                      key={metric}
                      className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-100"
                    >
                      {metric}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-1.5 text-xs italic text-slate-400">No success metrics defined.</p>
              )}
            </div>

            {project.kpis?.notes && (
              <div className="mt-2">
                <DetailTextBlock label="KPI Notes" value={project.kpis.notes} />
              </div>
            )}
          </DetailPartition>
        </DetailCard>
      </div>

      {onUpdate && !taskDriven && (
        <div className="mt-5">
          <PhaseProgressPanel
            project={project}
            onUpdate={(updated) => onUpdate(updated)}
          />
        </div>
      )}

      {taskDriven && <ProjectTaskProgressLog project={project} />}
    </div>
  );
}
