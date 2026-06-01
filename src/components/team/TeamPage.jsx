import { useMemo, useState } from "react";
import {
  Briefcase,
  Mail,
  Pencil,
  Search,
  Trash2,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import { resolveAssetUrl } from "../../lib/assetUrl";
import {
  TEAM_ROLE_FILTERS,
  TEAM_STATUS_STYLES,
  getWorkloadTone,
} from "../../data/teamData";
import { filterActiveProjects, getProjectStageColor, normalizeProject, addMemberToProjectTeam } from "../../lib/projectUtils";
import { useSyncedTeamWorkload } from "../../hooks/useSyncedTeamWorkload";
import { useRoadmapAuth } from "../../context/RoadmapAuthContext";
import { useTeam } from "../../context/TeamContext";
import NewTeamMemberOnboarding from "./NewTeamMemberOnboarding";
import EditTeamMemberModal from "./EditTeamMemberModal";
import TeamMemberDetailModal from "./TeamMemberDetailModal";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function TeamStatCard({ icon: Icon, label, value, subtitle, accent }) {
  const accents = {
    slate: "bg-slate-500/10 text-slate-700 ring-slate-500/15",
    emerald: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/15",
    amber: "bg-amber-500/10 text-amber-700 ring-amber-500/15",
    teal: "bg-teal-500/10 text-teal-700 ring-teal-500/15",
  };

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div
        className={cn(
          "mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg ring-1",
          accents[accent] ?? accents.slate
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-2xl font-bold tabular-nums text-slate-900">{value}</p>
      <p className="mt-0.5 text-xs font-semibold text-slate-700">{label}</p>
      <p className="mt-1 text-[11px] text-slate-500">{subtitle}</p>
    </div>
  );
}

function MemberAvatar({ member, size = "md" }) {
  const sizes = {
    md: "h-12 w-12 text-sm",
    lg: "h-14 w-14 text-base",
  };

  if (member.avatarUrl) {
    return (
      <img
        src={resolveAssetUrl(member.avatarUrl)}
        alt={member.name}
        className={cn("shrink-0 rounded-full object-cover ring-2 ring-white", sizes[size])}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-bold text-white ring-2 ring-white",
        sizes[size]
      )}
      style={{ backgroundColor: member.color }}
    >
      {member.initials}
    </div>
  );
}

function memberOnProject(project, member) {
  if (project.team?.projectOwner === member.name) return true;
  const members = project.team?.teamMembers ?? [];
  return members.some((m) => {
    if (typeof m === "string") return m === member.id || m === member.name;
    return m?.id === member.id || m?.name === member.name;
  });
}

function buildMemberProjectMap(projects, members) {
  const active = filterActiveProjects(projects);
  const map = new Map();

  for (const member of members) {
    const assigned = active.filter((p) => memberOnProject(p, member));
    map.set(member.id, assigned);
  }

  return map;
}

export default function TeamPage({ projects = [], onUpdateProject }) {
  const { profile } = useRoadmapAuth();
  const { members, canAddMembers, deleteMember } = useTeam();
  const workload = useSyncedTeamWorkload(projects);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const [editingMemberId, setEditingMemberId] = useState(null);

  const projectMap = useMemo(
    () => buildMemberProjectMap(projects, members),
    [projects, members]
  );

  const stats = useMemo(() => {
    const onProjects = members.filter((m) => (projectMap.get(m.id)?.length ?? 0) > 0).length;
    const avgWorkload = workload.avgWorkload;
    const owners = new Set(
      filterActiveProjects(projects)
        .map((p) => p.team?.projectOwner)
        .filter(Boolean)
    );

    return {
      total: members.length,
      onProjects,
      avgWorkload,
      owners: owners.size,
      openTasks: workload.totalOpenTasks,
      openJobs: workload.totalOpenJobs,
    };
  }, [projects, projectMap, members, workload]);

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return members.filter((member) => {
      if (roleFilter !== "all" && member.department !== roleFilter) return false;
      if (!query) return true;
      const haystack = `${member.name} ${member.role} ${member.email} ${member.phoneNumber ?? ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [search, roleFilter, members]);

  const selectedMember = useMemo(
    () => members.find((member) => member.id === selectedMemberId) ?? null,
    [members, selectedMemberId]
  );

  const editingMember = useMemo(
    () => members.find((member) => member.id === editingMemberId) ?? null,
    [members, editingMemberId]
  );

  const selectedMemberProjects = selectedMember
    ? (projectMap.get(selectedMember.id) ?? [])
    : [];

  const selectedMemberWorkload = selectedMember
    ? (workload.workloadByMemberId[selectedMember.id] ?? 0)
    : 0;

  const handleInviteMember = () => {
    const workspaceName = profile?.workspaceName?.trim() || "our workspace";
    const subject = encodeURIComponent(`Join ${workspaceName} on Over Drive OS`);
    const body = encodeURIComponent(
      `Hi,\n\nYou're invited to join the ${workspaceName} team on Over Drive OS.\n\nSign up or sign in to get started.\n`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleEditMember = (member) => {
    setEditingMemberId(member.id);
  };

  const handleDeleteMember = (member) => {
    if (member.isCurrentUser) return;

    const confirmed = window.confirm(
      `Remove ${member.name} from the team? They will move to Deleted items in Settings.`
    );
    if (!confirmed) return;

    deleteMember(member.id);
    if (selectedMemberId === member.id) setSelectedMemberId(null);
    if (editingMemberId === member.id) setEditingMemberId(null);
  };

  const stopCardAction = (event) => {
    event.stopPropagation();
  };

  const handleMemberAdded = (member, projectId) => {
    if (!member || !projectId || !onUpdateProject) return;

    const project = projects.find((item) => item.id === projectId);
    if (!project) return;

    onUpdateProject(normalizeProject(addMemberToProjectTeam(project, member)));
  };

  return (
    <div className="mx-auto max-w-[1600px]">
      <NewTeamMemberOnboarding
        open={onboardingOpen}
        onClose={() => setOnboardingOpen(false)}
        projects={projects}
        onAdded={handleMemberAdded}
      />
      <EditTeamMemberModal
        member={editingMember}
        open={Boolean(editingMember)}
        onClose={() => setEditingMemberId(null)}
      />
      <TeamMemberDetailModal
        member={selectedMember}
        open={Boolean(selectedMember)}
        onClose={() => setSelectedMemberId(null)}
        onEdit={(member) => {
          setSelectedMemberId(null);
          handleEditMember(member);
        }}
        onDelete={handleDeleteMember}
        assignedProjects={selectedMemberProjects}
        workload={selectedMemberWorkload}
      />
      <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-emerald-50/40 p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-2 text-base font-bold text-emerald-700 ring-1 ring-emerald-500/15">
              <Users className="h-5 w-5" />
              Team
            </div>
            <p className="max-w-xl text-sm font-semibold text-slate-600">
              People, roles, workload, and project assignments across your portfolio.
            </p>
          </div>
          {canAddMembers ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setOnboardingOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700"
              >
                <UserPlus className="h-4 w-4" />
                Add Member
              </button>
              <button
                type="button"
                onClick={handleInviteMember}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50"
              >
                <UserPlus className="h-4 w-4" />
                Invite Member
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TeamStatCard
          icon={Users}
          label="Team members"
          value={stats.total}
          subtitle="Across all disciplines"
          accent="emerald"
        />
        <TeamStatCard
          icon={Briefcase}
          label="On projects"
          value={stats.onProjects}
          subtitle="Assigned to active work"
          accent="teal"
        />
        <TeamStatCard
          icon={TrendingUp}
          label="Avg. workload"
          value={`${stats.avgWorkload}%`}
          subtitle={`${stats.openTasks} tasks · ${stats.openJobs} project jobs`}
          accent="amber"
        />
        <TeamStatCard
          icon={Users}
          label="Project owners"
          value={stats.owners}
          subtitle="Leading active projects"
          accent="slate"
        />
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, role, email, or phone…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        <div className="flex flex-wrap gap-1">
          {TEAM_ROLE_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setRoleFilter(f.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                roleFilter === f.id
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filteredMembers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <Users className="mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm font-semibold text-slate-700">No team members match</p>
          <p className="mt-1 text-xs text-slate-500">Try a different search or role filter.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredMembers.map((member) => {
            const assignedProjects = projectMap.get(member.id) ?? [];
            const memberWorkload = workload.workloadByMemberId[member.id] ?? 0;
            const status = TEAM_STATUS_STYLES[member.status];
            const workloadTone = getWorkloadTone(memberWorkload);
            const isOwnerOn = assignedProjects.some((p) => p.team?.projectOwner === member.name);

            return (
              <article
                key={member.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedMemberId(member.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedMemberId(member.id);
                  }
                }}
                className="flex cursor-pointer flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-emerald-200/80 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              >
                <div className="border-b border-slate-100 p-5">
                  <div className="flex items-start gap-3">
                    <MemberAvatar member={member} size="lg" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-semibold text-slate-900">
                          {member.name}
                        </h3>
                        {member.isCurrentUser ? (
                          <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200 ring-inset">
                            You
                          </span>
                        ) : null}
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset",
                            status.className
                          )}
                        >
                          {status.label}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">{member.role}</p>
                      <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                        <Mail className="h-3 w-3" />
                        View details
                      </p>
                    </div>
                    <div
                      className="flex shrink-0 gap-1"
                      onClick={stopCardAction}
                      onKeyDown={stopCardAction}
                    >
                      <button
                        type="button"
                        aria-label={`Edit ${member.name}`}
                        onClick={() => handleEditMember(member)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {!member.isCurrentUser ? (
                        <button
                          type="button"
                          aria-label={`Delete ${member.name}`}
                          onClick={() => handleDeleteMember(member)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      <span>Workload</span>
                      <span className={cn("normal-case", workloadTone.label === "High load" && "text-red-600")}>
                        {memberWorkload}% · {workloadTone.label}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={cn("h-full rounded-full transition-all", workloadTone.bar)}
                        style={{ width: `${memberWorkload}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-1 flex-col p-5 pt-4">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Active projects
                    {isOwnerOn && (
                      <span className="ml-1.5 font-semibold normal-case text-emerald-600">
                        · owner
                      </span>
                    )}
                  </p>

                  {assignedProjects.length === 0 ? (
                    <p className="text-xs italic text-slate-400">Not assigned to active projects</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {assignedProjects.map((project) => {
                        const color = getProjectStageColor(project);
                        const isOwner = project.team?.projectOwner === member.name;

                        return (
                          <li
                            key={project.id}
                            className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 ring-1 ring-slate-100"
                          >
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: color }}
                            />
                            <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700">
                              {project.projectName}
                            </span>
                            {isOwner && (
                              <span className="shrink-0 text-[10px] font-semibold text-emerald-600">
                                Owner
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
