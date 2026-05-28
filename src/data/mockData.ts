export type NavItem = {
  id: string;
  label: string;
  icon: string;
  active?: boolean;
};

export type PhaseId = "foundation" | "core" | "integrations" | "scale";

export type Phase = {
  id: PhaseId;
  label: string;
  shortLabel: string;
};

export type ProjectPhaseProgress = {
  phaseId: PhaseId;
  percent: number;
  color: string;
};

export type RoadmapProject = {
  id: string;
  name: string;
  color: string;
  phases: ProjectPhaseProgress[];
};

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";

export type Task = {
  id: string;
  title: string;
  project: string;
  projectColor: string;
  dueDate: string;
  priority: TaskPriority;
  status: TaskStatus;
  assignee: { name: string; initials: string; color: string };
  completed: boolean;
};

export type Milestone = {
  id: string;
  title: string;
  project: string;
  date: string;
  daysAway: number;
};

export type CalendarEventType = "milestone" | "deadline" | "event" | "meeting";

export type CalendarDayEvent = {
  date: number;
  types: CalendarEventType[];
};

export const navItems: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "LayoutDashboard", active: true },
  { id: "roadmap", label: "Roadmap", icon: "Map" },
  { id: "tasks", label: "Tasks", icon: "CheckSquare" },
  { id: "calendar", label: "Calendar", icon: "Calendar" },
  { id: "projects", label: "Projects", icon: "FolderKanban" },
  { id: "reports", label: "Reports", icon: "BarChart3" },
  { id: "team", label: "Team", icon: "Users" },
  { id: "settings", label: "Settings", icon: "Settings" },
];

export const phases: Phase[] = [
  { id: "foundation", label: "Phase 1: Foundation", shortLabel: "Foundation" },
  { id: "core", label: "Phase 2: Core Features", shortLabel: "Core Features" },
  { id: "integrations", label: "Phase 3: Integrations", shortLabel: "Integrations" },
  { id: "scale", label: "Phase 4: Scale & Optimize", shortLabel: "Scale & Optimize" },
];

export const roadmapProjects: RoadmapProject[] = [
  {
    id: "crm",
    name: "CRM System",
    color: "#8b5cf6",
    phases: [
      { phaseId: "foundation", percent: 100, color: "#8b5cf6" },
      { phaseId: "core", percent: 85, color: "#8b5cf6" },
      { phaseId: "integrations", percent: 40, color: "#a78bfa" },
      { phaseId: "scale", percent: 0, color: "#c4b5fd" },
    ],
  },
  {
    id: "inventory",
    name: "Inventory Management",
    color: "#3b82f6",
    phases: [
      { phaseId: "foundation", percent: 100, color: "#3b82f6" },
      { phaseId: "core", percent: 72, color: "#3b82f6" },
      { phaseId: "integrations", percent: 25, color: "#60a5fa" },
      { phaseId: "scale", percent: 0, color: "#93c5fd" },
    ],
  },
  {
    id: "leads",
    name: "Lead Automation",
    color: "#06b6d4",
    phases: [
      { phaseId: "foundation", percent: 100, color: "#06b6d4" },
      { phaseId: "core", percent: 55, color: "#06b6d4" },
      { phaseId: "integrations", percent: 10, color: "#22d3ee" },
      { phaseId: "scale", percent: 0, color: "#67e8f9" },
    ],
  },
  {
    id: "analytics",
    name: "Analytics Dashboard",
    color: "#10b981",
    phases: [
      { phaseId: "foundation", percent: 90, color: "#10b981" },
      { phaseId: "core", percent: 45, color: "#10b981" },
      { phaseId: "integrations", percent: 0, color: "#34d399" },
      { phaseId: "scale", percent: 0, color: "#6ee7b7" },
    ],
  },
  {
    id: "mobile",
    name: "Mobile App",
    color: "#f59e0b",
    phases: [
      { phaseId: "foundation", percent: 75, color: "#f59e0b" },
      { phaseId: "core", percent: 30, color: "#f59e0b" },
      { phaseId: "integrations", percent: 0, color: "#fbbf24" },
      { phaseId: "scale", percent: 0, color: "#fcd34d" },
    ],
  },
  {
    id: "finance",
    name: "Finance Integration",
    color: "#ec4899",
    phases: [
      { phaseId: "foundation", percent: 60, color: "#ec4899" },
      { phaseId: "core", percent: 15, color: "#ec4899" },
      { phaseId: "integrations", percent: 0, color: "#f472b6" },
      { phaseId: "scale", percent: 0, color: "#f9a8d4" },
    ],
  },
];

export const projectSummary = {
  total: 6,
  onTrack: 4,
  atRisk: 1,
  behind: 1,
  overallProgress: 68,
};

export const workloadData = [
  { day: "Mon", hours: 32 },
  { day: "Tue", hours: 38 },
  { day: "Wed", hours: 42 },
  { day: "Thu", hours: 36 },
  { day: "Fri", hours: 28 },
  { day: "Sat", hours: 12 },
  { day: "Sun", hours: 8 },
];

export const milestones: Milestone[] = [
  { id: "m1", title: "CRM Beta Launch", project: "CRM System", date: "Jun 12", daysAway: 17 },
  { id: "m2", title: "Inventory API v2", project: "Inventory", date: "Jun 18", daysAway: 23 },
  { id: "m3", title: "Lead Scoring Engine", project: "Lead Automation", date: "Jun 25", daysAway: 30 },
  { id: "m4", title: "Analytics GA Release", project: "Analytics", date: "Jul 3", daysAway: 38 },
];

export const tasks: Task[] = [
  {
    id: "t1",
    title: "Finalize user authentication flow",
    project: "CRM System",
    projectColor: "#8b5cf6",
    dueDate: "May 28",
    priority: "high",
    status: "in_progress",
    assignee: { name: "Sarah Chen", initials: "SC", color: "#8b5cf6" },
    completed: false,
  },
  {
    id: "t2",
    title: "Design warehouse sync schema",
    project: "Inventory",
    projectColor: "#3b82f6",
    dueDate: "May 30",
    priority: "medium",
    status: "todo",
    assignee: { name: "Marcus Lee", initials: "ML", color: "#3b82f6" },
    completed: false,
  },
  {
    id: "t3",
    title: "Configure lead scoring rules",
    project: "Lead Automation",
    projectColor: "#06b6d4",
    dueDate: "Jun 2",
    priority: "high",
    status: "in_progress",
    assignee: { name: "Aisha Patel", initials: "AP", color: "#06b6d4" },
    completed: false,
  },
  {
    id: "t4",
    title: "Build revenue dashboard widgets",
    project: "Analytics",
    projectColor: "#10b981",
    dueDate: "Jun 5",
    priority: "medium",
    status: "todo",
    assignee: { name: "James Wu", initials: "JW", color: "#10b981" },
    completed: false,
  },
  {
    id: "t5",
    title: "Push notification service setup",
    project: "Mobile App",
    projectColor: "#f59e0b",
    dueDate: "Jun 8",
    priority: "low",
    status: "todo",
    assignee: { name: "Elena Rossi", initials: "ER", color: "#f59e0b" },
    completed: false,
  },
  {
    id: "t6",
    title: "Stripe webhook integration tests",
    project: "Finance",
    projectColor: "#ec4899",
    dueDate: "May 27",
    priority: "high",
    status: "done",
    assignee: { name: "David Kim", initials: "DK", color: "#ec4899" },
    completed: true,
  },
  {
    id: "t7",
    title: "Update API documentation",
    project: "CRM System",
    projectColor: "#8b5cf6",
    dueDate: "Jun 10",
    priority: "low",
    status: "done",
    assignee: { name: "Sarah Chen", initials: "SC", color: "#8b5cf6" },
    completed: true,
  },
];

export const calendarEvents: CalendarDayEvent[] = [
  { date: 3, types: ["meeting"] },
  { date: 7, types: ["deadline"] },
  { date: 12, types: ["milestone", "event"] },
  { date: 15, types: ["meeting"] },
  { date: 18, types: ["deadline", "milestone"] },
  { date: 22, types: ["event"] },
  { date: 25, types: ["milestone"] },
  { date: 26, types: ["meeting", "event"] },
  { date: 28, types: ["deadline"] },
];

export const eventTypeColors: Record<CalendarEventType, string> = {
  milestone: "#8b5cf6",
  deadline: "#ef4444",
  event: "#3b82f6",
  meeting: "#10b981",
};
