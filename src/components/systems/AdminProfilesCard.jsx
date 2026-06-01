import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Pencil, Trash2, User, Users, X } from "lucide-react";
import { useRoadmapAuth } from "../../context/RoadmapAuthContext";
import { useLoadingOptional } from "../../context/LoadingContext";
import { useTeam } from "../../context/TeamContext";
import { getRoadmapProfileFullName } from "../../data/roadmapProfileStorage";
import {
  cleanupDeletedRoadmapProfile,
  getLinkedTeamMemberIdForProfile,
} from "../../lib/profileDeletionCleanup";
import { lockBodyScroll } from "../../lib/modalBodyLock";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

const inputClassName =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-500/20";

function formatDate(value) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function EditProfileModal({ profile, open, onClose, onSave, error }) {
  const [username, setUsername] = useState(profile?.username ?? "");
  const [password, setPassword] = useState(profile?.password ?? "");
  const [workspaceName, setWorkspaceName] = useState(profile?.workspaceName ?? "");

  useEffect(() => {
    if (!open || !profile) return;
    setUsername(profile.username);
    setPassword(profile.password);
    setWorkspaceName(profile.workspaceName);
  }, [open, profile]);

  useEffect(() => {
    if (!open) return undefined;
    return lockBodyScroll();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || !profile) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close edit profile"
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Edit profile</h3>
            <p className="mt-0.5 text-xs text-slate-500">Update credentials for @{profile.username}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSave({ username, password, workspaceName });
          }}
          className="space-y-4 px-5 py-4"
        >
          <div>
            <label htmlFor="admin-edit-username" className="mb-1.5 block text-xs font-semibold text-slate-600">
              Username
            </label>
            <input
              id="admin-edit-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className={inputClassName}
            />
          </div>
          <div>
            <label htmlFor="admin-edit-password" className="mb-1.5 block text-xs font-semibold text-slate-600">
              Password
            </label>
            <input
              id="admin-edit-password"
              type="text"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={inputClassName}
            />
          </div>
          <div>
            <label htmlFor="admin-edit-workspace" className="mb-1.5 block text-xs font-semibold text-slate-600">
              Workspace name
            </label>
            <input
              id="admin-edit-workspace"
              value={workspaceName}
              onChange={(event) => setWorkspaceName(event.target.value)}
              className={inputClassName}
            />
          </div>
          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
            >
              Save changes
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

export default function AdminProfilesCard() {
  const { profile: activeProfile, isAdmin, listProfiles, adminUpdateProfile, adminDeleteProfile } =
    useRoadmapAuth();
  const { deleteMember } = useTeam();
  const loading = useLoadingOptional();
  const [profiles, setProfiles] = useState([]);
  const [editingProfile, setEditingProfile] = useState(null);
  const [editError, setEditError] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  const refreshProfiles = useCallback(() => {
    setProfiles(listProfiles());
  }, [listProfiles]);

  useEffect(() => {
    if (isAdmin) refreshProfiles();
  }, [isAdmin, refreshProfiles]);

  if (!isAdmin) return null;

  const handleSave = (fields) => {
    if (!editingProfile) return;
    setEditError("");

    const result = adminUpdateProfile(editingProfile.id, fields);
    if (!result.ok) {
      setEditError(result.error);
      return;
    }

    setEditingProfile(null);
    setActionMessage(`Updated profile "${fields.username}".`);
    refreshProfiles();
  };

  const handleDelete = async (target) => {
    const confirmed = window.confirm(
      `Delete profile "${target.username}" permanently?\n\nThis also removes them from every team on this device and deletes their workspace data. This cannot be undone.`
    );
    if (!confirmed) return;

    setActionMessage("");

    const runDelete = async () => {
      const remainingProfileIds = listProfiles()
        .filter((item) => item.id !== target.id)
        .map((item) => item.id);

      await cleanupDeletedRoadmapProfile(target.id, remainingProfileIds);

      const result = adminDeleteProfile(target.id);
      if (!result.ok) {
        window.alert(result.error);
        return;
      }

      deleteMember(getLinkedTeamMemberIdForProfile(target.id));

      setActionMessage(
        `Deleted profile "${target.username}" and removed their team entries from all workspaces.`
      );
      refreshProfiles();
    };

    try {
      if (loading?.runWithLoading) {
        await loading.runWithLoading(runDelete, "Deleting profile");
      } else {
        await runDelete();
      }
    } catch (err) {
      window.alert(err?.message ?? "Could not fully delete that profile.");
    }
  };

  const actionBusy = Boolean(loading?.isLoading);

  return (
    <>
      <section className="mt-6 overflow-hidden rounded-xl border border-violet-200/80 bg-white shadow-sm">
        <div className="border-b border-violet-100 bg-gradient-to-r from-violet-50/80 to-white px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-700 ring-1 ring-violet-500/15">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Profile / Users</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Admin-only view of all local profiles and credentials on this device.
              </p>
            </div>
          </div>
        </div>

        {actionMessage ? (
          <div className="border-b border-emerald-100 bg-emerald-50 px-5 py-2.5 text-xs font-medium text-emerald-700">
            {actionMessage}
          </div>
        ) : null}

        {profiles.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">No profiles found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">User</th>
                  <th className="px-5 py-3">Full name</th>
                  <th className="px-5 py-3">Password</th>
                  <th className="px-5 py-3">Workspace</th>
                  <th className="hidden px-5 py-3 md:table-cell">Created</th>
                  <th className="hidden px-5 py-3 lg:table-cell">Last sign in</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {profiles.map((item) => {
                  const isSelf = item.id === activeProfile?.id;

                  return (
                    <tr key={item.id} className={cn(isSelf && "bg-violet-50/40")}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                            <User className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{item.username}</p>
                            {isSelf ? (
                              <p className="text-[11px] font-medium text-violet-600">Active admin</p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-700">
                        {getRoadmapProfileFullName(item, { fallbackToUsername: false }) || (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <code className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-800">
                          {item.password}
                        </code>
                      </td>
                      <td className="px-5 py-3 text-slate-700">{item.workspaceName}</td>
                      <td className="hidden px-5 py-3 text-xs text-slate-500 md:table-cell">
                        {formatDate(item.createdAt)}
                      </td>
                      <td className="hidden px-5 py-3 text-xs text-slate-500 lg:table-cell">
                        {formatDate(item.lastLoginAt)}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            title="Edit profile"
                            onClick={() => {
                              setEditError("");
                              setEditingProfile(item);
                            }}
                            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            title={isSelf ? "Cannot delete active admin session" : "Delete profile"}
                            disabled={isSelf || actionBusy}
                            onClick={() => handleDelete(item)}
                            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <EditProfileModal
        profile={editingProfile}
        open={Boolean(editingProfile)}
        onClose={() => {
          setEditingProfile(null);
          setEditError("");
        }}
        onSave={handleSave}
        error={editError}
      />
    </>
  );
}
