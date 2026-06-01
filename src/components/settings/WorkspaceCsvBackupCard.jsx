import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { useLoadingOptional } from "../../context/LoadingContext";
import { useRoadmapAuth } from "../../context/RoadmapAuthContext";
import { exportWorkspaceCsv, importWorkspaceCsv } from "../../lib/workspaceCsvExportImport";

export default function WorkspaceCsvBackupCard() {
  const { profile, updateProfile } = useRoadmapAuth();
  const loading = useLoadingOptional();
  const fileInputRef = useRef(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const actionBusy = Boolean(loading?.isLoading);

  const handleExport = async () => {
    setError("");
    setMessage("");

    const runExport = async () => {
      await exportWorkspaceCsv(profile);
      setMessage("Workspace exported to CSV.");
    };

    try {
      if (loading?.runWithLoading) {
        await loading.runWithLoading(runExport, "Exporting workspace");
      } else {
        await runExport();
      }
    } catch (err) {
      setError(err?.message ?? "Could not export workspace.");
    }
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const confirmed = window.confirm(
      "Import this CSV backup?\n\nThis replaces your current workspace data (projects, tasks, team, calendar, files, dreamboard, and workspace settings) and updates saved profile fields from the file.\n\nYour username and password stay the same."
    );
    if (!confirmed) return;

    setError("");
    setMessage("");

    const runImport = async () => {
      const csvText = await file.text();
      const result = await importWorkspaceCsv(csvText, { updateProfile });
      setMessage(
        `Imported ${result.counts.projects} projects, ${result.counts.tasks} tasks, ${result.counts.teamMembers} team members, ${result.counts.calendarEvents} calendar events, ${result.counts.files} files, and ${result.counts.dreamboardItems} dreamboard items. Reloading…`
      );
      window.setTimeout(() => {
        const base = `${window.location.pathname}${window.location.search}`;
        window.location.replace(`${base}#/dashboard`);
        window.location.reload();
      }, 900);
    };

    try {
      if (loading?.runWithLoading) {
        await loading.runWithLoading(runImport, "Importing workspace");
      } else {
        await runImport();
      }
    } catch (err) {
      setError(err?.message ?? "Could not import workspace.");
    }
  };

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-gradient-to-r from-indigo-50/80 to-white px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-700 ring-1 ring-indigo-500/15">
            <Download className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">CSV backup</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Export or import your profile settings, projects, tasks, team, calendar, files, and
              dreamboard.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-5 py-4">
        <p className="text-xs leading-relaxed text-slate-600">
          Downloads a single CSV file for this signed-in profile. Import restores everything from a
          matching Over Drive export. Passwords are never included.
        </p>

        {message ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={actionBusy || !profile}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleImportFile}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={actionBusy || !profile}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            Import CSV
          </button>
        </div>
      </div>
    </section>
  );
}
