import { useState } from "react";
import {
  Database,
  Download,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import DashboardCard, { Badge } from "../layout/DashboardCard";
import { DATA_BIN_DEFINITIONS } from "../../lib/dataBins";
import { formatEasternDateTime } from "../../lib/dateTime";
import { useInternalDatabase } from "../../hooks/useInternalDatabase";

const modeLabels = {
  local: "localStorage",
  disk: "bins/ on disk",
  electron: "Electron userData",
};

function formatTimestamp(value) {
  try {
    return formatEasternDateTime(value);
  } catch {
    return value;
  }
}

export default function AdminDataBinsPanel({ className }) {
  const { snapshot, mode, binsRoot, appendRecord, clearBin, flush } = useInternalDatabase();
  const [activeBin, setActiveBin] = useState("adminCaptures");
  const [demoLabel, setDemoLabel] = useState("");
  const [demoNotes, setDemoNotes] = useState("");
  const [status, setStatus] = useState("");
  const [flushing, setFlushing] = useState(false);

  const activeDefinition = DATA_BIN_DEFINITIONS.find((bin) => bin.key === activeBin);
  const activeDocument = snapshot.bins[activeBin];
  const totalRecords = DATA_BIN_DEFINITIONS.reduce(
    (sum, bin) => sum + (snapshot.bins[bin.key]?.records.length ?? 0),
    0
  );

  const handleDemoSave = () => {
    if (!demoLabel.trim()) {
      setStatus("Enter a label before saving.");
      return;
    }

    appendRecord("adminCaptures", "admin-demo-form", {
      label: demoLabel.trim(),
      notes: demoNotes.trim(),
      page: "admin-bins",
    });

    setDemoLabel("");
    setDemoNotes("");
    setStatus("Demo record saved to admin captures bin.");
  };

  const handleFlush = async () => {
    setFlushing(true);
    try {
      await flush();
      setStatus("Database flushed to persistent storage.");
    } catch {
      setStatus("Flush failed — check console for details.");
    } finally {
      setFlushing(false);
    }
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `dollar-a-day-database-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus("Database snapshot exported.");
  };

  return (
    <div className={cn("space-y-6", className)}>
      <DashboardCard
        title="Internal database"
        subtitle="All Dollar A Day inputs are saved to data/info bins on this device."
        action={
          <Badge variant="info">
            <Database className="mr-1 inline h-3 w-3" />
            {totalRecords} records
          </Badge>
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="dda-panel rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-wide text-gray-500">Storage mode</p>
            <p className="mt-1 text-sm font-semibold text-white">{modeLabels[mode] ?? mode}</p>
          </div>
          <div className="dda-panel rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-wide text-gray-500">Profile scope</p>
            <p className="mt-1 text-sm font-semibold text-white">{snapshot.profileId}</p>
          </div>
          <div className="dda-panel rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-wide text-gray-500">Last sync</p>
            <p className="mt-1 text-sm font-semibold text-white">
              {formatTimestamp(snapshot.syncedAt)}
            </p>
          </div>
        </div>

        {binsRoot ? (
          <p className="mt-3 text-xs text-gray-500">
            Bins root: <span className="text-gray-400">{binsRoot}</span>
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleFlush}
            disabled={flushing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10 disabled:opacity-60"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", flushing && "animate-spin")} />
            Sync now
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-400 transition hover:bg-emerald-500/15"
          >
            <Download className="h-3.5 w-3.5" />
            Export JSON
          </button>
        </div>
      </DashboardCard>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <DashboardCard title="Data bins" subtitle="Select a bin to inspect saved records">
          <ul className="space-y-2">
            {DATA_BIN_DEFINITIONS.map((bin) => {
              const doc = snapshot.bins[bin.key];
              const active = activeBin === bin.key;
              return (
                <li key={bin.key}>
                  <button
                    type="button"
                    onClick={() => setActiveBin(bin.key)}
                    className={cn(
                      "dda-glass-btn flex w-full items-start justify-between gap-3 rounded-xl px-3 py-3 text-left transition",
                      active && "border-emerald-400/25 ring-1 ring-emerald-400/15"
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold text-white">{bin.label}</span>
                      <span className="mt-0.5 block text-xs text-gray-500">{bin.description}</span>
                      <span className="mt-1 block font-mono text-[10px] text-gray-600">
                        {bin.path}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-lg font-bold tabular-nums text-emerald-400">
                        {doc?.records.length ?? 0}
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-gray-500">
                        records
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </DashboardCard>

        <DashboardCard
          title={activeDefinition?.label ?? "Bin records"}
          subtitle={activeDefinition?.description}
          action={
            <button
              type="button"
              onClick={() => {
                clearBin(activeBin);
                setStatus(`Cleared ${activeDefinition?.label ?? "bin"}.`);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-[10px] font-semibold text-red-400 transition hover:bg-red-500/15"
            >
              <Trash2 className="h-3 w-3" />
              Clear bin
            </button>
          }
        >
          <p className="mb-3 text-xs text-gray-500">
            Updated {formatTimestamp(activeDocument?.updatedAt ?? snapshot.syncedAt)}
          </p>

          {activeDocument?.records.length ? (
            <div className="dda-scroll max-h-[28rem] space-y-2 overflow-y-auto pr-1">
              {activeDocument.records.map((record) => (
                <div key={record.id} className="dda-panel rounded-xl p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-[10px] text-gray-500">{record.id}</span>
                    <Badge variant="default">{record.source}</Badge>
                  </div>
                  <p className="mt-2 text-[11px] text-gray-500">
                    {formatTimestamp(record.createdAt)}
                  </p>
                  <pre className="dda-scroll mt-2 max-h-40 overflow-auto rounded-lg bg-black/30 p-2 text-[11px] leading-relaxed text-gray-300">
                    {JSON.stringify(record.payload, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          ) : (
            <div className="dda-panel rounded-xl p-6 text-center text-sm text-gray-500">
              No records saved in this bin yet.
            </div>
          )}
        </DashboardCard>
      </div>

      <DashboardCard title="Demo capture form" subtitle="Test internal storage by saving an admin record">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="demo-label" className="mb-1.5 block text-sm text-gray-400">
              Label
            </label>
            <input
              id="demo-label"
              type="text"
              value={demoLabel}
              onChange={(event) => setDemoLabel(event.target.value)}
              placeholder="e.g. Pool policy update"
              className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-gray-600 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="demo-notes" className="mb-1.5 block text-sm text-gray-400">
              Notes
            </label>
            <textarea
              id="demo-notes"
              value={demoNotes}
              onChange={(event) => setDemoNotes(event.target.value)}
              rows={4}
              placeholder="Any admin note or captured input..."
              className="w-full resize-y rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-relaxed text-white placeholder:text-gray-600 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleDemoSave}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-[#071013] transition hover:bg-emerald-400"
          >
            <Save className="h-4 w-4" />
            Save to admin captures
          </button>
          {status ? <p className="text-sm text-gray-400">{status}</p> : null}
        </div>
      </DashboardCard>
    </div>
  );
}
