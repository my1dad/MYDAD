import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  BarChart3,
  Boxes,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronRight,
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
  Pie,
  PieChart,
  ResponsiveContainer,
} from "recharts";
import { LoadingProvider } from "./context/LoadingContext";
import DashboardPreloaderOverlay from "./components/ui/DashboardPreloaderOverlay";
import { useRoadmapAuth } from "./context/RoadmapAuthContext";
import { getRoadmapProfileFullName, getRoadmapProfileRole } from "./data/roadmapProfileStorage";
import RoadmapProfileAvatar from "./components/roadmap/RoadmapProfileAvatar";
import { CalendarEventsProvider, useCalendarEvents } from "./context/CalendarEventsContext";
import { DeletedItemsProvider } from "./context/DeletedItemsContext";
import CalendarTasksSync from "./components/tasks/CalendarTasksSync";
import DashboardHeaderSearch from "./components/search/DashboardHeaderSearch";
import DashboardAlertsButton from "./components/dashboard/DashboardAlertsButton";
import RecentActivityCard from "./components/dashboard/RecentActivityCard";
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
import { RoadmapAccountContent } from "./pages/roadmap/RoadmapAccount";
import SystemsPage from "./components/systems/SystemsPage";
import FileBinWidget from "./components/file-manager/FileBinWidget";
import FileManagerPage from "./components/file-manager/FileManagerPage";
import DreamboardPage from "./components/dreamboard/DreamboardPage";
import TaskDueDisplay from "./components/tasks/TaskDueDisplay";
import TaskDreamboardIcon from "./components/tasks/TaskDreamboardIcon";
import AddTaskModal from "./components/tasks/AddTaskModal";
import TaskDetailModal from "./components/tasks/TaskDetailModal";
import { TASK_STATUS_FILTERS, canCompleteTask, getPreTaskToggleUpdates, getTaskPreTasks, isTaskComplete } from "./data/tasksData";
import { useSyncedTeamWorkload } from "./hooks/useSyncedTeamWorkload";
import ProjectProgressModal from "./components/projects/ProjectProgressModal";
import ProjectsPage from "./components/projects/ProjectsPage";
import CompletedProjectsPage from "./components/projects/CompletedProjectsPage";
import ProjectTaskChecklist from "./components/projects/ProjectTaskChecklist";
import RoadmapProgressBar from "./components/roadmap/RoadmapProgressBar";
import { LOGO_URL } from "./lib/assetUrl";
import { isTaskAssignedToUser } from "./data/teamData";
import { PROJECT_TEMPLATE_MODES } from "./data/uiUxRoadmapTemplate";
import { useCurrentUser } from "./hooks/useCurrentUser";
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
import { logWorkspaceActivity } from "./lib/workspaceActivityLog";
import { archiveDeletedItem } from "./lib/deletedItemsStorage";
import {
  isCalendarEventTask,
  taskUpdateToCalendarEventFields,
} from "./lib/calendarTasksSync";

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
  { id: "settings", label: "Settings", icon: Settings },
];

const phases = [
  { id: "foundation", label: "Phase 1: Foundation", shortLabel: "Foundation" },
  { id: "core", label: "Phase 2: Core Features", shortLabel: "Core Features" },
  { id: "integrations", label: "Phase 3: Integrations", shortLabel: "Integrations" },
  { id: "scale", label: "Phase 4: Scale & Optimize", shortLabel: "Scale & Optimize" },
];

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

const seedProjects = () => [];

const mobileNavItems = [
  { id: "dashboard", icon: LayoutDashboard, label: "Home" },
  { id: "roadmap", icon: MapIcon, label: "Roadmap" },
  { id: "tasks", icon: CheckSquare, label: "Tasks" },
  { id: "calendar", icon: Calendar, label: "Calendar" },
];

const mobileMoreNavItems = [
  { id: "projects", icon: FolderKanban, label: "Projects" },
  { id: "file-manager", icon: FolderOpen, label: "Files" },
  { id: "team", icon: Users, label: "Team" },
  { id: "messages", icon: MessageSquare, label: "Messages" },
  { id: "reports", icon: BarChart3, label: "Reports" },
  { id: "dreamboard", icon: Sparkles, label: "Dreamboard" },
  { id: "systems", icon: Cpu, label: "Systems" },
  { id: "settings", icon: Settings, label: "Settings" },
  { id: "account", icon: User, label: "Account" },
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

function useAppUser() {
  const { profile } = useRoadmapAuth();
  if (!profile) {
    return {
      name: "User",
      role: "",
      username: "",
      profilePicture: null,
      avatarUrl: null,
    };
  }
  return {
    name:
      getRoadmapProfileFullName(profile, { fallbackToUsername: false }) ||
      `@${profile.username}`,
    role: getRoadmapProfileRole(profile),
    username: profile.username,
    profilePicture: profile.profilePicture,
    avatarUrl: profile.profilePicture ?? null,
  };
}

function BrandLogo({ className }) {
  return (
    <img
      src={LOGO_URL}
      alt="Over Drive"
      className={cn("w-auto max-w-full object-contain object-left", className)}
    />
  );
}

function ProfileMenu({ onNavigate, onLogout, user }) {
  const { profile } = useRoadmapAuth();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  const workspaceLabel = profile?.workspaceName?.trim() || "Workspace name";

  const openMenu = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.top, left: rect.right });
    }
    setOpen(true);
  };

  return (
    <div
      ref={triggerRef}
      className="relative"
      onMouseEnter={openMenu}
      onMouseLeave={() => setOpen(false)}
    >
      {open && (
        <div
          className="fixed z-[100] min-w-[10.5rem] pl-1"
          style={{ top: menuPos.top, left: menuPos.left }}
        >
          <div
            role="menu"
            className="overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onNavigate("account");
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <User className="h-4 w-4 shrink-0 text-slate-500" />
              Account
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onLogout?.();
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
            >
              Log out
            </button>
          </div>
        </div>
      )}

      <div
        aria-expanded={open}
        aria-haspopup="menu"
        className="w-full rounded-lg border border-slate-200 p-3 text-left transition hover:border-slate-300 hover:bg-slate-50/80"
      >
        <div className="flex items-start gap-3">
          {user.username ? (
            <RoadmapProfileAvatar
              username={user.username}
              profilePicture={user.profilePicture}
              size="sm"
            />
          ) : (
            <RoadmapProfileAvatar
              username={user.name}
              profilePicture={user.profilePicture}
              size="sm"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-slate-900">{user.name}</p>
            {user.role ? (
              <p className="truncate text-[11px] text-slate-500">{user.role}</p>
            ) : null}
            <p className="mt-0.5 truncate text-[11px] text-slate-500">{workspaceLabel}</p>
          </div>
          <ChevronRight
            aria-hidden
            className={cn(
              "mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform",
              open && "translate-x-0.5 text-slate-600"
            )}
          />
        </div>
      </div>
    </div>
  );
}

function Sidebar({ activePage, onNavigate, onLogout, user }) {
  return (
    <aside className="scrollbar-hidden hidden h-full w-64 shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white px-3 pb-5 pt-0 lg:flex">
      <div className="-mt-3 mb-2 flex w-full justify-start bg-white px-0">
        <BrandLogo className="h-[12rem] w-full" />
      </div>

      <nav className="flex flex-1 flex-col gap-0.5">
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
          <ProfileMenu
            onNavigate={onNavigate}
            onLogout={onLogout}
            user={user}
          />

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

      <p className="mt-auto w-full px-3 pt-4 text-center text-[11px] text-slate-400">
        Powered by:{" "}
        <a
          href="https://source-57x6rrvbz-over-drive0s-projects.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-indigo-600 transition-colors hover:text-indigo-700 hover:underline"
        >
          overdriveOS
        </a>
      </p>
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
    const tick = () => setNow(new Date());
    tick();

    const msUntilNextMinute = (60 - new Date().getSeconds()) * 1000;
    let intervalId;

    const timeoutId = window.setTimeout(() => {
      tick();
      intervalId = window.setInterval(tick, 60_000);
    }, msUntilNextMinute);

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId) window.clearInterval(intervalId);
    };
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

function Header({ onOpenOnboarding, userName, projects, onNavigate }) {
  return (
    <header className="shrink-0 flex flex-col gap-4 border-b border-slate-200 bg-white px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
      <div>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
          Welcome back, {userName}!
        </h1>
        <DateTimeDisplay />
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <DashboardHeaderSearch projects={projects} onNavigate={onNavigate} />
        <DashboardAlertsButton onNavigate={onNavigate} />
        <button
          type="button"
          onClick={onOpenOnboarding}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          New
        </button>
      </div>
    </header>
  );
}

function MobileNav({ activePage, onNavigate }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = mobileMoreNavItems.some((item) => item.id === activePage);

  useEffect(() => {
    if (!moreOpen) return undefined;
    const onPointerDown = () => setMoreOpen(false);
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [moreOpen]);

  return (
    <>
      {moreOpen ? (
        <div
          className="absolute inset-0 z-40 bg-slate-900/20 lg:hidden"
          onMouseDown={() => setMoreOpen(false)}
        />
      ) : null}
      <nav className="absolute bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white px-2 py-2 lg:hidden">
        <div className="flex items-center justify-around">
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
          <div className="relative">
            <button
              type="button"
              aria-expanded={moreOpen}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={() => setMoreOpen((open) => !open)}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-lg px-2 py-1",
                moreOpen || moreActive ? "text-indigo-600" : "text-slate-400"
              )}
            >
              <Boxes className="h-5 w-5" strokeWidth={moreOpen || moreActive ? 2.5 : 2} />
              <span className="text-[9px] font-medium">More</span>
            </button>
            {moreOpen ? (
              <div
                className="absolute bottom-full right-0 z-50 mb-2 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
                onMouseDown={(event) => event.stopPropagation()}
              >
                {mobileMoreNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activePage === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onNavigate(item.id);
                        setMoreOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm font-medium transition",
                        isActive
                          ? "bg-indigo-50 text-indigo-700"
                          : "text-slate-700 hover:bg-slate-50"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </nav>
    </>
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

function NewProjectMenuButton({ onNewProject }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  const updateMenuPosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const menuWidth = 208;
    const menuHeight = PROJECT_TEMPLATE_MODES.length * 44 + 8;
    const gap = 6;
    let top = rect.bottom + gap;

    if (top + menuHeight > window.innerHeight - 8) {
      top = Math.max(8, rect.top - menuHeight - gap);
    }

    const left = Math.min(
      Math.max(8, rect.right - menuWidth),
      window.innerWidth - menuWidth - 8
    );

    setMenuStyle({
      position: "fixed",
      top,
      left,
      width: menuWidth,
      zIndex: 300,
    });
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;

    updateMenuPosition();
    const onScrollOrResize = () => updateMenuPosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [menuOpen, updateMenuPosition]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onPointerDown = (event) => {
      if (
        buttonRef.current?.contains(event.target) ||
        menuRef.current?.contains(event.target)
      ) {
        return;
      }
      setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [menuOpen]);

  const pick = (templateMode) => {
    onNewProject(templateMode);
    setMenuOpen(false);
  };

  const toggleMenu = () => {
    setMenuOpen((open) => {
      const next = !open;
      if (next) {
        requestAnimationFrame(updateMenuPosition);
      }
      return next;
    });
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleMenu}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700"
      >
        <Plus className="h-4 w-4" />
        New project
        <ChevronDown className={cn("h-4 w-4 transition", menuOpen && "rotate-180")} />
      </button>
      {menuOpen && menuStyle
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={menuStyle}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
            >
              {PROJECT_TEMPLATE_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  role="menuitem"
                  onClick={() => pick(mode.id)}
                  className="flex w-full px-4 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-800"
                >
                  {mode.label}
                </button>
              ))}
            </div>,
            document.body
          )
        : null}
    </>
  );
}

function RoadmapPage({ projects, onUpdateProject, onNewProject }) {
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
      <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-indigo-50/40 p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="mb-3 inline-flex items-center gap-2 rounded-xl bg-indigo-500/10 px-4 py-2 text-base font-bold text-indigo-700 ring-1 ring-indigo-500/15">
              <MapIcon className="h-5 w-5" />
              Roadmap
            </div>
            <p className="max-w-xl text-sm font-semibold text-slate-600">
              Gantt timeline and phase tasks across active projects.
            </p>
          </div>
          <div className="shrink-0 self-start sm:self-center">
            <NewProjectMenuButton onNewProject={onNewProject} />
          </div>
        </div>
      </div>

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
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center">
            <MapIcon className="mb-3 h-8 w-8 text-slate-300" />
            <p className="text-sm font-semibold text-slate-700">No active projects on the roadmap</p>
            <p className="mt-1 max-w-sm text-xs text-slate-500">
              Completed projects are in the Projects archive. Start a blank project or use the UI/UX
              template.
            </p>
            <div className="mt-4">
              <NewProjectMenuButton onNewProject={onNewProject} />
            </div>
          </div>
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

const DASHBOARD_WIDGET_HEIGHT = "h-[248px]";

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
  const teamWorkload = useSyncedTeamWorkload(projects);

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
        <TeamWorkload workload={teamWorkload} />
        <UpcomingMilestones projects={projects} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:auto-rows-[248px]">
        <div
          className={cn(
            DASHBOARD_WIDGET_HEIGHT,
            "min-h-0 overflow-hidden lg:col-start-1 lg:row-start-1"
          )}
        >
          <TaskList projects={projects} onViewAllTasks={onViewAllTasks} onAddTask={onAddTask} />
        </div>
        <div
          className={cn(
            DASHBOARD_WIDGET_HEIGHT,
            "min-h-0 overflow-hidden lg:col-start-1 lg:row-start-2"
          )}
        >
          <FileBinWidget onOpenFileManager={onOpenFileManager} />
        </div>
        <div
          className={cn(
            DASHBOARD_WIDGET_HEIGHT,
            "min-h-0 overflow-hidden lg:col-span-2 lg:row-span-2 lg:col-start-2 lg:row-start-1 lg:h-auto"
          )}
        >
          <DashboardCalendarWidget
            onViewFullCalendar={onViewFullCalendar}
            projects={projects}
            className="flex h-full flex-col"
          />
        </div>
      </div>

      <RecentActivityCard />
    </div>
  );
}

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

function TeamWorkload({ workload }) {
  const capacity = workload.avgWorkload || 0;
  const balance =
    capacity >= 80
      ? { label: "High load", color: "text-red-600", dot: "bg-red-500" }
      : capacity >= 60
        ? { label: "Moderate load", color: "text-amber-600", dot: "bg-amber-500" }
        : capacity >= 40
          ? { label: "Balanced", color: "text-emerald-600", dot: "bg-emerald-500" }
          : { label: "Light load", color: "text-slate-500", dot: "bg-slate-400" };

  const hasTrackedWork =
    workload.rows.length > 0 &&
    (workload.totalOpenTasks > 0 || workload.totalOpenJobs > 0 || capacity > 0);

  if (!hasTrackedWork) {
    return (
      <DashboardWidget
        icon={Users}
        title="Team Workload"
        subtitle="Synced from tasks and project jobs"
        accent="amber"
        scrollable={false}
      >
        <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-4 text-center">
          <Users className="mb-2 h-7 w-7 text-slate-300" />
          <p className="text-xs font-semibold text-slate-600">No workload yet</p>
          <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
            Assign tasks or add project jobs to track team capacity
          </p>
        </div>
      </DashboardWidget>
    );
  }

  return (
    <DashboardWidget
      icon={Users}
      title="Team Workload"
      subtitle="Synced from tasks and project jobs"
      accent="amber"
      scrollable
    >
      <div className="flex flex-col gap-3">
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

        <div>
          <div className="mb-1 flex justify-between text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            <span>Team capacity used</span>
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
            { label: "Tasks", value: workload.totalOpenTasks },
            { label: "Jobs", value: workload.totalOpenJobs },
            { label: "Team", value: workload.rows.length },
          ].map((item) => (
            <div key={item.label} className="rounded-lg bg-slate-50 px-1 py-2 ring-1 ring-slate-100">
              <p className="text-sm font-bold tabular-nums text-slate-800">{item.value}</p>
              <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                {item.label}
              </p>
            </div>
          ))}
        </div>

        {workload.rows.length > 0 ? (
          <ul className="space-y-1.5">
            {workload.rows.map((row) => {
              const tone = row.workload >= 80 ? "bg-red-500" : row.workload >= 60 ? "bg-amber-500" : "bg-emerald-500";
              return (
                <li key={row.memberId} className="flex items-center gap-2">
                  <span className="w-16 truncate text-[10px] font-semibold text-slate-700">
                    {row.member.name}
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className={cn("h-full rounded-full", tone)} style={{ width: `${row.workload}%` }} />
                  </div>
                  <span className="w-8 text-right text-[10px] font-bold tabular-nums text-slate-600">
                    {row.workload}%
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}
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
                <p className="truncate text-xs font-semibold text-slate-800">{m.title}</p>
                <p className="truncate text-[10px] text-slate-500">
                  {m.eventTypeLabel ? `${m.eventTypeLabel} · ${m.projectName}` : m.projectName}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </DashboardWidget>
  );
}

// ─── Tasks ─────────────────────────────────────────────────────────────────────

/** My Tasks widget — checkbox + Task / Project / Due Date columns */
const DASHBOARD_TASK_GRID =
  "grid-cols-[18px_minmax(0,1.45fr)_minmax(0,0.95fr)_minmax(0,0.85fr)]";

function TaskList({ projects, onViewAllTasks, onAddTask }) {
  const { tasks, updateTask, deleteTask } = useTasks();
  const { deleteEvent, updateEvent } = useCalendarEvents();
  const currentUser = useCurrentUser();
  const [filter, setFilter] = useState("all");
  const [detailTask, setDetailTask] = useState(null);
  const [editingTask, setEditingTask] = useState(null);

  const myTasks = useMemo(
    () => tasks.filter((task) => isTaskAssignedToUser(task, currentUser)),
    [tasks, currentUser]
  );

  const detailTaskLive = useMemo(
    () => (detailTask ? tasks.find((task) => task.id === detailTask.id) ?? detailTask : null),
    [tasks, detailTask]
  );

  const filterCounts = useMemo(() => {
    const open = myTasks.filter((task) => !isTaskComplete(task));
    return {
      all: open.length,
      todo: open.filter((task) => task.status === "todo").length,
      in_progress: open.filter((task) => task.status === "in_progress").length,
      done: myTasks.filter(isTaskComplete).length,
      events: myTasks.filter(isCalendarEventTask).length,
    };
  }, [myTasks]);

  const dashboardTaskFilters = useMemo(
    () => TASK_STATUS_FILTERS.filter((f) => f.id !== "mine"),
    []
  );

  const filteredTasks = useMemo(() => {
    return myTasks.filter((task) => {
      const isDone = isTaskComplete(task);
      if (filter === "all") return !isDone;
      if (filter === "done") return isDone;
      if (filter === "events") return isCalendarEventTask(task);
      if (filter === "todo") return !isDone && task.status === "todo";
      if (filter === "in_progress") return !isDone && task.status === "in_progress";
      return true;
    });
  }, [myTasks, filter]);

  const toggleTask = (id, e) => {
    e?.stopPropagation();
    const task = myTasks.find((item) => item.id === id);
    if (!task) return;

    const isDone = isTaskComplete(task);
    if (!isDone && !canCompleteTask(task)) {
      setDetailTask(task);
      return;
    }

    if (isCalendarEventTask(task)) {
      updateEvent(task.calendarEventId, { completed: !isDone });
      return;
    }

    updateTask(id, {
      completed: !isDone,
      status: !isDone ? "done" : task.status === "done" ? "todo" : task.status,
    });
  };

  const handleToggleComplete = (task) => {
    const isDone = isTaskComplete(task);
    if (!isDone && !canCompleteTask(task)) return;

    if (isCalendarEventTask(task)) {
      updateEvent(task.calendarEventId, { completed: !isDone });
      if (!isDone) setDetailTask(null);
      return;
    }

    updateTask(task.id, {
      completed: !isDone,
      status: !isDone ? "done" : task.status === "done" ? "todo" : task.status,
    });

    if (!isDone) setDetailTask(null);
  };

  const handleDeleteTask = (task) => {
    archiveDeletedItem("task", task);
    if (isCalendarEventTask(task)) {
      deleteEvent(task.calendarEventId, { skipArchive: true });
    }
    deleteTask(task.id, { archive: false, snapshot: task });
    if (detailTask?.id === task.id) setDetailTask(null);
  };

  const handleEditTask = (task) => {
    setEditingTask(task);
  };

  return (
    <>
      <AddTaskModal
        open={Boolean(editingTask)}
        mode="edit"
        editingTask={editingTask}
        onClose={() => setEditingTask(null)}
        onSubmit={(fields) => {
          if (editingTask) {
            updateTask(editingTask.id, fields);
            const calendarFields = taskUpdateToCalendarEventFields(fields, editingTask);
            if (calendarFields) {
              updateEvent(editingTask.calendarEventId, calendarFields);
            }
          }
          setEditingTask(null);
        }}
        projects={projects}
      />

      <TaskDetailModal
        task={detailTaskLive}
        open={Boolean(detailTaskLive)}
        isDone={detailTaskLive ? isTaskComplete(detailTaskLive) : false}
        onClose={() => setDetailTask(null)}
        onEdit={handleEditTask}
        onDelete={handleDeleteTask}
        onAttachmentsChange={(attachments) => {
          if (!detailTaskLive) return;
          const updated = updateTask(detailTaskLive.id, { attachments });
          if (updated) setDetailTask(updated);
        }}
        onPreTaskToggle={(preTaskId) => {
          if (!detailTaskLive) return;
          const updated = updateTask(
            detailTaskLive.id,
            getPreTaskToggleUpdates(detailTaskLive, preTaskId)
          );
          if (updated) setDetailTask(updated);
        }}
        onToggleComplete={handleToggleComplete}
      />

      <Card
      compact
      title="My Tasks"
      action={
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onViewAllTasks}
            className="text-[10px] font-medium text-indigo-600 hover:text-indigo-700 sm:text-xs"
          >
            View all
          </button>
          <button
            type="button"
            onClick={onAddTask}
            className="flex items-center gap-0.5 rounded-lg bg-indigo-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-indigo-700 sm:gap-1 sm:px-2.5 sm:py-1.5 sm:text-xs"
          >
            <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            Add
          </button>
        </div>
      }
      className="flex h-full min-h-0 flex-col overflow-hidden"
    >
      <div className="mb-2 flex shrink-0 flex-wrap gap-x-0.5 gap-y-0 border-b border-slate-100">
        {dashboardTaskFilters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              "inline-flex items-center gap-1 border-b-2 px-1.5 py-1.5 text-[10px] font-medium transition sm:px-2",
              filter === f.id
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            <span>{f.label}</span>
            <span
              className={cn(
                "min-w-[1rem] rounded-full px-1 py-px text-[9px] font-semibold tabular-nums leading-none",
                filter === f.id
                  ? "bg-indigo-100 text-indigo-700"
                  : "bg-slate-100 text-slate-500"
              )}
            >
              {filterCounts[f.id] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Table header */}
      <div
        className={cn(
          "mb-1 grid shrink-0 items-center gap-2 px-1.5 text-[9px] font-semibold uppercase tracking-wide text-slate-400",
          DASHBOARD_TASK_GRID
        )}
      >
        <span aria-hidden />
        <span className="min-w-0 truncate">Task</span>
        <span className="min-w-0 truncate">Project</span>
        <span className="min-w-0 truncate">Due Date</span>
      </div>

      <ul className="scrollbar-hidden min-h-0 flex-1 space-y-0.5 overflow-y-auto">
        {filteredTasks.length === 0 ? (
          <li className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center">
            <CheckSquare className="mb-2 h-6 w-6 text-slate-300" />
            <p className="text-xs font-semibold text-slate-600">
              {myTasks.length === 0 ? "No tasks yet" : "No tasks in this filter"}
            </p>
            <p className="mt-1 text-[10px] text-slate-400">
              {myTasks.length === 0
                ? "Add a task assigned to you, or create one from a project"
                : "Try another status tab above"}
            </p>
          </li>
        ) : (
        filteredTasks.map((task) => {
          const isDone = isTaskComplete(task);
          const hasPreTasks = getTaskPreTasks(task).length > 0;
          const canComplete = canCompleteTask(task);
          return (
            <li
              key={task.id}
              role="button"
              tabIndex={0}
              onClick={() => setDetailTask(task)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setDetailTask(task);
                }
              }}
              className={cn(
                "grid cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1.5 hover:bg-slate-50",
                DASHBOARD_TASK_GRID,
                isDone && "opacity-70"
              )}
            >
              <button
                type="button"
                onClick={(e) => toggleTask(task.id, e)}
                title={
                  !isDone && hasPreTasks && !canComplete
                    ? "Complete all pre-tasks first — opens task details"
                    : isDone
                      ? "Mark incomplete"
                      : "Mark complete"
                }
                aria-label={
                  !isDone && hasPreTasks && !canComplete
                    ? "Complete all pre-tasks before marking this task done"
                    : isDone
                      ? "Mark incomplete"
                      : "Mark complete"
                }
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition",
                  !isDone && hasPreTasks && !canComplete
                    ? "border-amber-300 bg-amber-50 hover:border-amber-400"
                    : isDone
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-slate-300 hover:border-indigo-400"
                )}
              >
                {isDone && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
              </button>

              <div className="flex min-w-0 items-center gap-1">
                <p
                  className={cn(
                    "min-w-0 flex-1 truncate text-[11px] leading-tight text-slate-800",
                    isDone && "line-through text-slate-500"
                  )}
                  title={task.title}
                >
                  {task.title}
                </p>
                <TaskDreamboardIcon task={task} className="h-3 w-3 shrink-0" />
                {task.attachments?.length > 0 ? (
                  <Paperclip
                    className="h-3 w-3 shrink-0 text-indigo-500"
                    title={`${task.attachments.length} attachment${task.attachments.length === 1 ? "" : "s"}`}
                    aria-label={`${task.attachments.length} attachment${task.attachments.length === 1 ? "" : "s"}`}
                  />
                ) : null}
              </div>

              <span
                className="min-w-0 truncate rounded-full px-1.5 py-px text-[9px] font-medium"
                style={{ backgroundColor: `${task.projectColor}15`, color: task.projectColor }}
                title={task.project || "—"}
              >
                {task.project || "—"}
              </span>

              <div className="min-w-0 truncate">
                <TaskDueDisplay
                  task={task}
                  compact
                  dateOnly
                  className="block min-w-0 truncate text-[9px] text-slate-600"
                />
              </div>
            </li>
          );
        })
        )}
      </ul>
    </Card>
    </>
  );
}

// ─── App ───────────────────────────────────────────────────────────────────────

export default function App({ onLogout }) {
  const user = useAppUser()
  const initialRoute = readPageFromHash();
  const [activePage, setActivePage] = useState(initialRoute.page);
  const [settingsSection, setSettingsSection] = useState(initialRoute.settingsSection);
  const [projectsListKey, setProjectsListKey] = useState(0);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [openAddTaskOnMount, setOpenAddTaskOnMount] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [onboardingTemplateMode, setOnboardingTemplateMode] = useState("blank");
  const [projects, setProjects] = useState(() =>
    ensureUniqueProjectColors(
      loadProjectBin(seedProjects).projects.map(normalizeProject)
    ).map(normalizeProject)
  );

  const summary = useMemo(() => computeProjectSummary(projects), [projects]);

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

  const openOnboarding = (options) => {
    setEditingProject(null);
    clearOnboardingDraft();
    const templateMode =
      options && typeof options === "object" && options.templateMode === "ui_ux"
        ? "ui_ux"
        : "blank";
    setOnboardingTemplateMode(templateMode);
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
    if (!window.confirm(`Delete "${name}"? It will move to Deleted items in Settings.`)) return;
    if (project) archiveDeletedItem("project", project);
    logWorkspaceActivity({
      type: "project_deleted",
      message: name,
    });
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
  };

  const handleRestoreProject = (project) => {
    const normalized = normalizeProject(project);
    let restored = false;
    setProjects((prev) => {
      if (prev.some((p) => p.id === normalized.id)) return prev;
      restored = true;
      return [...prev, normalized];
    });
    return restored;
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
    if (pageId === "account") {
      setActivePage("account");
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
    const normalized = normalizeProject({
      ...project,
      color: project.color ?? generateProjectStageColor(projects.map((p) => p.color)),
    });
    logWorkspaceActivity({
      type: "project_created",
      message: normalized.projectName ?? normalized.name ?? "Project",
    });
    setProjects((prev) => [normalized, ...prev]);
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
    const normalized = normalizeProject(updated);
    setProjects((prev) => {
      const previous = prev.find((project) => project.id === normalized.id);
      const wasComplete = previous ? isProjectComplete(previous) : false;
      const isNowComplete = isProjectComplete(normalized);

      if (!wasComplete && isNowComplete) {
        logWorkspaceActivity({
          type: "project_completed",
          message: normalized.projectName ?? normalized.name ?? "Project",
        });
      } else {
        logWorkspaceActivity({
          type: "project_edited",
          message: normalized.projectName ?? normalized.name ?? "Project",
        });
      }

      return prev.map((p) => (p.id === normalized.id ? normalized : p));
    });
  };

  return (
    <LoadingProvider activePage={activePage}>
    <WorkspaceSettingsProvider>
    <DeletedItemsProvider>
    <TeamProvider>
    <TasksProvider>
    <FilesProvider projects={projects} onProjectsChange={setProjects}>
    <CalendarEventsProvider>
    <CalendarTasksSync />
    <div className="app-viewport-shell">
      <div className="app-dashboard-card">
    <DashboardPreloaderOverlay />
    <div className="flex h-full overflow-hidden bg-slate-50">
      <Sidebar
        activePage={activePage === "completed-projects" ? "projects" : activePage}
        onNavigate={handleNavigate}
        onLogout={onLogout ?? (() => {})}
        user={user}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <MobileHeader />
        {activePage === "dashboard" && (
          <Header
            onOpenOnboarding={openOnboarding}
            userName={user.name}
            projects={projects}
            onNavigate={handleNavigate}
          />
        )}

        <main className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto p-4 pb-20 sm:p-5 lg:pb-6 lg:p-6">
          <div key={activePage} className="page-content-enter">
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
            <RoadmapPage
              projects={projects}
              onUpdateProject={handleUpdateProject}
              onNewProject={(templateMode) => openOnboarding({ templateMode })}
            />
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
            <TeamPage projects={projects} onUpdateProject={handleUpdateProject} />
          ) : activePage === "messages" ? (
            <MessagesPage />
          ) : activePage === "file-manager" ? (
            <FileManagerPage />
          ) : activePage === "dreamboard" ? (
            <DreamboardPage />
          ) : activePage === "settings" ? (
            <SettingsPage
              key={settingsSection}
              initialSection={settingsSection}
              restoreProject={handleRestoreProject}
              updateProjects={setProjects}
            />
          ) : activePage === "account" ? (
            <RoadmapAccountContent />
          ) : activePage === "systems" ? (
            <SystemsPage projects={projects} />
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
        initialTemplateMode={onboardingTemplateMode}
      />
    </div>
      </div>
    </div>
    </CalendarEventsProvider>
    </FilesProvider>
    </TasksProvider>
    </TeamProvider>
    </DeletedItemsProvider>
    </WorkspaceSettingsProvider>
    </LoadingProvider>
  );
}
