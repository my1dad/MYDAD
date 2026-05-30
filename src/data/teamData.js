import { PROFILE_ENIS_URL, resolveAssetUrl } from "../lib/assetUrl";

export const TEAM_ROLE_FILTERS = [
  { id: "all", label: "All roles" },
  { id: "leadership", label: "Leadership" },
  { id: "design", label: "Design" },
  { id: "engineering", label: "Engineering" },
  { id: "data", label: "Data" },
  { id: "devops", label: "DevOps" },
];

export const TEAM_DEPARTMENT_OPTIONS = TEAM_ROLE_FILTERS.filter((f) => f.id !== "all");

export const TEAM_STATUS_OPTIONS = [
  { id: "available", label: "Available" },
  { id: "busy", label: "Busy" },
  { id: "away", label: "Away" },
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
 *   notes?: string;
 * }} TeamMember
 */

/** @type {TeamMember[]} */
export const DEFAULT_TEAM_MEMBERS = [
  {
    id: "enis",
    name: "Enis",
    role: "Product Manager",
    department: "leadership",
    initials: "E",
    color: "#6366f1",
    avatarUrl: PROFILE_ENIS_URL,
    workload: 0,
    status: "available",
    email: "enis@overdrive.os",
  },
];

/** @deprecated Use DEFAULT_TEAM_MEMBERS or TeamContext */
export const TEAM_MEMBERS = DEFAULT_TEAM_MEMBERS;

export const TEAM_STATUS_STYLES = {
  available: { label: "Available", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  busy: { label: "Busy", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  away: { label: "Away", className: "bg-slate-100 text-slate-600 ring-slate-200" },
};

const MEMBER_COLORS = [
  "#6366f1",
  "#3b82f6",
  "#8b5cf6",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#64748b",
];

export function getWorkloadTone(workload) {
  if (workload >= 80) return { label: "High load", bar: "bg-red-500" };
  if (workload >= 60) return { label: "Moderate", bar: "bg-amber-500" };
  return { label: "Light", bar: "bg-emerald-500" };
}

export function getDepartmentLabel(departmentId) {
  return TEAM_DEPARTMENT_OPTIONS.find((d) => d.id === departmentId)?.label ?? departmentId;
}

export function buildMemberInitials(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function buildMemberEmail(name, email) {
  if (email?.trim()) return email.trim().toLowerCase();
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "");
  return slug ? `${slug}@overdrive.os` : "member@overdrive.os";
}

export function getNextTeamMemberId(name, members) {
  const base =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "member";
  let id = base;
  let n = 2;
  while (members.some((member) => member.id === id)) {
    id = `${base}-${n++}`;
  }
  return id;
}

export function pickMemberColor(members) {
  const used = new Set(members.map((member) => member.color));
  const available = MEMBER_COLORS.find((color) => !used.has(color));
  return available ?? MEMBER_COLORS[members.length % MEMBER_COLORS.length];
}

/**
 * @param {{
 *   name: string;
 *   email?: string;
 *   role: string;
 *   department: string;
 *   status?: TeamMemberStatus;
 *   notes?: string;
 * }} fields
 * @param {TeamMember[]} existingMembers
 * @returns {TeamMember}
 */
export function createTeamMember(fields, existingMembers) {
  const name = fields.name.trim();
  return {
    id: getNextTeamMemberId(name, existingMembers),
    name,
    role: fields.role.trim(),
    department: fields.department,
    initials: buildMemberInitials(name),
    color: pickMemberColor(existingMembers),
    workload: 0,
    status: fields.status ?? "available",
    email: buildMemberEmail(name, fields.email),
    ...(fields.notes?.trim() ? { notes: fields.notes.trim() } : {}),
  };
}

/** @param {TeamMember} member */
export function teamMemberToAssignee(member) {
  return {
    id: member.id,
    name: member.name,
    initials: member.initials,
    color: member.color,
    ...(member.avatarUrl ? { avatarUrl: resolveAssetUrl(member.avatarUrl) } : {}),
  };
}

/** @param {TeamMember[]} members */
export function membersToAssignees(members) {
  return members.map(teamMemberToAssignee);
}
