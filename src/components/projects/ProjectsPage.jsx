import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  FolderKanban,
  PauseCircle,
  Plus,
  TrendingUp,
  User,
} from "lucide-react";
import {
  calcProgress,
  countProjectTasks,
  formatPhaseTimer,
  getProjectElapsedMs,
  getProjectStageColor,
  isProjectComplete,
  isProjectOnHold,
  isProjectStarted,
  isProjectTasksComplete,
  filterActiveProjects,
  filterCompletedProjects,
  orderProjectsForColorGrid,
  projectHasRunningTimer,
  stageColorBg,
} from "../../lib/projectUtils";
import ProjectActionButtons from "./ProjectActionButtons";
import ProjectDetail from "./ProjectDetail";

const PRIORITY_STYLES = {
  low: "bg-white text-emerald-700 ring-emerald-200",
  medium: "bg-white text-amber-700 ring-amber-200",
  high: "bg-white text-red-700 ring-red-200",
  critical: "bg-white text-purple-700 ring-purple-200",
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

function formatLaunchDate(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ProjectCard({ project, onClick, onEdit, onDelete }) {
  const progress = project.progress ?? calcProgress(project.phases);
  const color = getProjectStageColor(project);
  const isOnHold = isProjectOnHold(project);
  const cardTint = isOnHold ? "#ef4444" : color;
  const isComplete = !isOnHold && isProjectTasksComplete(project);
  const isStarted = !isOnHold && isProjectStarted(project);
  const { done: tasksDone, total: tasksTotal } = countProjectTasks(project);
  const hasTasks = tasksTotal > 0;
  const hasRunningTimer = projectHasRunningTimer(project);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!hasRunningTimer) {
      setNow(Date.now());
      return undefined;
    }
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [hasRunningTimer, project.id, project.phases]);

  const elapsedMs = getProjectElapsedMs(project, now);
  const launchDate = formatLaunchDate(project.targetLaunchDate);

  const handleKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick?.();
    }
  };

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "group relative flex min-h-[320px] flex-col overflow-hidden rounded-2xl border bg-white text-left shadow-sm outline-none transition-all duration-300",
        isOnHold ? "border-red-200 hover:shadow-red-100/80" : "border-slate-200/70 hover:shadow-slate-200/70",
        "hover:-translate-y-1 hover:shadow-lg",
        "focus-visible:ring-2 focus-visible:ring-offset-2",
        isOnHold ? "focus-visible:ring-red-400/40" : "focus-visible:ring-indigo-500/30"
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ backgroundColor: stageColorBg(cardTint, isOnHold ? 0.16 : 0.12) }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1 opacity-80"
        style={{
          background: isOnHold
            ? `linear-gradient(90deg, ${stageColorBg("#ef4444", 0.65)}, ${stageColorBg("#ef4444", 0.25)})`
            : `linear-gradient(90deg, ${stageColorBg(color, 0.38)}, ${stageColorBg(color, 0.14)})`,
        }}
      />

      <div className="relative z-10 flex flex-1 flex-col p-5">
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide shadow-sm ring-1 ring-inset",
              PRIORITY_STYLES[project.priority] ?? PRIORITY_STYLES.medium
            )}
          >
            {project.priority}
          </span>
          {isOnHold ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700 shadow-sm ring-1 ring-inset ring-red-200">
              <PauseCircle className="h-3 w-3" />
              Hold
            </span>
          ) : isComplete ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 shadow-sm ring-1 ring-inset ring-emerald-200">
              <CheckCircle2 className="h-3 w-3" />
              Done
            </span>
          ) : isStarted ? (
            <span className="inline-flex items-center rounded-md bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-700 shadow-sm ring-1 ring-inset ring-indigo-200">
              Active
            </span>
          ) : (
            <span className="inline-flex items-center rounded-md bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 shadow-sm ring-1 ring-inset ring-slate-200">
              Inactive
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-md bg-white px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-700 shadow-sm ring-1 ring-slate-200">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
            Stage
          </span>
        </div>

        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1",
                isOnHold ? "ring-red-200 text-red-600" : "ring-slate-200/80"
              )}
              style={isOnHold ? undefined : { color }}
            >
              <FolderKanban className="h-5 w-5" />
            </div>
            <div className="min-w-0 pt-0.5">
              <h3 className="truncate text-base font-semibold tracking-tight text-slate-900">
                {project.projectName}
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                {TYPE_LABELS[project.projectType] ?? project.projectType}
                <span className="mx-1.5 text-slate-300">·</span>
                <span className="capitalize">{project.clientType}</span>
              </p>
            </div>
          </div>

          <ProjectActionButtons
            size="sm"
            className="relative z-20 shrink-0 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
            onEdit={() => onEdit?.(project)}
            onDelete={() => onDelete?.(project.id)}
          />
        </div>

        <div className="mb-4 rounded-xl bg-indigo-50/90 p-3 ring-1 ring-indigo-200/70">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-indigo-500/80">
            Project Summary
          </p>
          {project.description ? (
            <p className="line-clamp-2 text-xs leading-relaxed text-slate-600">
              {project.description}
            </p>
          ) : (
            <p className="text-xs italic text-slate-400">No description provided</p>
          )}
        </div>

        <div className="mb-4 rounded-xl bg-slate-50/80 p-3 ring-1 ring-slate-100">
          <div className="mb-2.5 grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Overall progress
              </p>
              <p className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight text-slate-900">
                {progress}
                <span className="text-sm font-semibold text-slate-400">%</span>
              </p>
            </div>
            <div className="text-right">
              <p className="flex items-center justify-end gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <Clock className="h-3 w-3" />
                Elapsed total
              </p>
              <p className="mt-0.5 text-2xl font-extrabold tabular-nums tracking-tight text-slate-900">
                {formatPhaseTimer(elapsedMs)}
                {hasRunningTimer && (
                  <span className="ml-1 inline-block h-2 w-2 animate-pulse rounded-full bg-indigo-500 align-middle" />
                )}
              </p>
            </div>
          </div>
          {hasTasks && (
            <p className="mb-2.5 text-right text-xs font-medium text-slate-500">
              {tasksDone}/{tasksTotal} tasks
            </p>
          )}

          <div className="h-2 overflow-hidden rounded-full bg-white ring-1 ring-slate-200/80">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                background: `linear-gradient(90deg, ${color}99, ${color})`,
              }}
            />
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <div className="min-w-0 space-y-1.5 text-xs text-slate-500">
            {project.team?.projectOwner && (
              <p className="flex items-center gap-1.5 truncate">
                <User className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="truncate">{project.team.projectOwner}</span>
              </p>
            )}
            {launchDate && (
              <p className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                {launchDate}
              </p>
            )}
          </div>

          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-lg border bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 transition",
              "group-hover:bg-indigo-600 group-hover:text-white",
              isOnHold
                ? "border-red-300 group-hover:border-red-600 group-hover:bg-red-600"
                : "border-indigo-200 group-hover:border-indigo-600"
            )}
          >
            Open
            <ArrowUpRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </span>
        </div>
      </div>
    </article>
  );
}

function PortfolioStatCard({ icon: Icon, label, value, subtitle, accent, live, progress, onClick }) {
  const accents = {
    slate: {
      bar: "from-slate-500 to-slate-400",
      icon: "bg-slate-500/10 text-slate-600 ring-slate-500/15",
      value: "text-slate-900",
      surface: "from-white to-slate-50/80",
    },
    indigo: {
      bar: "from-indigo-500 to-blue-500",
      icon: "bg-indigo-500/10 text-indigo-600 ring-indigo-500/15",
      value: "text-indigo-600",
      surface: "from-white to-indigo-50/50",
    },
    red: {
      bar: "from-red-500 to-rose-500",
      icon: "bg-red-500/10 text-red-600 ring-red-500/15",
      value: "text-red-600",
      surface: "from-white to-red-50/40",
    },
    emerald: {
      bar: "from-emerald-500 to-teal-500",
      icon: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/15",
      value: "text-emerald-600",
      surface: "from-white to-emerald-50/45",
    },
    violet: {
      bar: "from-violet-500 to-purple-500",
      icon: "bg-violet-500/10 text-violet-600 ring-violet-500/15",
      value: "text-violet-600",
      surface: "from-white to-violet-50/45",
    },
  };
  const tone = accents[accent] ?? accents.slate;
  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "group relative w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br text-left shadow-sm transition-all duration-200",
        "hover:-translate-y-0.5 hover:border-slate-300/90 hover:shadow-md",
        tone.surface,
        onClick && "cursor-pointer"
      )}
    >
      <div className={cn("h-1 w-full bg-gradient-to-r", tone.bar)} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset",
              tone.icon
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={2.25} />
          </div>
          <p className="pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {label}
          </p>
        </div>

        <p className={cn("mt-3 flex items-center gap-2 text-3xl font-bold tabular-nums tracking-tight", tone.value)}>
          {value}
          {live && (
            <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-violet-500" />
          )}
        </p>

        {typeof progress === "number" && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/90 ring-1 ring-slate-200/80">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        )}

        {subtitle && (
          <p className="mt-2.5 text-xs font-medium leading-snug text-slate-500">{subtitle}</p>
        )}
      </div>
    </Tag>
  );
}

function PortfolioStats({ projects, onViewCompleted }) {
  const activeProjects = useMemo(() => filterActiveProjects(projects), [projects]);
  const completedProjects = useMemo(() => filterCompletedProjects(projects), [projects]);
  const anyRunningTimer = useMemo(
    () => activeProjects.some(projectHasRunningTimer),
    [activeProjects]
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!anyRunningTimer) {
      setNow(Date.now());
      return undefined;
    }
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [anyRunningTimer, projects]);

  const stats = useMemo(() => {
    const completed = completedProjects.length;
    const active = activeProjects.filter((p) => {
      if (isProjectOnHold(p)) return false;
      return isProjectStarted(p);
    }).length;
    const onHold = activeProjects.filter(isProjectOnHold).length;
    const avgProgress =
      activeProjects.length > 0
        ? Math.round(
            activeProjects.reduce((sum, p) => sum + (p.progress ?? calcProgress(p.phases)), 0) /
              activeProjects.length
          )
        : 0;
    const inactive = activeProjects.filter((p) => {
      if (isProjectOnHold(p) || isProjectStarted(p)) return false;
      return true;
    }).length;
    const runningProjects = activeProjects.filter(projectHasRunningTimer);
    const totalElapsedMs = activeProjects.reduce(
      (sum, project) => sum + getProjectElapsedMs(project, now),
      0
    );

    return {
      completed,
      active,
      inactive,
      onHold,
      avgProgress,
      runningProjects,
      totalElapsedMs,
    };
  }, [activeProjects, completedProjects, now]);

  if (activeProjects.length === 0 && completedProjects.length === 0) return null;

  return (
    <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <PortfolioStatCard
        icon={FolderKanban}
        label="Total projects"
        value={activeProjects.length}
        subtitle={
          stats.completed > 0
            ? `${stats.completed} completed — view finished projects`
            : `${stats.inactive} not started`
        }
        accent="slate"
        onClick={stats.completed > 0 ? onViewCompleted : undefined}
      />
      <PortfolioStatCard
        icon={Activity}
        label="Active"
        value={stats.active}
        subtitle={stats.active > 0 ? "In progress now" : "No active work right now"}
        accent="indigo"
      />
      <PortfolioStatCard
        icon={PauseCircle}
        label="On hold"
        value={stats.onHold}
        subtitle={stats.onHold > 0 ? "Paused across portfolio" : "All clear — nothing on hold"}
        accent="red"
      />
      <PortfolioStatCard
        icon={TrendingUp}
        label="Avg. progress"
        value={`${stats.avgProgress}%`}
        subtitle="Portfolio-wide completion"
        accent="emerald"
        progress={stats.avgProgress}
      />
      <PortfolioStatCard
        icon={Clock}
        label="Elapsed time"
        value={formatPhaseTimer(stats.totalElapsedMs)}
        subtitle={
          stats.runningProjects.length > 0
            ? `${stats.runningProjects.length} timer${stats.runningProjects.length === 1 ? "" : "s"} running · ${activeProjects.length} project${activeProjects.length === 1 ? "" : "s"}`
            : `Combined across ${activeProjects.length} project${activeProjects.length === 1 ? "" : "s"}`
        }
        accent="violet"
        live={anyRunningTimer}
      />
    </div>
  );
}

export default function ProjectsPage({
  projects,
  onNewProject,
  onUpdateProject,
  onEditProject,
  onDeleteProject,
  onViewCompleted,
}) {
  const [selectedId, setSelectedId] = useState(null);

  const activeProjects = useMemo(() => filterActiveProjects(projects), [projects]);
  const selectedProject = activeProjects.find((p) => p.id === selectedId);

  const handleDelete = (projectId) => {
    onDeleteProject?.(projectId);
    if (selectedId === projectId) setSelectedId(null);
  };

  const displayProjects = useMemo(
    () => orderProjectsForColorGrid(activeProjects, 3),
    [activeProjects]
  );

  if (selectedProject) {
    return (
      <ProjectDetail
        project={selectedProject}
        onBack={() => setSelectedId(null)}
        onUpdate={(updated) => onUpdateProject?.(updated)}
        onEdit={onEditProject}
        onDelete={handleDelete}
      />
    );
  }

  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-indigo-50/40 p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-xl bg-indigo-500/10 px-4 py-2 text-base font-bold text-indigo-700 ring-1 ring-indigo-500/15">
              <FolderKanban className="h-5 w-5" />
              Projects
            </div>
            <p className="max-w-xl text-sm font-semibold text-slate-600">
              Track roadmap progress.
            </p>
          </div>
          <button
            type="button"
            onClick={onNewProject}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            New Project
          </button>
        </div>
      </div>

      <PortfolioStats projects={projects} onViewCompleted={onViewCompleted} />

      {activeProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300/80 bg-gradient-to-b from-white to-slate-50/80 px-6 py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 ring-1 ring-indigo-500/15">
            <FolderKanban className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">
            {projects.length > 0 ? "No active projects" : "No projects yet"}
          </h3>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
            {projects.length > 0
              ? "All projects are finished. View completed projects from the Total projects card above."
              : "Create your first project to start building your roadmap and tracking phase progress."}
          </p>
          <button
            type="button"
            onClick={onNewProject}
            className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Create Project
          </button>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {displayProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={() => setSelectedId(project.id)}
              onEdit={onEditProject}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
