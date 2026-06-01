import { useEffect, useState } from "react";
import {
  Bell,
  Calendar,
  Download,
  Globe,
  Layout,
  LogOut,
  Palette,
  Plus,
  Save,
  Settings,
  Shield,
  Tag,
  Trash2,
  User,
  X,
} from "lucide-react";
import { useRoadmapAuth } from "../../context/RoadmapAuthContext";
import { useWorkspaceSettings } from "../../context/WorkspaceSettingsContext";
import {
  APPEARANCE_DEFAULTS,
  DATE_FORMAT_OPTIONS,
  DEFAULT_VIEW_OPTIONS,
  NOTIFICATION_DEFAULTS,
  SETTINGS_SECTIONS,
  TIME_FORMAT_OPTIONS,
  WEEK_START_OPTIONS,
  WORKSPACE_DEFAULTS,
} from "../../data/settingsData";
import { getRoadmapProfileEmail } from "../../data/roadmapProfileStorage";
import { getSettingsProfileFormValues } from "../../lib/settingsProfileFields";
import ResetWorkspaceCard from "./ResetWorkspaceCard";
import WorkspaceCsvBackupCard from "./WorkspaceCsvBackupCard";
import DeletedItemsCard from "./DeletedItemsCard";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

const SECTION_ICONS = {
  profile: User,
  notifications: Bell,
  tags: Tag,
  appearance: Palette,
  workspace: Layout,
  deleted: Trash2,
  backup: Download,
  account: Shield,
};

function SettingsCard({ title, description, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      {(title || description) && (
        <div className="mb-5 border-b border-slate-100 pb-4">
          {title && <h3 className="text-sm font-semibold text-slate-900">{title}</h3>}
          {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

function Toggle({ label, description, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <span className="block text-sm font-medium text-slate-800">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-slate-500">{description}</span>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-indigo-600" : "bg-slate-200"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
            checked && "translate-x-5"
          )}
        />
      </button>
    </label>
  );
}

function Field({ label, children, className }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputClassName =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

const selectClassName =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

export default function SettingsPage({
  initialSection = "profile",
  restoreProject,
  updateProjects,
}) {
  const { profile: roadmapProfile, updateProfile } = useRoadmapAuth();
  const { eventTags, addEventTag, removeEventTag } = useWorkspaceSettings();
  const [activeSection, setActiveSection] = useState(initialSection);
  const [saved, setSaved] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [newTag, setNewTag] = useState("");

  const [profile, setProfile] = useState({
    name: "",
    role: "",
    email: "",
    timezone: "",
  });

  const [notifications, setNotifications] = useState(NOTIFICATION_DEFAULTS);
  const [appearance, setAppearance] = useState(APPEARANCE_DEFAULTS);
  const [workspace, setWorkspace] = useState(WORKSPACE_DEFAULTS);

  useEffect(() => {
    if (!roadmapProfile) return;
    setProfile(getSettingsProfileFormValues(roadmapProfile));
  }, [roadmapProfile?.id, roadmapProfile?.fullName, roadmapProfile?.role]);

  useEffect(() => {
    if (!roadmapProfile) return;
    setProfile((current) => ({
      ...current,
      email: getRoadmapProfileEmail(roadmapProfile),
      timezone: roadmapProfile.timezone ?? current.timezone,
    }));
  }, [roadmapProfile?.email, roadmapProfile?.timezone, roadmapProfile?.googleAccount?.email]);

  const updateNotification = (key, value) => {
    setNotifications((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const updateAppearance = (key, value) => {
    setAppearance((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    setProfileError("");

    if (roadmapProfile) {
      const profileResult = updateProfile({
        fullName: profile.name.trim() || null,
        role: profile.role.trim() || null,
        timezone: profile.timezone.trim(),
      });
      if (!profileResult.ok) {
        setProfileError(profileResult.error);
        return;
      }
    }

    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-slate-100/80 p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-xl bg-slate-500/10 px-4 py-2 text-base font-bold text-slate-700 ring-1 ring-slate-500/15">
              <Settings className="h-5 w-5" />
              Settings
            </div>
            <p className="max-w-xl text-sm font-semibold text-slate-600">
              Manage your profile, notifications, and workspace preferences.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700"
          >
            <Save className="h-4 w-4" />
            {saved ? "Saved" : "Save changes"}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="flex flex-row gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm lg:flex-col lg:overflow-visible">
          {SETTINGS_SECTIONS.map((section) => {
            const Icon = SECTION_ICONS[section.id] ?? Settings;
            const isActive = activeSection === section.id;

            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition whitespace-nowrap",
                  isActive
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {section.label}
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 space-y-6">
          {activeSection === "profile" && (
            <>
              <SettingsCard
                title="Profile"
                description="Your personal information visible across Over Drive OS."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Full name">
                    <input
                      type="text"
                      value={profile.name}
                      onChange={(e) => {
                        setProfile((p) => ({ ...p, name: e.target.value }));
                        setSaved(false);
                        setProfileError("");
                      }}
                      placeholder="Enter your full name"
                      className={inputClassName}
                    />
                  </Field>
                  <Field label="Role">
                    <input
                      type="text"
                      value={profile.role}
                      onChange={(e) => {
                        setProfile((p) => ({ ...p, role: e.target.value }));
                        setSaved(false);
                        setProfileError("");
                      }}
                      placeholder="Enter your role"
                      className={inputClassName}
                    />
                  </Field>
                  <Field label="Email" className="sm:col-span-2">
                    <input
                      type="email"
                      value={profile.email}
                      readOnly
                      disabled
                      className={cn(inputClassName, "cursor-default bg-slate-50 text-slate-600")}
                    />
                    <p className="mt-1.5 text-xs text-slate-500">
                      Synced from your Account page. Update email under Account settings.
                    </p>
                  </Field>
                  <Field label="Timezone" className="sm:col-span-2">
                    <div className="relative">
                      <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={profile.timezone}
                        onChange={(e) => {
                          setProfile((p) => ({ ...p, timezone: e.target.value }));
                          setSaved(false);
                          setProfileError("");
                        }}
                        className={cn(inputClassName, "pl-9")}
                      />
                    </div>
                  </Field>
                </div>
                {profileError ? (
                  <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {profileError}
                  </p>
                ) : null}
              </SettingsCard>

              <ResetWorkspaceCard />
            </>
          )}

          {activeSection === "notifications" && (
            <SettingsCard
              title="Notifications"
              description="Choose what you want to be notified about."
            >
              <div className="divide-y divide-slate-100">
                <Toggle
                  label="Daily email digest"
                  description="Summary of tasks and milestones each morning"
                  checked={notifications.emailDigest}
                  onChange={(v) => updateNotification("emailDigest", v)}
                />
                <Toggle
                  label="Task assignments"
                  description="When you are assigned a new task"
                  checked={notifications.taskAssignments}
                  onChange={(v) => updateNotification("taskAssignments", v)}
                />
                <Toggle
                  label="Project updates"
                  description="Progress changes and status updates"
                  checked={notifications.projectUpdates}
                  onChange={(v) => updateNotification("projectUpdates", v)}
                />
                <Toggle
                  label="Milestone reminders"
                  description="Upcoming dates across your portfolio"
                  checked={notifications.milestoneReminders}
                  onChange={(v) => updateNotification("milestoneReminders", v)}
                />
                <Toggle
                  label="Team mentions"
                  description="When someone mentions you in messages"
                  checked={notifications.teamMentions}
                  onChange={(v) => updateNotification("teamMentions", v)}
                />
                <Toggle
                  label="Weekly portfolio report"
                  description="Automated report every Monday"
                  checked={notifications.weeklyReport}
                  onChange={(v) => updateNotification("weeklyReport", v)}
                />
              </div>
            </SettingsCard>
          )}

          {activeSection === "tags" && (
            <SettingsCard
              title="Event tags"
              description="Tags you can assign when creating calendar events. Saved automatically."
            >
              <form
                className="mb-4 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (addEventTag(newTag)) {
                    setNewTag("");
                    setSaved(true);
                    window.setTimeout(() => setSaved(false), 1500);
                  }
                }}
              >
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="New tag name"
                  className={cn(inputClassName, "flex-1")}
                />
                <button
                  type="submit"
                  disabled={!newTag.trim()}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </button>
              </form>

              {eventTags.length === 0 ? (
                <p className="text-sm text-slate-500">No tags yet. Add your first tag above.</p>
              ) : (
                <ul className="space-y-2">
                  {eventTags.map((tag) => (
                    <li
                      key={tag}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2"
                    >
                      <span className="text-sm font-medium text-slate-800">{tag}</span>
                      <button
                        type="button"
                        onClick={() => removeEventTag(tag)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        aria-label={`Remove ${tag}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </SettingsCard>
          )}

          {activeSection === "appearance" && (
            <SettingsCard
              title="Appearance"
              description="Customize how Over Drive OS looks and feels."
            >
              <div className="divide-y divide-slate-100">
                <Toggle
                  label="Compact sidebar"
                  description="Reduce spacing in the navigation panel"
                  checked={appearance.compactSidebar}
                  onChange={(v) => updateAppearance("compactSidebar", v)}
                />
                <Toggle
                  label="Show project colors"
                  description="Use stage colors on cards and charts"
                  checked={appearance.showProjectColors}
                  onChange={(v) => updateAppearance("showProjectColors", v)}
                />
                <Toggle
                  label="Animations"
                  description="Enable transitions and motion effects"
                  checked={appearance.animationsEnabled}
                  onChange={(v) => updateAppearance("animationsEnabled", v)}
                />
              </div>
              <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 ring-1 ring-slate-100">
                Dark mode is coming soon. Your theme preference will apply across all pages.
              </p>
            </SettingsCard>
          )}

          {activeSection === "workspace" && (
            <SettingsCard
              title="Workspace"
              description="Defaults for dates, time, and landing views."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Default landing page">
                  <select
                    value={workspace.defaultView}
                    onChange={(e) => {
                      setWorkspace((w) => ({ ...w, defaultView: e.target.value }));
                      setSaved(false);
                    }}
                    className={selectClassName}
                  >
                    {DEFAULT_VIEW_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Week starts on">
                  <select
                    value={workspace.weekStartsOn}
                    onChange={(e) => {
                      setWorkspace((w) => ({ ...w, weekStartsOn: e.target.value }));
                      setSaved(false);
                    }}
                    className={selectClassName}
                  >
                    {WEEK_START_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Date format">
                  <div className="relative">
                    <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <select
                      value={workspace.dateFormat}
                      onChange={(e) => {
                        setWorkspace((w) => ({ ...w, dateFormat: e.target.value }));
                        setSaved(false);
                      }}
                      className={cn(selectClassName, "pl-9")}
                    >
                      {DATE_FORMAT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </Field>
                <Field label="Time format">
                  <select
                    value={workspace.timeFormat}
                    onChange={(e) => {
                      setWorkspace((w) => ({ ...w, timeFormat: e.target.value }));
                      setSaved(false);
                    }}
                    className={selectClassName}
                  >
                    {TIME_FORMAT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </SettingsCard>
          )}

          {activeSection === "deleted" && (
            <DeletedItemsCard restoreProject={restoreProject} updateProjects={updateProjects} />
          )}

          {activeSection === "backup" && <WorkspaceCsvBackupCard />}

          {activeSection === "account" && (
            <>
              <SettingsCard title="Account security" description="Manage sign-in and access.">
                <div className="space-y-3">
                  <button
                    type="button"
                    className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:w-auto sm:px-6"
                  >
                    Change password
                  </button>
                  <button
                    type="button"
                    className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:w-auto sm:px-6"
                  >
                    Two-factor authentication
                  </button>
                </div>
              </SettingsCard>

              <SettingsCard title="Session">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </SettingsCard>

              <SettingsCard
                title="Danger zone"
                description="Irreversible actions for your account."
              >
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete account
                </button>
              </SettingsCard>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
