export const TEAM_ROLE_FILTERS = [
  { id: "all", label: "All roles" },
  { id: "leadership", label: "Leadership" },
  { id: "design", label: "Design" },
  { id: "engineering", label: "Engineering" },
  { id: "data", label: "Data" },
  { id: "devops", label: "DevOps" },
];

/** @typedef {"available" | "busy" | "away"} TeamMemberStatus */

/**
 * @typedef {{
 *   id: string;
 *   name: string;
 *   role: string;
 *   department: string;
 *   initials: string;
 *   color: string;
 *   avatarUrl?: string;
 *   workload: number;
 *   status: TeamMemberStatus;
 *   email: string;
 * }} TeamMember
 */

/** @type {TeamMember[]} */
export const TEAM_MEMBERS = [
  {
    id: "enis",
    name: "Enis",
    role: "Product Manager",
    department: "leadership",
    initials: "E",
    color: "#6366f1",
    avatarUrl: "/profile-enis.png",
    workload: 72,
    status: "available",
    email: "enis@overdrive.os",
  },
  {
    id: "sarah",
    name: "Sarah Chen",
    role: "Product Designer",
    department: "design",
    initials: "SC",
    color: "#8b5cf6",
    workload: 68,
    status: "busy",
    email: "sarah.chen@overdrive.os",
  },
  {
    id: "marcus",
    name: "Marcus Lee",
    role: "Backend Engineer",
    department: "engineering",
    initials: "ML",
    color: "#3b82f6",
    workload: 85,
    status: "busy",
    email: "marcus.lee@overdrive.os",
  },
  {
    id: "aisha",
    name: "Aisha Patel",
    role: "Frontend Engineer",
    department: "engineering",
    initials: "AP",
    color: "#06b6d4",
    workload: 61,
    status: "available",
    email: "aisha.patel@overdrive.os",
  },
  {
    id: "james",
    name: "James Wu",
    role: "Data Analyst",
    department: "data",
    initials: "JW",
    color: "#10b981",
    workload: 54,
    status: "available",
    email: "james.wu@overdrive.os",
  },
  {
    id: "elena",
    name: "Elena Rossi",
    role: "Mobile Developer",
    department: "engineering",
    initials: "ER",
    color: "#f59e0b",
    workload: 78,
    status: "busy",
    email: "elena.rossi@overdrive.os",
  },
  {
    id: "david",
    name: "David Kim",
    role: "DevOps Engineer",
    department: "devops",
    initials: "DK",
    color: "#64748b",
    workload: 45,
    status: "away",
    email: "david.kim@overdrive.os",
  },
];

export const TEAM_STATUS_STYLES = {
  available: { label: "Available", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  busy: { label: "Busy", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  away: { label: "Away", className: "bg-slate-100 text-slate-600 ring-slate-200" },
};

export function getWorkloadTone(workload) {
  if (workload >= 80) return { label: "High load", bar: "bg-red-500" };
  if (workload >= 60) return { label: "Moderate", bar: "bg-amber-500" };
  return { label: "Light", bar: "bg-emerald-500" };
}
