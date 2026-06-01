import { ArrowRight, FolderOpen } from "lucide-react";
import { useFiles } from "../../context/FilesContext";
import AttachmentInput from "../ui/AttachmentInput";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default function FileBinWidget({ onOpenFileManager }) {
  const { binFiles } = useFiles();

  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all hover:border-slate-300 hover:shadow-lg">
      <div className="h-1 w-full shrink-0 bg-gradient-to-r from-sky-500 to-cyan-500" />
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-4 flex shrink-0 items-start gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 ring-1 ring-sky-500/15 ring-inset">
            <FolderOpen className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold tracking-tight text-slate-900">
              Portfolio file bin
            </h3>
            <p className="mt-0.5 truncate text-[11px] text-slate-500">
              {binFiles.length === 0
                ? "No files uploaded yet"
                : `${binFiles.length} file${binFiles.length === 1 ? "" : "s"} stored`}
            </p>
          </div>
        </div>

        <div className="mt-auto shrink-0 space-y-2">
          <AttachmentInput
            label=""
            attachments={[]}
            onChange={() => {}}
            fileSource={{ type: "dashboard", label: "Dashboard" }}
          />
          <button
            type="button"
            onClick={onOpenFileManager}
            className={cn(
              "flex w-full items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white py-2 text-[11px] font-semibold text-sky-700 transition hover:border-sky-300 hover:bg-sky-50"
            )}
          >
            Open File Manager
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
