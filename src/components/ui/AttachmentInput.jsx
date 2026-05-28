import { useRef, useState } from "react";
import { Eye, FileText, Paperclip, Upload, X } from "lucide-react";
import { useFilesOptional } from "../../context/FilesContext";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_FILES = 8;
const MAX_EMBED_SIZE = 5 * 1024 * 1024;

function canEmbedForPreview(file) {
  const type = file.type || "";
  return type.startsWith("image/") || type === "application/pdf";
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function createAttachmentFromFile(file, dataUrl = null) {
  return {
    id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: file.name,
    size: file.size,
    type: file.type || "application/octet-stream",
    dataUrl,
  };
}

export function canPreviewAttachment(file) {
  if (!file?.dataUrl) return false;
  if (file.type?.startsWith("image/")) return true;
  if (file.type === "application/pdf") return true;
  return false;
}

export default function AttachmentInput({
  label = "Attachments",
  attachments = [],
  onChange,
  onPreview,
  fileSource,
  variant = "default",
  listVariant = "default",
}) {
  const inputRef = useRef(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const filesCtx = useFilesOptional();
  const isContrast = variant === "contrast";
  const isZebraList = listVariant === "zebra";

  const addFiles = async (fileList) => {
    if (!fileList?.length) return;
    setError("");

    const remaining = MAX_FILES - attachments.length;
    if (remaining <= 0) {
      setError(`Maximum ${MAX_FILES} files per card.`);
      return;
    }

    const files = Array.from(fileList).slice(0, remaining);
    const next = [...attachments];
    const added = [];

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        setError(`"${file.name}" exceeds the 5 MB limit.`);
        continue;
      }

      let dataUrl = null;
      if (file.size <= MAX_EMBED_SIZE && canEmbedForPreview(file)) {
        try {
          dataUrl = await readFileAsDataUrl(file);
        } catch {
          setError(`Could not read "${file.name}".`);
          continue;
        }
      }

      const entry = createAttachmentFromFile(file, dataUrl);
      next.push(entry);
      added.push(entry);
    }

    if (added.length > 0) {
      filesCtx?.registerFiles(added, fileSource ?? { type: "upload", label: label || "Upload" });
    }
    onChange(next);
  };

  const removeAttachment = (id) => {
    onChange(attachments.filter((file) => file.id !== id));
    setError("");
  };

  return (
    <div className="space-y-2">
      {label && (
        <span
          className={cn(
            "block text-xs",
            isContrast ? "font-semibold text-slate-900" : "font-medium text-slate-700"
          )}
        >
          {label}
        </span>
      )}

      <div
        className={cn(
          "rounded-xl border border-dashed p-3 transition",
          dragging
            ? "border-indigo-600 bg-indigo-100"
            : isContrast
              ? "border-slate-400 bg-white hover:border-slate-500"
              : "border-slate-200 bg-slate-50/40 hover:border-slate-300"
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-lg border bg-white px-3 py-2.5 text-xs font-semibold transition",
            isContrast
              ? "border-slate-400 text-slate-900 hover:border-indigo-600 hover:bg-indigo-50 hover:text-indigo-900"
              : "border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/40 hover:text-indigo-700"
          )}
        >
          <Upload className="h-3.5 w-3.5" />
          Upload files
        </button>
        <p
          className={cn(
            "mt-2 text-center text-[10px]",
            isContrast ? "text-slate-600" : "text-slate-400"
          )}
        >
          Drag & drop or click to attach · up to {MAX_FILES} files · 5 MB max each
        </p>
      </div>

      {error && <p className="text-[11px] font-medium text-red-500">{error}</p>}

      {attachments.length > 0 && (
        <ul
          className={cn(
            isZebraList ? "mt-1" : null,
            isZebraList
              ? "overflow-hidden rounded-xl border border-slate-200 divide-y divide-slate-100"
              : "space-y-1.5"
          )}
        >
          {attachments.map((file, index) => {
            const previewable = canPreviewAttachment(file);
            return (
            <li
              key={file.id}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5",
                isZebraList
                  ? index % 2 === 0
                    ? "bg-white"
                    : "bg-slate-50/90"
                  : cn(
                      "gap-2 rounded-lg border bg-white px-2.5 py-2",
                      isContrast ? "border-slate-300" : "border-slate-100"
                    )
              )}
            >
              <button
                type="button"
                disabled={!previewable || !onPreview}
                onClick={() => previewable && onPreview?.(file)}
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-indigo-50 text-indigo-600",
                  previewable && onPreview && "cursor-pointer ring-0 transition hover:ring-2 hover:ring-indigo-300"
                )}
              >
                {file.type?.startsWith("image/") && file.dataUrl ? (
                  <img
                    src={file.dataUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <FileText className="h-3.5 w-3.5" />
                )}
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-slate-800">{file.name}</p>
                <p className="text-[10px] text-slate-400">{formatFileSize(file.size)}</p>
              </div>
              {previewable && onPreview ? (
                <button
                  type="button"
                  onClick={() => onPreview(file)}
                  className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-[10px] font-semibold text-indigo-700 hover:bg-indigo-100"
                >
                  <Eye className="h-3 w-3" />
                  Preview
                </button>
              ) : null}
              {file.dataUrl ? (
                <a
                  href={file.dataUrl}
                  download={file.name}
                  className="shrink-0 text-[10px] font-medium text-indigo-600 hover:text-indigo-700"
                >
                  Download
                </a>
              ) : (
                <span className="flex shrink-0 items-center gap-0.5 text-[10px] text-slate-400">
                  <Paperclip className="h-3 w-3" />
                  Saved
                </span>
              )}
              <button
                type="button"
                onClick={() => removeAttachment(file.id)}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-500"
                aria-label={`Remove ${file.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          );
          })}
        </ul>
      )}
    </div>
  );
}
