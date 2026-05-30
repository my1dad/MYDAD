import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Bell,
  Boxes,
  Calendar,
  CalendarDays,
  CalendarRange,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  Clock,
  Cpu,
  ExternalLink,
  FolderKanban,
  FolderOpen,
  Layers,
  LayoutDashboard,
  Map as MapIcon,
  MessageSquare,
  Plus,
  Search,
  Settings,
  Smartphone,
  Sparkles,
  TrendingUp,
  User,
  Users,
  Wallet,
  Zap,
  Target,
  AlertTriangle,
  Paperclip,
  PauseCircle,
  X,
} from "lucide-react";
import {
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
} from "recharts";
import { LoadingProvider } from "./context/LoadingContext";
import { CalendarEventsProvider, useCalendarEvents } from "./context/CalendarEventsContext";
import { TeamProvider } from "./context/TeamContext";
import { FilesProvider } from "./context/FilesContext";
import { TasksProvider, useTasks } from "./context/TasksContext";
import { WorkspaceSettingsProvider } from "./context/WorkspaceSettingsContext";
import NewProjectOnboarding from "./components/onboarding/NewProjectOnboarding";
import TasksPage from "./components/tasks/TasksPage";
import CalendarPage from "./components/calendar/CalendarPage";
import DashboardCalendarWidget from "./components/calendar/DashboardCalendarWidget";
import ReportsPage from "./components/reports/ReportsPage";
import TeamPage from "./components/team/TeamPage";
import MessagesPage from "./components/messages/MessagesPage";
import SettingsPage from "./components/settings/SettingsPage";
import SystemsPage from "./components/systems/SystemsPage";
import FileBinWidget from "./components/file-manager/FileBinWidget";
import FileManagerPage from "./components/file-manager/FileManagerPage";
import DreamboardPage from "./components/dreamboard/DreamboardPage";
import TaskDueDisplay from "./components/tasks/TaskDueDisplay";
import TaskDreamboardIcon from "./components/tasks/TaskDreamboardIcon";
import { PRIORITY_TEXT_STYLES, TASK_STATUS_FILTERS } from "./data/tasksData";
import ProjectProgressModal from "./components/projects/ProjectProgressModal";
import ProjectsPage from "./components/projects/ProjectsPage";
import CompletedProjectsPage from "./components/projects/CompletedProjectsPage";
import ProjectTaskChecklist from "./components/projects/ProjectTaskChecklist";
import RoadmapProgressBar from "./components/roadmap/RoadmapProgressBar";
import { LOGO_URL, PROFILE_ENIS_URL } from "./lib/assetUrl";
import { clearOnboardingDraft, loadProjectBin, saveProjectBin } from "./lib/projectStorage";
import { readPageFromHash, writePageToHash } from "./lib/appNavigation";
import {
  calcProgress,
  compareProjectsByPriority,
  countProjectTasks,
  ensurePhases,
  getProjectPriorityMeta,
  ensureUniqueProjectColors,
  formatPhaseTimer,
  formatProjectOnHoldLabel,
  generateProjectStageColor,
  filterActiveProjects,
  getAtRiskProjects,
  getOnHoldProjectsDetails,
  getProjectElapsedMs,
  getProjectStageColor,
  getUpcomingMilestones,
  isProjectComplete,
  isProjectOnHold,
  normalizeProject,
  PHASE_DEFS,
} from "./lib/projectUtils";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

// ─── Mock Data ───────────────────────────────────────────────────────────────

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "roadmap", label: "Roadmap", icon: MapIcon },
  { id: "tasks", label: "Tasks", icon: CheckSquare },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "projects", label: "Projects", icon: FolderKanban },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "team", label: "Team", icon: Users },
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "file-manager", label: "File Manager", icon: FolderOpen },
  { id: "dreamboard", label: "Dreamboard", icon: Sparkles },
];

const phases = [
  { id: "foundation", label: "Phase 1: Foundation", shortLabel: "Foundation" },
  { id: "core", label: "Phase 2: Core Features", shortLabel: "Core Features" },
  { id: "integrations", label: "Phase 3: Integrations", shortLabel: "Integrations" },
  { id: "scale", label: "Phase 4: Scale & Optimize", shortLabel: "Scale & Optimize" },
];

function calcProjectProgress(phasePercents) {
  const segment = 100 / phasePercents.length;
  return Math.round(
    phasePercents.reduce((sum, p) => sum + (p / 100) * segment, 0)
  );
}

const roadmapProjects = [];

const PROJECT_TYPE_ICONS = {
  web_app: Users,
  web_slash_app: Layers,
  mobile_app: Smartphone,
  integration: Wallet,
  platform: Boxes,
  internal_tool: BarChart3,
};

function projectToRoadmapRow(project) {
  const seed = roadmapProjects.find((r) => r.id === project.id);
  return {
    id: project.id,
    name: project.projectName,
    icon: seed?.icon ?? PROJECT_TYPE_ICONS[project.projectType] ?? FolderKanban,
    color: getProjectStageColor(project),
    progress: project.progress ?? calcProgress(project.phases) ?? 0,
    createdAt: project.createdAt,
  };
}

const seedProjects = () => [];

const PHASE_INFO_COLORS = {
  foundation: "#4f46e5",
  core: "#2563eb",
  integrations: "#7c3aed",
  scale: "#0d9488",
};

const PHASE_INFO_LABELS = {
  foundation: "P1",
  core: "P2",
  integrations: "P3",
  scale: "P4",
};

function computeProjectSummary(projects) {
  const activeProjects = filterActiveProjects(projects);
  const total = activeProjects.length;
  const onHoldProjectsDetails = getOnHoldProjectsDetails(activeProjects);
  const onHoldProjects = onHoldProjectsDetails.map((entry) => entry.project);
  const onHold = onHoldProjects.length;

  let tasksDone = 0;
  let tasksTotal = 0;
  let phasesComplete = 0;
  const phasesTotal = total * PHASE_DEFS.length;
  const phaseSums = Object.fromEntries(PHASE_DEFS.map((def) => [def.id, 0]));
  let totalElapsedMs = 0;

  for (const project of activeProjects) {
    const { done, total: taskCount } = countProjectTasks(project);
    tasksDone += done;
    tasksTotal += taskCount;
    totalElapsedMs += getProjectElapsedMs(project);

    const phases = ensurePhases(project.phases);
    for (const def of PHASE_DEFS) {
      const phase = phases[def.id];
      const completion = phase?.completion ?? 0;
      phaseSums[def.id] += completion;
      if (completion >= 100 || phase?.status === "completed") {
        phasesComplete += 1;
      }
    }
  }

  const getProgress = (p) => p.progress ?? calcProgress(p.phases);
  const onTrack = activeProjects.filter((p) => !isProjectOnHold(p) && getProgress(p) >= 40).length;
  const atRiskProjects = getAtRiskProjects(activeProjects);
  const atRisk = atRiskProjects.length;
  const overallProgress = total
    ? Math.round(activeProjects.reduce((sum, p) => sum + getProgress(p), 0) / total)
    : 0;

  const phaseBreakdown = PHASE_DEFS.map((def) => ({
    id: def.id,
    label: def.shortLabel,
    short: PHASE_INFO_LABELS[def.id],
    color: PHASE_INFO_COLORS[def.id],
    progress: total ? Math.round(phaseSums[def.id] / total) : 0,
  }));

  const projectSnapshots = activeProjects
    .map((p) => {
      const priority = p.priority ?? "medium";
      const priorityMeta = getProjectPriorityMeta(priority);
      return {
        id: p.id,
        name: p.projectName,
        progress: getProgress(p),
        color: getProjectStageColor(p),
        onHold: isProjectOnHold(p),
        priority,
        priorityLabel: priorityMeta.label,
        priorityColor: priorityMeta.color,
      };
    })
    .sort(compareProjectsByPriority)
    .slice(0, 4);

  return {
    total,
    onTrack,
    atRisk,
    onHold,
    onHoldProjects,
    onHoldProjectsDetails,
    atRiskProjects,
    overallProgress,
    tasksDone,
    tasksTotal,
    taskCompletionPct: tasksTotal ? Math.round((tasksDone / tasksTotal) * 100) : 0,
    phasesComplete,
    phasesTotal,
    phaseBreakdown,
    totalElapsedMs,
    projectSnapshots,
  };
}

const workloadSparkline = [
  { v: 62 }, { v: 68 }, { v: 65 }, { v: 70 }, { v: 72 }, { v: 69 }, { v: 72 },
];

const mobileNavItems = [
  { id: "dashboard", icon: LayoutDashboard, label: "Home" },
  { id: "roadmap", icon: MapIcon, label: "Roadmap" },
  { id: "tasks", icon: CheckSquare, label: "Tasks" },
  { id: "calendar", icon: Calendar, label: "Calendar" },
  { id: "projects", icon: FolderKanban, label: "Projects" },
];

// ─── UI Primitives ─────────────────────────────────────────────────────────────

function Card({ children, className, title, titleClassName, action, subtitle, compact }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white shadow-sm",
        compact ? "p-4" : "p-5",
        className
      )}
    >
      {(title || action) && (
        <div className={cn("flex items-start justify-between gap-2", compact ? "mb-3" : "mb-4")}>
          <div>
            {title && (
              <h3 className={cn("text-sm font-semibold text-slate-900", titleClassName)}>{title}</h3>
            )}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}


// ─── Layout ────────────────────────────────────────────────────────────────────

const CURRENT_USER = {
  name: "Enis",
  role: "Product Manager",
  avatarUrl: PROFILE_ENIS_URL,
};

function BrandLogo({ className }) {
  return (
    <img
      src={LOGO_URL}
      alt="Over Drive"
      className={cn("w-auto max-w-full object-contain object-left", className)}
    />
  );
}

function ProfileMenu({ onNavigate }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handleClickOutside = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleSelect = (section) => {
    onNavigate("settings", { section });
    setOpen(false);
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex w-full items-center gap-3 rounded-lg border border-slate-100 p-3 text-left transition hover:border-slate-200 hover:bg-slate-50"
      >
        <img
          src={CURRENT_USER.avatarUrl}
          alt={CURRENT_USER.name}
          className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-white"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{CURRENT_USER.name}</p>
          <p className="truncate text-xs text-slate-500">{CURRENT_USER.role}</p>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-slate-400 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute bottom-full left-0 right-0 z-20 mb-1 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => handleSelect("account")}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <User className="h-4 w-4 shrink-0 text-slate-500" />
            Account
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => handleSelect("profile")}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <Settings className="h-4 w-4 shrink-0 text-slate-500" />
            Settings
          </button>
        </div>
      )}
    </div>
  );
}

function Sidebar({ activePage, onNavigate }) {
  return (
    <aside className="scrollbar-hidden hidden h-full w-64 shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white px-3 pb-5 pt-0 lg:flex">
      <div className="-mt-3 mb-2 flex w-full justify-start bg-white px-0">
        <BrandLogo className="h-[12rem] w-full" />
      </div>

      <nav className="flex flex-col gap-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
              {item.label}
            </button>
          );
        })}

        <div className="mt-8 border-t border-slate-100 pt-6">
          <ProfileMenu onNavigate={onNavigate} />

          <button
            type="button"
            onClick={() => onNavigate("systems")}
            className={cn(
              "group relative mt-5 flex w-full items-center justify-center gap-1.5 overflow-hidden rounded-lg border px-2.5 py-1.5 text-xs font-semibold tracking-wide shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0",
              activePage === "systems"
                ? "border-sky-500 bg-gradient-to-br from-sky-200 via-blue-100 to-sky-100 text-sky-900 shadow-sky-300/50 ring-2 ring-sky-400/40"
                : "border-sky-200/80 bg-gradient-to-br from-sky-100 via-blue-100 to-sky-50 text-sky-900 hover:border-sky-400/70 hover:shadow-sky-300/40"
            )}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 -translate-x-full skew-x-12 bg-gradient-to-r from-transparent via-white/50 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-lg bg-sky-400/0 transition-colors duration-300 group-hover:bg-sky-400/15"
            />
            <Cpu className="relative h-3.5 w-3.5 shrink-0 text-sky-600 transition-colors duration-300 group-hover:text-sky-800" />
            <span className="relative">Systems</span>
          </button>
        </div>
      </nav>
    </aside>
  );
}

function MobileHeader() {
  return (
    <div className="flex shrink-0 items-center border-b border-slate-200 bg-white px-4 pb-2 pt-1 lg:hidden">
      <BrandLogo className="h-24 w-auto max-w-[14rem]" />
    </div>
  );
}

function DateTimeDisplay() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const formatted = now.toLocaleString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <p className="mt-0.5 text-sm text-slate-500 tabular-nums">{formatted}</p>
  );
}

function Header({ onOpenOnboarding, isBlankWorkspace }) {
  return (
    <header className="shrink-0 flex flex-col gap-4 border-b border-slate-200 bg-white px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
      <div>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
          Welcome back, {CURRENT_USER.name}!
        </h1>
        {isBlankWorkspace ? (
          <p className="mt-0.5 text-sm text-slate-500">
            Your workspace is empty — add a project to get started.
          </p>
        ) : (
          <DateTimeDisplay />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <button
          type="button"
          className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600"
        >
          <CalendarRange className="h-4 w-4 text-slate-400" />
          <span className="hidden sm:inline">May 12 – May 18, 2024</span>
          <span className="sm:hidden">May 2024</span>
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </button>
        <button
          type="button"
          aria-label="Search"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
        >
          <Search className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-red-500 ring-2 ring-white" />
        </button>
        <button
          type="button"
          onClick={onOpenOnboarding}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          New
        </button>
      </div>
    </header>
  );
}

function MobileNav({ activePage, onNavigate }) {
  return (
    <nav className="absolute bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-slate-200 bg-white px-2 py-2 lg:hidden">
      {mobileNavItems.map((item) => {
        const Icon = item.icon;
        const isActive = activePage === item.id;
        return (
          <button
            key={item.label}
            type="button"
            onClick={() => onNavigate(item.id)}
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-lg px-2 py-1",
              isActive ? "text-indigo-600" : "text-slate-400"
            )}
          >
            <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
            <span className="text-[9px] font-medium">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// ─── Roadmap Gantt ─────────────────────────────────────────────────────────────

function GanttChart({ projects, onUpdateProject, fullPage = false, onViewFullRoadmap, onProjectClick }) {
  const [progressProjectId, setProgressProjectId] = useState(null);
  const progressProject = projects.find((p) => p.id === progressProjectId);

  const handleProjectRowClick = (projectId) => {
    if (fullPage && onProjectClick) {
      onProjectClick(projectId);
      return;
    }
    setProgressProjectId(projectId);
  };

  const roadmapItems = filterActiveProjects(projects)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(projectToRoadmapRow);

  return (
    <Card
      compact
      title="Roadmap"
      titleClassName="text-xl font-extrabold tracking-tight"
      action={
        !fullPage &&
        onViewFullRoadmap && (
          <button
            type="button"
            onClick={onViewFullRoadmap}
            className="flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-700"
          >
            View Full Roadmap
            <ExternalLink className="h-3 w-3" />
          </button>
        )
      }
      className={cn("overflow-hidden", fullPage && "flex min-h-0 flex-1 flex-col")}
    >
      <div className={cn("relative overflow-x-auto", fullPage && "flex-1")}>
        <div className="min-w-[560px]">
          {/* Phase labels — timeline header only, no bar splits */}
          <div className="mb-2.5 grid grid-cols-[148px_1fr] gap-3">
            <div />
            <div className="grid grid-cols-4 gap-2 rounded-lg bg-slate-50/80 px-1 py-1">
              {phases.map((phase) => (
                <div key={phase.id} className="px-2 py-2 text-center">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    {phase.label.split(":")[0]}
                  </p>
                  <p className="text-sm font-bold leading-tight text-slate-800">{phase.shortLabel}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Project rows */}
          <div
            className={cn(
              "relative pr-1",
              fullPage
                ? "space-y-2.5"
                : "max-h-[280px] space-y-2.5 overflow-y-auto overflow-x-hidden"
            )}
          >
            <div className="space-y-2.5">
              {roadmapItems.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-slate-500">
                  No active projects on the roadmap. Completed projects are in the Projects archive.
                </p>
              ) : (
              roadmapItems.map((project) => {
                const Icon = project.icon;
                return (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => handleProjectRowClick(project.id)}
                    className="grid w-full grid-cols-[148px_1fr] items-center gap-3 rounded-lg px-1 py-0.5 text-left transition focus:outline-none focus:ring-2 focus:ring-offset-1"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = `${project.color}12`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "";
                    }}
                    title={fullPage ? "Jump to phase cards" : "Click to view tasks and progress"}
                  >
                    <div className="flex items-center gap-2 pr-1">
                      <div
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                        style={{ backgroundColor: `${project.color}18`, color: project.color }}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <span className="truncate text-sm font-medium text-slate-800">{project.name}</span>
                    </div>

                    <div className="relative">
                      <RoadmapProgressBar progress={project.progress} color={project.color} />
                    </div>
                  </button>
                );
              })
              )}
            </div>
          </div>
        </div>
      </div>

      {progressProject && onUpdateProject && !fullPage && (
        <ProjectProgressModal
          project={progressProject}
          onClose={() => setProgressProjectId(null)}
          onUpdate={(updated) => {
            onUpdateProject(updated);
          }}
        />
      )}
    </Card>
  );
}

function RoadmapPage({ projects, onUpdateProject }) {
  const activeProjects = useMemo(
    () =>
      filterActiveProjects(projects).sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      ),
    [projects]
  );

  const [expandedIds, setExpandedIds] = useState(() => new Set());

  useEffect(() => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      for (const id of [...next]) {
        if (!activeProjects.some((p) => p.id === id)) next.delete(id);
      }
      return next;
    });
  }, [activeProjects]);

  const toggleProject = (projectId) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedIds(new Set(activeProjects.map((p) => p.id)));
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  const scrollToProject = (projectId) => {
    setExpandedIds((prev) => new Set([...prev, projectId]));
    document
      .getElementById(`roadmap-project-${projectId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const allExpanded =
    activeProjects.length > 0 && activeProjects.every((p) => expandedIds.has(p.id));

  return (
    <div className="mx-auto max-w-[1600px] space-y-8">
      <GanttChart
        fullPage
        projects={projects}
        onUpdateProject={onUpdateProject}
        onProjectClick={scrollToProject}
      />

      <div className="space-y-4">
        {activeProjects.length > 0 && (
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={expandAll}
              disabled={allExpanded}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-default disabled:opacity-50"
            >
              Expand all
            </button>
            <button
              type="button"
              onClick={collapseAll}
              disabled={expandedIds.size === 0}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-default disabled:opacity-50"
            >
              Collapse all
            </button>
          </div>
        )}

        {activeProjects.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
            No active projects on the roadmap. Completed projects are in the Projects archive.
          </p>
        ) : (
          activeProjects.map((project) => {
            const color = getProjectStageColor(project);
            const progress = project.progress ?? calcProgress(project.phases);
            const { done, total } = countProjectTasks(project);
            const isExpanded = expandedIds.has(project.id);

            return (
              <section
                key={project.id}
                id={`roadmap-project-${project.id}`}
                className="scroll-mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                style={{ borderLeftWidth: 4, borderLeftColor: color }}
              >
                <button
                  type="button"
                  onClick={() => toggleProject(project.id)}
                  aria-expanded={isExpanded}
                  className="flex w-full flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 text-left transition hover:bg-slate-50/80 sm:px-5"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-2">
                    <ChevronDown
                      className={cn(
                        "mt-0.5 h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200",
                        !isExpanded && "-rotate-90"
                      )}
                    />
                    <div className="min-w-0">
                      <h2 className="text-base font-semibold text-slate-900">
                        {project.projectName}
                      </h2>
                      <p className="mt-0.5 text-sm text-slate-500">
                        {progress}% overall
                        {total > 0 && ` · ${done} of ${total} tasks`}
                      </p>
                    </div>
                  </div>
                  <div
                    className="w-full min-w-[200px] max-w-md flex-1 sm:ml-4 sm:w-auto"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    role="presentation"
                  >
                    <RoadmapProgressBar
                      progress={progress}
                      color={color}
                      heightClass="h-6"
                      variant="heatmap"
                    />
                  </div>
                </button>

                {isExpanded && (
                  <div className="p-4 sm:p-5">
                    <ProjectTaskChecklist
                      project={project}
                      embedded
                      zebraTaskRows
                      onUpdate={onUpdateProject}
                    />
                  </div>
                )}
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Widgets ───────────────────────────────────────────────────────────────────

function DashboardPage({
  projects,
  summary,
  onUpdateProject,
  onViewFullRoadmap,
  onViewAllTasks,
  onViewFullCalendar,
  onAddTask,
  onOpenFileManager,
  onOpenOnboarding,
}) {
  const isBlank = filterActiveProjects(projects).length === 0;

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      {isBlank && (
        <div className="rounded-2xl border border-dashed border-indigo-200 bg-gradient-to-br from-indigo-50/80 via-white to-sky-50/60 p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl">
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                Blank workspace
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                Your dashboard is ready
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                No demo projects, tasks, or calendar events — start fresh by creating your first
                project, then add tasks and milestones as you go.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={onOpenOnboarding}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" />
                Create first project
              </button>
              <button
                type="button"
                onClick={onAddTask}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <CheckSquare className="h-4 w-4" />
                Add a task
              </button>
            </div>
          </div>
        </div>
      )}
      <GanttChart
        projects={projects}
        onUpdateProject={onUpdateProject}
        onViewFullRoadmap={onViewFullRoadmap}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:auto-rows-[248px]">
        <ProgressDonut summary={summary} />
        <ProjectSummaryCard summary={summary} />
        <TeamWorkload summary={summary} />
        <UpcomingMilestones projects={projects} />
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <TaskList onViewAllTasks={onViewAllTasks} onAddTask={onAddTask} />
        <DashboardCalendarWidget onViewFullCalendar={onViewFullCalendar} projects={projects} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FileBinWidget onOpenFileManager={onOpenFileManager} />
      </div>
    </div>
  );
}

const DASHBOARD_WIDGET_HEIGHT = "h-[248px]";

function DashboardWidget({
  icon: Icon,
  title,
  subtitle,
  accent = "indigo",
  children,
  className,
  footer,
  scrollable = true,
}) {
  const accents = {
    indigo: {
      bar: "from-indigo-500 to-blue-500",
      icon: "bg-indigo-500/10 text-indigo-600 ring-indigo-500/15",
      glow: "shadow-indigo-500/5",
    },
    emerald: {
      bar: "from-emerald-500 to-teal-500",
      icon: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/15",
      glow: "shadow-emerald-500/5",
    },
    amber: {
      bar: "from-amber-500 to-orange-500",
      icon: "bg-amber-500/10 text-amber-600 ring-amber-500/15",
      glow: "shadow-amber-500/5",
    },
    violet: {
      bar: "from-violet-500 to-purple-500",
      icon: "bg-violet-500/10 text-violet-600 ring-violet-500/15",
      glow: "shadow-violet-500/5",
    },
  };
  const tone = accents[accent] ?? accents.indigo;

  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all hover:border-slate-300 hover:shadow-lg",
        DASHBOARD_WIDGET_HEIGHT,
        "max-h-[248px]",
        tone.glow,
        className
      )}
    >
      <div className={cn("h-1 w-full shrink-0 bg-gradient-to-r", tone.bar)} />
      <div className="flex min-h-0 flex-1 flex-col p-4">
        <div className="mb-3 flex shrink-0 items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset",
                tone.icon
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold tracking-tight text-slate-900">
                {title}
              </h3>
              {subtitle && (
                <p className="mt-0.5 truncate text-[11px] text-slate-500">{subtitle}</p>
              )}
            </div>
          </div>
        </div>
        <div
          className={cn(
            "min-h-0 flex-1",
            scrollable && "dashboard-widget-scroll"
          )}
        >
          {children}
        </div>
        {footer && <div className="mt-2 shrink-0 border-t border-slate-100 pt-2">{footer}</div>}
      </div>
    </div>
  );
}

function ProgressDonut({ summary }) {
  const progress = summary.overallProgress;
  const remaining = 100 - progress;
  const hasProjects = summary.total > 0;

  const data =
    !hasProjects || progress <= 0
      ? [{ name: "Remaining", value: 100 }]
      : progress >= 100
        ? [{ name: "Complete", value: 100 }]
        : [
            { name: "Complete", value: progress },
            { name: "Remaining", value: remaining },
          ];

  const status =
    !hasProjects
      ? { label: "No active projects", className: "bg-slate-100 text-slate-600 ring-slate-200" }
      : progress >= 60
        ? { label: "On track", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" }
        : progress >= 30
          ? { label: "In progress", className: "bg-indigo-50 text-indigo-700 ring-indigo-200" }
          : { label: "Getting started", className: "bg-slate-100 text-slate-600 ring-slate-200" };

  return (
    <DashboardWidget
      icon={Target}
      title="Overall Progress"
      subtitle={
        hasProjects
          ? `${summary.tasksDone}/${summary.tasksTotal} tasks · ${summary.phasesComplete}/${summary.phasesTotal} phases`
          : "Add a project to begin"
      }
      accent="indigo"
      scrollable
    >
      <div className="space-y-2.5 pb-1">
        <div className="flex gap-3">
          <div className="relative h-[88px] w-[88px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <defs>
                  <linearGradient id="overallDonutGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="50%" stopColor="#4f46e5" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={42}
                  startAngle={90}
                  endAngle={-270}
                  dataKey="value"
                  stroke="none"
                  cornerRadius={5}
                >
                  {data.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={
                        entry.name === "Complete"
                          ? "url(#overallDonutGrad)"
                          : "#e8edf3"
                      }
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold leading-none tabular-nums text-slate-900">
                {progress}
                <span className="text-sm font-semibold text-slate-400">%</span>
              </span>
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
            <span
              className={cn(
                "mb-0.5 inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset",
                status.className
              )}
            >
              {status.label}
            </span>
            {summary.phaseBreakdown.map((phase) => (
              <div key={phase.id} className="flex items-center gap-1.5">
                <span
                  className="w-5 shrink-0 text-center text-[9px] font-bold text-slate-500"
                  title={phase.label}
                >
                  {phase.short}
                </span>
                <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${phase.progress}%`, backgroundColor: phase.color }}
                  />
                </div>
                <span className="w-7 shrink-0 text-right text-[9px] font-bold tabular-nums text-slate-600">
                  {phase.progress}%
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <div className="rounded-lg bg-indigo-50/80 px-2 py-1.5 ring-1 ring-indigo-100">
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-indigo-500" />
              <p className="text-[9px] font-bold uppercase tracking-wide text-indigo-600/80">Tasks</p>
            </div>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-900">
              {summary.taskCompletionPct}%
            </p>
            <p className="text-[9px] text-slate-500">
              {summary.tasksDone}/{summary.tasksTotal} done
            </p>
          </div>
          <div className="rounded-lg bg-violet-50/80 px-2 py-1.5 ring-1 ring-violet-100">
            <div className="flex items-center gap-1">
              <Layers className="h-3 w-3 text-violet-500" />
              <p className="text-[9px] font-bold uppercase tracking-wide text-violet-600/80">Phases</p>
            </div>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-900">
              {summary.phasesTotal
                ? Math.round((summary.phasesComplete / summary.phasesTotal) * 100)
                : 0}
              %
            </p>
            <p className="text-[9px] text-slate-500">
              {summary.phasesComplete}/{summary.phasesTotal} complete
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 px-2 py-1.5 ring-1 ring-slate-100">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-slate-500" />
              <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Elapsed</p>
            </div>
            <p className="mt-0.5 truncate text-sm font-bold tabular-nums text-slate-900">
              {formatPhaseTimer(summary.totalElapsedMs)}
            </p>
            <p className="text-[9px] text-slate-500">Portfolio time</p>
          </div>
          <div className="rounded-lg bg-emerald-50/80 px-2 py-1.5 ring-1 ring-emerald-100">
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-emerald-500" />
              <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-600/80">On track</p>
            </div>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-900">
              {summary.onTrack}
              <span className="text-xs font-semibold text-slate-400">/{summary.total}</span>
            </p>
            <p className="text-[9px] text-slate-500">
              {summary.atRisk} at risk · {summary.onHold} hold
            </p>
          </div>
        </div>

        {summary.projectSnapshots.length > 0 && (
          <div className="rounded-xl bg-slate-50/90 p-2 ring-1 ring-slate-100">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                Top projects
              </p>
              <p className="text-[8px] font-medium text-slate-400">By priority</p>
            </div>
            <ul className="space-y-1.5">
              {summary.projectSnapshots.map((project) => (
                <li key={project.id} className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full ring-2 ring-white"
                    style={{ backgroundColor: project.onHold ? "#ef4444" : project.color }}
                  />
                  <span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-slate-700">
                    {project.name}
                  </span>
                  <span
                    className="shrink-0 rounded px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide ring-1 ring-inset"
                    style={{
                      color: project.priorityColor,
                      backgroundColor: `${project.priorityColor}12`,
                      borderColor: `${project.priorityColor}40`,
                    }}
                  >
                    {project.priorityLabel}
                  </span>
                  <div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-white ring-1 ring-slate-200/80">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-500"
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                  <span className="w-7 shrink-0 text-right text-[10px] font-bold tabular-nums text-slate-700">
                    {project.progress}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </DashboardWidget>
  );
}

function AtRiskDetailsModal({ atRiskProjects, onClose }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-labelledby="at-risk-modal-title"
        className="relative z-10 flex max-h-[min(85vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-amber-200/80 bg-white shadow-2xl shadow-amber-900/10"
      >
        <div className="shrink-0 border-b border-amber-100 bg-gradient-to-r from-amber-50 to-orange-50/80 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-800 ring-1 ring-amber-200/80">
                <AlertTriangle className="h-3.5 w-3.5" />
                At risk
              </div>
              <h2 id="at-risk-modal-title" className="text-lg font-bold text-slate-900">
                Projects & phases at risk
              </h2>
              <p className="mt-1 text-xs text-slate-600">
                {atRiskProjects.length === 0
                  ? "Nothing flagged right now (20–40% overall progress)."
                  : `${atRiskProjects.length} project${atRiskProjects.length === 1 ? "" : "s"} between 20–40% completion.`}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-white/80 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {atRiskProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <AlertTriangle className="mb-3 h-10 w-10 text-amber-300" />
              <p className="text-sm font-semibold text-slate-700">All clear</p>
              <p className="mt-1 max-w-xs text-xs text-slate-500">
                No active projects are in the at-risk progress band.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {atRiskProjects.map(({ project, progress, phases }) => {
                const stageColor = getProjectStageColor(project);
                return (
                  <li
                    key={project.id}
                    className="overflow-hidden rounded-xl border border-amber-100 bg-amber-50/30 ring-1 ring-amber-100/80"
                  >
                    <div className="flex items-center gap-2 border-b border-amber-100/80 bg-white/70 px-3 py-2.5">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white"
                        style={{ backgroundColor: stageColor }}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
                        {project.projectName}
                      </span>
                      <span className="shrink-0 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold tabular-nums text-amber-800">
                        {progress}%
                      </span>
                    </div>
                    <ul className="space-y-0 divide-y divide-amber-100/60 px-3 py-1">
                      {phases.map((phase) => (
                        <li key={phase.phaseId} className="py-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-800">{phase.label}</p>
                              <p className="mt-0.5 text-[11px] text-amber-800/90">{phase.riskReason}</p>
                            </div>
                            <span className="shrink-0 text-[11px] font-bold tabular-nums text-slate-500">
                              {phase.completion}%
                            </span>
                          </div>
                          {phase.taskTitles.length > 0 && (
                            <p className="mt-1 text-[10px] leading-snug text-slate-500">
                              Open: {phase.taskTitles.join(", ")}
                              {phase.extraTasks > 0 ? ` +${phase.extraTasks} more` : ""}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function OnHoldDetailsModal({ onHoldProjects, onClose }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-labelledby="on-hold-modal-title"
        className="relative z-10 flex max-h-[min(85vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-red-200/80 bg-white shadow-2xl shadow-red-900/10"
      >
        <div className="shrink-0 border-b border-red-100 bg-gradient-to-r from-red-50 to-rose-50/80 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-lg bg-red-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-red-800 ring-1 ring-red-200/80">
                <PauseCircle className="h-3.5 w-3.5" />
                On hold
              </div>
              <h2 id="on-hold-modal-title" className="text-lg font-bold text-slate-900">
                Projects & phases on hold
              </h2>
              <p className="mt-1 text-xs text-slate-600">
                {onHoldProjects.length === 0
                  ? "No phases are paused across the portfolio."
                  : `${onHoldProjects.length} project${onHoldProjects.length === 1 ? "" : "s"} with work on hold.`}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-white/80 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {onHoldProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <PauseCircle className="mb-3 h-10 w-10 text-red-300" />
              <p className="text-sm font-semibold text-slate-700">All clear</p>
              <p className="mt-1 max-w-xs text-xs text-slate-500">
                No projects have phases on hold right now.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {onHoldProjects.map(({ project, progress, phases }) => {
                const stageColor = getProjectStageColor(project);
                return (
                  <li
                    key={project.id}
                    className="overflow-hidden rounded-xl border border-red-100 bg-red-50/30 ring-1 ring-red-100/80"
                  >
                    <div className="flex items-center gap-2 border-b border-red-100/80 bg-white/70 px-3 py-2.5">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white"
                        style={{ backgroundColor: stageColor }}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
                        {project.projectName}
                      </span>
                      <span className="shrink-0 rounded-md bg-red-100 px-2 py-0.5 text-xs font-bold tabular-nums text-red-800">
                        {progress}%
                      </span>
                    </div>
                    <ul className="space-y-0 divide-y divide-red-100/60 px-3 py-1">
                      {phases.map((phase) => (
                        <li key={phase.phaseId} className="py-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-800">{phase.label}</p>
                              <p className="mt-0.5 text-[11px] text-red-800/90">Phase paused</p>
                            </div>
                            <span className="shrink-0 text-[11px] font-bold tabular-nums text-slate-500">
                              {phase.completion}%
                            </span>
                          </div>
                          {phase.taskTitles.length > 0 && (
                            <p className="mt-1 text-[10px] leading-snug text-slate-500">
                              On hold: {phase.taskTitles.join(", ")}
                              {phase.extraTasks > 0 ? ` +${phase.extraTasks} more` : ""}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function ProjectSummaryCard({ summary }) {
  const [atRiskModalOpen, setAtRiskModalOpen] = useState(false);
  const [onHoldModalOpen, setOnHoldModalOpen] = useState(false);

  const stats = [
    {
      id: "total",
      label: "Total",
      value: summary.total,
      icon: FolderKanban,
      tone: "bg-slate-100 text-slate-700 ring-slate-200",
      modal: null,
    },
    {
      id: "onTrack",
      label: "On Track",
      value: summary.onTrack,
      icon: TrendingUp,
      tone: "bg-emerald-50 text-emerald-700 ring-emerald-100",
      modal: null,
    },
    {
      id: "atRisk",
      label: "At Risk",
      value: summary.atRisk,
      icon: AlertTriangle,
      tone: "bg-amber-50 text-amber-700 ring-amber-100",
      modal: "atRisk",
    },
    {
      id: "onHold",
      label: "On Hold",
      value: summary.onHold,
      icon: PauseCircle,
      tone: "bg-red-50 text-red-700 ring-red-100",
      modal: "onHold",
    },
  ];

  return (
    <>
      <DashboardWidget
        icon={FolderKanban}
        title="Projects"
        subtitle={`${summary.total} active in portfolio`}
        accent="emerald"
      >
        <div className="shrink-0 grid grid-cols-2 gap-2">
          {stats.map((stat) => {
            const StatIcon = stat.icon;
            const Tag = stat.modal ? "button" : "div";
            const openModal =
              stat.modal === "atRisk"
                ? () => setAtRiskModalOpen(true)
                : stat.modal === "onHold"
                  ? () => setOnHoldModalOpen(true)
                  : undefined;
            return (
              <Tag
                key={stat.label}
                type={stat.modal ? "button" : undefined}
                onClick={openModal}
                className={cn(
                  "rounded-xl px-3 py-2.5 text-left ring-1 ring-inset transition group-hover:shadow-sm",
                  stat.tone,
                  stat.modal === "atRisk" &&
                    "cursor-pointer hover:ring-amber-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50",
                  stat.modal === "onHold" &&
                    "cursor-pointer hover:ring-red-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50"
                )}
              >
                <div className="mb-1 flex items-center justify-between">
                  <StatIcon className="h-3.5 w-3.5 opacity-70" />
                  <span className="text-lg font-bold tabular-nums leading-none">{stat.value}</span>
                </div>
                <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">
                  {stat.label}
                  {stat.modal && (
                    <span className="ml-1 font-medium normal-case tracking-normal opacity-70">
                      · view
                    </span>
                  )}
                </p>
              </Tag>
            );
          })}
        </div>

      {summary.onHoldProjects?.length > 0 ? (
        <div className="mt-3 shrink-0 rounded-xl border border-red-100 bg-red-50/50 p-2.5">
          <p className="mb-2 shrink-0 text-[10px] font-bold uppercase tracking-wide text-red-600">
            On hold now
          </p>
          <ul className="space-y-1.5">
            {summary.onHoldProjects.map((project) => {
              const stageColor = getProjectStageColor(project);
              return (
              <li
                key={project.id}
                className="flex items-start gap-2 rounded-lg bg-white/80 px-2 py-1.5 ring-1 ring-red-100/80"
              >
                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full ring-2 ring-white"
                  style={{ backgroundColor: stageColor }}
                />
                <span className="text-[11px] leading-snug text-slate-700">
                  {formatProjectOnHoldLabel(project)}
                </span>
              </li>
            );
            })}
          </ul>
        </div>
      ) : (
        <div className="mt-3 shrink-0 rounded-xl bg-slate-50 px-3 py-2.5 text-center ring-1 ring-slate-100">
          <p className="text-[11px] font-medium text-slate-500">No projects on hold</p>
        </div>
      )}
      </DashboardWidget>

      {atRiskModalOpen && (
        <AtRiskDetailsModal
          atRiskProjects={summary.atRiskProjects ?? []}
          onClose={() => setAtRiskModalOpen(false)}
        />
      )}
      {onHoldModalOpen && (
        <OnHoldDetailsModal
          onHoldProjects={summary.onHoldProjectsDetails ?? []}
          onClose={() => setOnHoldModalOpen(false)}
        />
      )}
    </>
  );
}

function TeamWorkload({ summary }) {
  const capacity = summary.overallProgress || 0;
  const balance =
    capacity >= 70
      ? { label: "Well balanced", color: "text-emerald-600", dot: "bg-emerald-500" }
      : capacity >= 40
        ? { label: "Moderate load", color: "text-amber-600", dot: "bg-amber-500" }
        : { label: "Light load", color: "text-slate-500", dot: "bg-slate-400" };

  if (summary.total === 0) {
    return (
      <DashboardWidget
        icon={Users}
        title="Team Workload"
        subtitle="Add projects to track capacity"
        accent="amber"
        scrollable={false}
      >
        <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-4 text-center">
          <Users className="mb-2 h-7 w-7 text-slate-300" />
          <p className="text-xs font-semibold text-slate-600">No workload yet</p>
          <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
            Team capacity appears once you have active projects
          </p>
        </div>
      </DashboardWidget>
    );
  }

  return (
    <DashboardWidget
      icon={Users}
      title="Team Workload"
      subtitle="Capacity across active work"
      accent="amber"
      scrollable={false}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-slate-900">
              {capacity}
              <span className="text-sm font-semibold text-slate-400">%</span>
            </p>
            <div className="mt-1 flex items-center gap-1.5">
              <span className={cn("h-2 w-2 rounded-full", balance.dot)} />
              <span className={cn("text-[11px] font-semibold", balance.color)}>
                {balance.label}
              </span>
            </div>
          </div>
          <div className="h-10 w-20 shrink-0 rounded-lg bg-amber-50/80 p-1 ring-1 ring-amber-100">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={workloadSparkline}>
                  <Line
                    type="monotone"
                    dataKey="v"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

        <div>
          <div className="mb-1 flex justify-between text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            <span>Capacity used</span>
            <span>{capacity}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/80">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500"
              style={{ width: `${capacity}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5 text-center">
          {[
            { label: "On track", value: summary.onTrack },
            { label: "At risk", value: summary.atRisk },
            { label: "On hold", value: summary.onHold },
          ].map((item) => (
            <div key={item.label} className="rounded-lg bg-slate-50 px-1 py-2 ring-1 ring-slate-100">
              <p className="text-sm font-bold tabular-nums text-slate-800">{item.value}</p>
              <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </DashboardWidget>
  );
}

function UpcomingMilestones({ projects }) {
  const { events: calendarEvents } = useCalendarEvents();
  const milestones = useMemo(
    () => getUpcomingMilestones(projects, { limit: 12, calendarEvents }),
    [projects, calendarEvents]
  );

  return (
    <DashboardWidget
      icon={CalendarDays}
      title="Upcoming Milestones"
      subtitle="Calendar events and project dates"
      accent="violet"
    >
      {milestones.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-4 text-center">
          <CalendarDays className="mb-2 h-7 w-7 text-slate-300" />
          <p className="text-xs font-semibold text-slate-600">No upcoming milestones</p>
          <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
            Add events on the calendar or set phase dates on projects
          </p>
        </div>
      ) : (
        <ul className="space-y-0">
          {milestones.map((m, index) => (
            <li key={m.id} className="relative flex gap-3 pb-3 last:pb-0">
              {index < milestones.length - 1 && (
                <span className="absolute left-[13px] top-7 bottom-0 w-px bg-violet-100" />
              )}
              <div
                className="relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-2 ring-white"
                style={{ backgroundColor: `${m.color}20`, color: m.color, boxShadow: `0 0 0 1px ${m.color}30` }}
              >
                <CalendarDays className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-800">{m.title}</p>
                    <p className="truncate text-[10px] text-slate-500">
                      {m.eventTypeLabel ? `${m.eventTypeLabel} · ${m.projectName}` : m.projectName}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span
                      className={cn(
                        "inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-bold",
                        m.daysAway <= 3
                          ? "bg-violet-100 text-violet-700"
                          : "bg-slate-100 text-slate-600"
                      )}
                    >
                      {m.daysAway === 0 ? "Today" : `${m.daysAway}d`}
                    </span>
                  </div>
                </div>
                <p className="mt-1 text-[10px] font-medium text-slate-400">{m.dateLabel}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </DashboardWidget>
  );
}

// ─── Tasks ─────────────────────────────────────────────────────────────────────

function TaskList({ onViewAllTasks, onAddTask }) {
  const { tasks } = useTasks();
  const [filter, setFilter] = useState("all");
  const [completedIds, setCompletedIds] = useState(
    () => new Set(tasks.filter((t) => t.completed).map((t) => t.id))
  );

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const isDone = completedIds.has(task.id);
      if (filter === "all") return true;
      if (filter === "done") return isDone;
      if (filter === "todo") return !isDone && task.status === "todo";
      if (filter === "in_progress") return !isDone && task.status === "in_progress";
      return true;
    });
  }, [tasks, filter, completedIds]);

  const toggleTask = (id) => {
    setCompletedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Card
      compact
      title="My Tasks"
      action={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onViewAllTasks}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
          >
            View All Tasks
          </button>
          <button
            type="button"
            onClick={onAddTask}
            className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Task
          </button>
        </div>
      }
      className="flex flex-col"
    >
      <div className="mb-3 flex gap-1 border-b border-slate-100">
        {TASK_STATUS_FILTERS.filter((f) => f.id !== "mine").map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              "border-b-2 px-3 py-2 text-xs font-medium transition",
              filter === f.id
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table header */}
      <div
        className="mb-2 hidden grid-cols-[24px_minmax(0,1.65fr)_minmax(0,1fr)_minmax(12rem,1.5fr)_minmax(4.5rem,0.75fr)_32px] items-center gap-4 px-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400 sm:grid"
      >
        <span />
        <span>Task</span>
        <span>Project</span>
        <span>Date</span>
        <span>Priority</span>
        <span className="text-center">Owner</span>
        <span />
      </div>

      <ul className="max-h-[260px] space-y-0.5 overflow-y-auto">
        {filteredTasks.length === 0 ? (
          <li className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-10 text-center">
            <CheckSquare className="mb-2 h-7 w-7 text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">No tasks yet</p>
            <p className="mt-1 text-xs text-slate-400">
              Create a task or add tasks inside a project
            </p>
          </li>
        ) : (
        filteredTasks.map((task) => {
          const isDone = completedIds.has(task.id);
          return (
            <li
              key={task.id}
              className={cn(
                "grid grid-cols-[24px_1fr] items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-slate-50 sm:grid-cols-[24px_minmax(0,1.65fr)_minmax(0,1fr)_minmax(12rem,1.5fr)_minmax(4.5rem,0.75fr)_32px] sm:gap-4 sm:py-3",
                isDone && "opacity-70"
              )}
            >
              <button
                type="button"
                onClick={() => toggleTask(task.id)}
                aria-label={isDone ? "Mark incomplete" : "Mark complete"}
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition",
                  isDone
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-slate-300 hover:border-indigo-400"
                )}
              >
                {isDone && <Check className="h-3 w-3" strokeWidth={3} />}
              </button>

              <div className="flex min-w-0 items-center gap-1.5">
                <p
                  className={cn(
                    "min-w-0 truncate text-sm text-slate-800",
                    isDone && "line-through text-slate-500"
                  )}
                >
                  {task.title}
                </p>
                <TaskDreamboardIcon task={task} className="h-3 w-3" />
                {task.attachments?.length > 0 ? (
                  <Paperclip
                    className="h-3 w-3 shrink-0 text-indigo-500"
                    title={`${task.attachments.length} attachment${task.attachments.length === 1 ? "" : "s"}`}
                    aria-label={`${task.attachments.length} attachment${task.attachments.length === 1 ? "" : "s"}`}
                  />
                ) : null}
              </div>

              <span
                className="hidden min-w-0 truncate rounded-full px-2 py-0.5 text-[10px] font-medium sm:inline-block"
                style={{ backgroundColor: `${task.projectColor}15`, color: task.projectColor }}
              >
                {task.project || "—"}
              </span>

              <div className="hidden sm:block">
                <TaskDueDisplay task={task} />
              </div>

              <span className={cn("hidden shrink-0 text-xs font-medium capitalize sm:inline", PRIORITY_TEXT_STYLES[task.priority])}>
                {task.priority}
              </span>

              <div
                className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white sm:flex"
                style={{ backgroundColor: task.assignee.color }}
                title={task.assignee.name}
              >
                {task.assignee.initials}
              </div>
            </li>
          );
        })
        )}
      </ul>

      <button
        type="button"
        onClick={onAddTask}
        className="mt-3 flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
      >
        <Plus className="h-3.5 w-3.5" />
        Add Task
      </button>
    </Card>
  );
}

// ─── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const initialRoute = readPageFromHash();
  const [activePage, setActivePage] = useState(initialRoute.page);
  const [settingsSection, setSettingsSection] = useState(initialRoute.settingsSection);
  const [projectsListKey, setProjectsListKey] = useState(0);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [openAddTaskOnMount, setOpenAddTaskOnMount] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [projects, setProjects] = useState(() =>
    ensureUniqueProjectColors(
      loadProjectBin(seedProjects).projects.map(normalizeProject)
    ).map(normalizeProject)
  );

  const summary = useMemo(() => computeProjectSummary(projects), [projects]);
  const isBlankWorkspace = filterActiveProjects(projects).length === 0;

  useEffect(() => {
    saveProjectBin(projects);
  }, [projects]);

  useEffect(() => {
    writePageToHash(activePage, {
      section: activePage === "settings" ? settingsSection : undefined,
    });
  }, [activePage, settingsSection]);

  useEffect(() => {
    const onHashChange = () => {
      const route = readPageFromHash();
      setActivePage(route.page);
      setSettingsSection(route.settingsSection);
    };

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const openOnboarding = () => {
    setEditingProject(null);
    clearOnboardingDraft();
    setOnboardingOpen(true);
  };
  const closeOnboarding = () => {
    setOnboardingOpen(false);
    setEditingProject(null);
  };

  const handleEditProject = (project) => {
    setEditingProject(project);
    setOnboardingOpen(true);
  };

  const handleDeleteProject = (projectId) => {
    const project = projects.find((p) => p.id === projectId);
    const name = project?.projectName ?? "this project";
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
  };

  const handleAddTask = () => {
    setOpenAddTaskOnMount(true);
    setActivePage("tasks");
  };

  const handleNavigate = (pageId, options = {}) => {
    if (pageId === "dashboard") {
      setActivePage("dashboard");
      return;
    }
    if (pageId === "roadmap") {
      setActivePage("roadmap");
      requestAnimationFrame(() => {
        document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" });
      });
      return;
    }
    if (pageId === "tasks") {
      setActivePage("tasks");
      requestAnimationFrame(() => {
        document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" });
      });
      return;
    }
    if (pageId === "calendar") {
      setActivePage("calendar");
      requestAnimationFrame(() => {
        document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" });
      });
      return;
    }
    if (pageId === "reports") {
      setActivePage("reports");
      requestAnimationFrame(() => {
        document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" });
      });
      return;
    }
    if (pageId === "team") {
      setActivePage("team");
      requestAnimationFrame(() => {
        document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" });
      });
      return;
    }
    if (pageId === "messages") {
      setActivePage("messages");
      requestAnimationFrame(() => {
        document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" });
      });
      return;
    }
    if (pageId === "file-manager") {
      setActivePage("file-manager");
      requestAnimationFrame(() => {
        document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" });
      });
      return;
    }
    if (pageId === "dreamboard") {
      setActivePage("dreamboard");
      requestAnimationFrame(() => {
        document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" });
      });
      return;
    }
    if (pageId === "settings") {
      setSettingsSection(options.section ?? "profile");
      setActivePage("settings");
      requestAnimationFrame(() => {
        document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" });
      });
      return;
    }
    if (pageId === "systems") {
      setActivePage("systems");
      requestAnimationFrame(() => {
        document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" });
      });
      return;
    }
    if (pageId === "projects") {
      setActivePage("projects");
      setProjectsListKey((key) => key + 1);
    }
  };

  const handleViewCompletedProjects = () => {
    setActivePage("completed-projects");
  };

  const handleProjectReactivated = () => {
    setActivePage("projects");
    setProjectsListKey((key) => key + 1);
  };

  const handleProjectCreated = (project) => {
    setProjects((prev) => [
      normalizeProject({
        ...project,
        color: project.color ?? generateProjectStageColor(prev.map((p) => p.color)),
      }),
      ...prev,
    ]);
    setActivePage("dashboard");
  };

  const handleOnboardingSubmit = (project, { isEditing } = {}) => {
    if (isEditing) {
      handleUpdateProject(
        normalizeProject({ ...project, color: getProjectStageColor(project) })
      );
      return;
    }
    handleProjectCreated(project);
  };

  const handleUpdateProject = (updated) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === updated.id ? normalizeProject(updated) : p))
    );
  };

  return (
    <LoadingProvider activePage={activePage}>
    <WorkspaceSettingsProvider>
    <TeamProvider>
    <TasksProvider>
    <FilesProvider projects={projects} onProjectsChange={setProjects}>
    <CalendarEventsProvider>
    <div className="app-viewport-shell">
      <div className="app-dashboard-card">
    <div className="flex h-full overflow-hidden bg-slate-50">
      <Sidebar
        activePage={activePage === "completed-projects" ? "projects" : activePage}
        onNavigate={handleNavigate}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <MobileHeader />
        {activePage === "dashboard" && (
          <Header onOpenOnboarding={openOnboarding} isBlankWorkspace={isBlankWorkspace} />
        )}

        <main
          className={cn(
            "scrollbar-hidden min-h-0 flex-1 p-4 pb-20 sm:p-5 lg:pb-6 lg:p-6",
            activePage === "dreamboard"
              ? "flex flex-col overflow-hidden"
              : "overflow-y-auto"
          )}
        >
          <div
            key={activePage}
            className={cn(
              "page-content-enter",
              activePage === "dreamboard" && "flex min-h-0 flex-1 flex-col"
            )}
          >
          {activePage === "dashboard" ? (
            <DashboardPage
              projects={projects}
              summary={summary}
              onUpdateProject={handleUpdateProject}
              onViewFullRoadmap={() => handleNavigate("roadmap")}
              onViewAllTasks={() => handleNavigate("tasks")}
              onViewFullCalendar={() => handleNavigate("calendar")}
              onAddTask={handleAddTask}
              onOpenFileManager={() => handleNavigate("file-manager")}
              onOpenOnboarding={openOnboarding}
            />
          ) : activePage === "roadmap" ? (
            <RoadmapPage projects={projects} onUpdateProject={handleUpdateProject} />
          ) : activePage === "tasks" ? (
            <TasksPage
              projects={projects}
              openAddOnMount={openAddTaskOnMount}
              onAddMountHandled={() => setOpenAddTaskOnMount(false)}
            />
          ) : activePage === "calendar" ? (
            <CalendarPage projects={projects} />
          ) : activePage === "reports" ? (
            <ReportsPage projects={projects} />
          ) : activePage === "team" ? (
            <TeamPage projects={projects} />
          ) : activePage === "messages" ? (
            <MessagesPage />
          ) : activePage === "file-manager" ? (
            <FileManagerPage />
          ) : activePage === "dreamboard" ? (
            <DreamboardPage />
          ) : activePage === "settings" ? (
            <SettingsPage key={settingsSection} initialSection={settingsSection} />
          ) : activePage === "systems" ? (
            <SystemsPage />
          ) : activePage === "completed-projects" ? (
            <CompletedProjectsPage
              projects={projects}
              onBack={() => setActivePage("projects")}
              onUpdateProject={handleUpdateProject}
              onEditProject={handleEditProject}
              onDeleteProject={handleDeleteProject}
              onProjectReactivated={handleProjectReactivated}
            />
          ) : (
            <ProjectsPage
              key={projectsListKey}
              projects={projects}
              onNewProject={openOnboarding}
              onUpdateProject={handleUpdateProject}
              onEditProject={handleEditProject}
              onDeleteProject={handleDeleteProject}
              onViewCompleted={handleViewCompletedProjects}
            />
          )}
          </div>
        </main>
      </div>

      <MobileNav
        activePage={activePage === "completed-projects" ? "projects" : activePage}
        onNavigate={handleNavigate}
      />

      <NewProjectOnboarding
        open={onboardingOpen}
        onClose={closeOnboarding}
        onSubmit={handleOnboardingSubmit}
        editingProject={editingProject}
        projects={projects}
      />
    </div>
      </div>
    </div>
    </CalendarEventsProvider>
    </FilesProvider>
    </TasksProvider>
    </TeamProvider>
    </WorkspaceSettingsProvider>
    </LoadingProvider>
  );
}
