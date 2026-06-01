import { useMemo, useState } from "react";
import {
  Download,
  Eye,
  FileText,
  FolderOpen,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import AttachmentInput, { canPreviewAttachment } from "../ui/AttachmentInput";
import { useFiles } from "../../context/FilesContext";
import { formatFileSourceLabel } from "../../data/filesData";
import { logFileDownloaded } from "../../lib/workspaceActivityLog";
import TaskAttachmentPreviewModal from "../tasks/TaskAttachmentPreview";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUploadedAt(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export default function FileManagerPage() {
  const { binFiles, removeFile } = useFiles();
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [preview, setPreview] = useState(null);

  const sourceOptions = useMemo(() => {
    const types = new Set(binFiles.map((f) => f.source?.type ?? "upload"));
    return ["all", ...Array.from(types).sort()];
  }, [binFiles]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return binFiles.filter((file) => {
      if (sourceFilter !== "all" && (file.source?.type ?? "upload") !== sourceFilter) {
        return false;
      }
      if (!q) return true;
      const haystack = `${file.name} ${formatFileSourceLabel(file)}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [binFiles, search, sourceFilter]);

  const handleRemove = (file) => {
    if (
      window.confirm(
        `Delete "${file.name}" everywhere? It will be removed from the file bin, tasks, and projects.`
      )
    ) {
      removeFile(file.id);
    }
  };

  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-sky-50/40 p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-xl bg-sky-500/10 px-4 py-2 text-base font-bold text-sky-700 ring-1 ring-sky-500/15">
              <FolderOpen className="h-5 w-5" />
              File Manager
            </div>
            <p className="mt-3 max-w-xl text-sm text-slate-600">
              Your portfolio bin stores every file you upload from tasks, projects, and here.
              Files stay linked to where you uploaded them.
            </p>
          </div>
          <div className="rounded-xl border border-sky-200 bg-sky-50/80 px-4 py-3 text-center sm:text-right">
            <p className="text-2xl font-bold text-sky-800">{binFiles.length}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-600">
              Files in bin
            </p>
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-bold text-slate-900">Files & Attachments</h3>

          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search files…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
              />
            </div>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
            >
              {sourceOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt === "all" ? "All sources" : opt.replace(/-/g, " ")}
                </option>
              ))}
            </select>
          </div>

          {filtered.length > 0 ? (
              <ul className="space-y-2">
                {filtered.map((file) => {
                  const previewable = canPreviewAttachment(file);
                  return (
                    <li
                      key={file.id}
                      className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-3 sm:flex-nowrap"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-slate-200">
                        <FileText className="h-4 w-4 text-sky-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{file.name}</p>
                        <p className="text-[11px] text-slate-500">
                          {formatFileSourceLabel(file)} · {formatFileSize(file.size)} ·{" "}
                          {formatUploadedAt(file.uploadedAt)}
                        </p>
                      </div>
                      <div className="flex w-full shrink-0 items-center gap-1.5 sm:w-auto">
                        <button
                          type="button"
                          disabled={!previewable}
                          onClick={() => previewable && setPreview(file)}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold",
                            previewable
                              ? "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
                              : "cursor-not-allowed border-slate-200 text-slate-400"
                          )}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Preview
                        </button>
                        {file.dataUrl ? (
                          <a
                            href={file.dataUrl}
                            download={file.name}
                            onClick={() => logFileDownloaded(file, formatFileSourceLabel(file))}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-white"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Download
                          </a>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => handleRemove(file)}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-semibold text-red-700 hover:bg-red-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-16 text-center">
              <Upload className="mb-3 h-8 w-8 text-slate-300" />
              <p className="text-sm font-semibold text-slate-700">
                {binFiles.length === 0 ? "Your bin is empty" : "No files match your filters"}
              </p>
              <p className="mt-1 max-w-sm text-xs text-slate-500">
                Upload files below or attach files on tasks and projects — they will appear here
                automatically.
              </p>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-6 lg:self-start">
          <h3 className="mb-3 text-sm font-bold text-slate-900">Upload Documents</h3>
          <AttachmentInput
            label=""
            attachments={[]}
            onChange={() => {}}
            onPreview={setPreview}
            fileSource={{ type: "file-manager", label: "File Manager" }}
          />
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            Direct uploads are saved to your Files & Attachments and available across the app.
          </p>
        </div>
      </div>

      <TaskAttachmentPreviewModal
        attachment={preview}
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
      />
    </div>
  );
}
