import { useState } from "react";
import { ArrowRight, FolderOpen, Upload } from "lucide-react";
import { useFiles } from "../../context/FilesContext";
import { formatFileSourceLabel } from "../../data/filesData";
import TaskAttachmentPreviewModal from "../tasks/TaskAttachmentPreview";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileBinWidget({ onOpenFileManager }) {
  const { binFiles } = useFiles();
  const [preview, setPreview] = useState(null);
  const recent = binFiles.slice(0, 5);

  return (
    <>
      <div className="group relative flex h-full min-h-[200px] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all hover:border-slate-300 hover:shadow-lg">
        <div className="h-1 w-full shrink-0 bg-gradient-to-r from-sky-500 to-cyan-500" />
        <div className="flex min-h-0 flex-1 flex-col p-4">
          <div className="mb-3 flex shrink-0 items-start justify-between gap-2">
            <div className="flex items-start gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 ring-1 ring-sky-500/15 ring-inset">
                <FolderOpen className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold tracking-tight text-slate-900">
                  Portfolio file bin
                </h3>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">
                  {binFiles.length} file{binFiles.length === 1 ? "" : "s"} saved
                </p>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 dashboard-widget-scroll">
            {recent.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-3 py-6 text-center">
                <Upload className="mb-2 h-6 w-6 text-slate-300" />
                <p className="text-xs font-medium text-slate-600">No files yet</p>
                <p className="mt-1 text-[10px] text-slate-400">
                  Uploads from tasks and projects appear here
                </p>
              </div>
            ) : (
              <ul className="space-y-1.5">
                {recent.map((file) => (
                  <li key={file.id}>
                    <button
                      type="button"
                      onClick={() =>
                        file.dataUrl &&
                        (file.type?.startsWith("image/") || file.type === "application/pdf") &&
                        setPreview(file)
                      }
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-2 py-2 text-left transition hover:border-sky-200 hover:bg-sky-50/50",
                        !file.dataUrl && "cursor-default"
                      )}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white ring-1 ring-slate-200">
                        {file.type?.startsWith("image/") && file.dataUrl ? (
                          <img src={file.dataUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <FolderOpen className="h-3.5 w-3.5 text-sky-600" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-slate-800">{file.name}</p>
                        <p className="truncate text-[10px] text-slate-400">
                          {formatFileSourceLabel(file)} · {formatFileSize(file.size)}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            type="button"
            onClick={onOpenFileManager}
            className="mt-2 flex w-full shrink-0 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white py-2 text-[11px] font-semibold text-sky-700 transition hover:border-sky-300 hover:bg-sky-50"
          >
            Open File Manager
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <TaskAttachmentPreviewModal
        attachment={preview}
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
      />
    </>
  );
}
