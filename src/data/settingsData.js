import { PROFILE_ENIS_URL } from "../lib/assetUrl";

export const USER_PROFILE = {
  name: "Enis",
  role: "Product Manager",
  email: "enis@overdrive.os",
  avatarUrl: PROFILE_ENIS_URL,
  timezone: "America/New_York",
};

export const SETTINGS_SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "notifications", label: "Notifications" },
  { id: "tags", label: "Event tags" },
  { id: "appearance", label: "Appearance" },
  { id: "workspace", label: "Workspace" },
  { id: "account", label: "Account" },
];

export const NOTIFICATION_DEFAULTS = {
  emailDigest: true,
  taskAssignments: true,
  projectUpdates: true,
  milestoneReminders: true,
  teamMentions: true,
  weeklyReport: false,
};

export const APPEARANCE_DEFAULTS = {
  compactSidebar: false,
  showProjectColors: true,
  animationsEnabled: true,
};

export const WORKSPACE_DEFAULTS = {
  defaultView: "dashboard",
  weekStartsOn: "monday",
  dateFormat: "mdy",
  timeFormat: "12h",
};

export const DEFAULT_VIEW_OPTIONS = [
  { value: "dashboard", label: "Dashboard" },
  { value: "roadmap", label: "Roadmap" },
  { value: "projects", label: "Projects" },
  { value: "tasks", label: "Tasks" },
];

export const WEEK_START_OPTIONS = [
  { value: "sunday", label: "Sunday" },
  { value: "monday", label: "Monday" },
];

export const DATE_FORMAT_OPTIONS = [
  { value: "mdy", label: "MM/DD/YYYY" },
  { value: "dmy", label: "DD/MM/YYYY" },
  { value: "ymd", label: "YYYY-MM-DD" },
];

export const TIME_FORMAT_OPTIONS = [
  { value: "12h", label: "12-hour" },
  { value: "24h", label: "24-hour" },
];
