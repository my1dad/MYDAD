import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useLoadingOptional } from "../../context/LoadingContext";
import { useRoadmapAuth } from "../../context/RoadmapAuthContext";
import { resetActiveProfileWorkspace } from "../../lib/blankWorkspace";

export default function ResetWorkspaceCard({ className = "" }) {
  const { profile, updateProfile } = useRoadmapAuth();
  const loading = useLoadingOptional();
  const [resetError, setResetError] = useState("");

  const handleResetWorkspace = async () => {
    if (!profile) {
      setResetError("Sign in to reset your workspace.");
      return;
    }

    const confirmed = window.confirm(
      "Reset everything and start with a blank dashboard?\n\nThis clears all projects, tasks, team members, calendar events, files, dreamboard items, saved profile details (name, role, phone, photo), and recent activity for your account.\n\nYour username, password, and workspace login stay the same."
    );
    if (!confirmed) return;

    setResetError("");

    const runReset = async () => {
      await resetActiveProfileWorkspace();

      const profileResult = updateProfile({
        fullName: null,
        role: null,
        phoneNumber: null,
        profilePicture: null,
      });
      if (!profileResult.ok) {
        throw new Error(profileResult.error);
      }

      const base = `${window.location.pathname}${window.location.search}`;
      window.location.replace(`${base}#/dashboard`);
      window.location.reload();
    };

    try {
      if (loading?.runWithLoading) {
        await loading.runWithLoading(runReset, "Resetting workspace");
      } else {
        await runReset();
      }
    } catch (err) {
      setResetError(err?.message ?? "Could not reset workspace.");
    }
  };

  return (
    <section className={`overflow-hidden rounded-xl border border-red-200/80 bg-white shadow-sm ${className}`}>
      <div className="border-b border-red-100 bg-gradient-to-r from-red-50/80 to-white px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-700 ring-1 ring-red-500/15">
            <Trash2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Reset workspace</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Clear all entered data and start with a fresh blank dashboard.
            </p>
          </div>
        </div>
      </div>
      <div className="space-y-3 px-5 py-4">
        <p className="text-xs leading-relaxed text-slate-600">
          Removes projects, tasks, team, calendar, files, dreamboard, profile name/role/phone/photo,
          and recent activity for your signed-in account. Login credentials are kept.
        </p>
        {resetError ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {resetError}
          </p>
        ) : null}
        <button
          type="button"
          onClick={handleResetWorkspace}
          disabled={Boolean(loading?.isLoading) || !profile}
          className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
          Reset workspace & start fresh
        </button>
      </div>
    </section>
  );
}
