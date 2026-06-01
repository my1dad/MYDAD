import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Download, Eye, FileText, X } from "lucide-react";
import { canPreviewAttachment } from "../ui/AttachmentInput";
import { lockBodyScroll } from "../../lib/modalBodyLock";
import { logFileDownloaded } from "../../lib/workspaceActivityLog";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Clickable thumbnail grid for images and PDFs */
export function TaskAttachmentGallery({ attachments = [], onPreview, size = "md" }) {
  if (!attachments.length) return null;

  const tileClass =
    size === "lg"
      ? "aspect-[4/3] min-h-[120px]"
      : "aspect-square min-h-[88px]";

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {attachments.map((file) => {
        const previewable = canPreviewAttachment(file);
        const isImage = file.type?.startsWith("image/") && file.dataUrl;
        const isPdf = file.type === "application/pdf" && file.dataUrl;

        return (
          <button
            key={file.id}
            type="button"
            disabled={!previewable}
            onClick={() => previewable && onPreview?.(file)}
            className={cn(
              "group relative overflow-hidden rounded-xl border bg-white text-left transition",
              tileClass,
              previewable
                ? "cursor-pointer border-slate-200 hover:border-indigo-300 hover:shadow-md"
                : "cursor-default border-slate-200 opacity-90"
            )}
          >
            {isImage ? (
              <img
                src={file.dataUrl}
                alt={file.name}
                className="h-full w-full object-cover"
              />
            ) : isPdf ? (
              <div className="flex h-full w-full flex-col items-center justify-center bg-red-50/80">
                <FileText className="h-8 w-8 text-red-500" />
                <span className="mt-1 text-[10px] font-bold uppercase tracking-wide text-red-600">
                  PDF
                </span>
              </div>
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center bg-slate-50 px-2">
                <FileText className="h-7 w-7 text-slate-400" />
              </div>
            )}

            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/80 to-transparent px-2 pb-2 pt-6">
              <p className="truncate text-[10px] font-semibold text-white">{file.name}</p>
              <p className="text-[9px] text-slate-300">{formatFileSize(file.size)}</p>
            </div>

            {previewable ? (
              <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-indigo-700 opacity-0 shadow-sm transition group-hover:opacity-100">
                <Eye className="h-3.5 w-3.5" />
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function TaskAttachmentPreviewList({ attachments = [], onPreview, variant = "default" }) {
  if (!attachments.length) return null;

  const isZebra = variant === "zebra";

  return (
    <ul
      className={cn(
        isZebra
          ? "overflow-hidden rounded-xl border border-slate-200 divide-y divide-slate-100"
          : "space-y-2"
      )}
    >
      {attachments.map((file, index) => {
        const previewable = canPreviewAttachment(file);
        return (
          <li
            key={file.id}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5",
              isZebra
                ? index % 2 === 0
                  ? "bg-white"
                  : "bg-slate-50/90"
                : "rounded-xl border border-slate-200 bg-white"
            )}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-indigo-50 text-indigo-600">
              {file.type?.startsWith("image/") && file.dataUrl ? (
                <img src={file.dataUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800">{file.name}</p>
              <p className="text-[11px] text-slate-400">{formatFileSize(file.size)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                disabled={!previewable}
                onClick={() => previewable && onPreview?.(file)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition",
                  previewable
                    ? "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                    : "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                )}
              >
                <Eye className="h-3.5 w-3.5" />
                Preview
              </button>
              {file.dataUrl ? (
                <a
                  href={file.dataUrl}
                  download={file.name}
                  onClick={() => logFileDownloaded(file)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </a>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function TaskAttachmentPreviewModal({ attachment, open, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return undefined;
    return lockBodyScroll();
  }, [open]);

  if (!open || !attachment) return null;

  const isImage = attachment.type?.startsWith("image/") && attachment.dataUrl;
  const isPdf = attachment.type === "application/pdf" && attachment.dataUrl;

  return createPortal(
    <div className="fixed inset-0 z-[200] overflow-y-auto">
      <button
        type="button"
        aria-label="Close preview"
        className="fixed inset-0 bg-slate-900/55 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
        <div
          role="dialog"
          aria-labelledby="attachment-preview-title"
          className="relative z-10 flex max-h-[min(calc(100vh-2rem),720px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Attachment preview
              </p>
              <h3 id="attachment-preview-title" className="truncate text-sm font-semibold text-slate-900">
                {attachment.name}
              </h3>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {attachment.dataUrl ? (
                <a
                  href={attachment.dataUrl}
                  download={attachment.name}
                  onClick={() => logFileDownloaded(attachment)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </a>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto bg-slate-50 p-4">
            {isImage ? (
              <img
                src={attachment.dataUrl}
                alt={attachment.name}
                className="mx-auto max-h-full w-auto max-w-full rounded-lg border border-slate-200 bg-white object-contain shadow-sm"
              />
            ) : isPdf ? (
              <iframe
                title={attachment.name}
                src={attachment.dataUrl}
                className="h-[calc(min(100vh-2rem,720px)-4.5rem)] min-h-[360px] w-full rounded-lg border border-slate-200 bg-white"
              />
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
                <FileText className="mb-3 h-10 w-10 text-slate-300" />
                <p className="text-sm font-semibold text-slate-700">Preview not available</p>
                <p className="mt-1 max-w-sm text-xs text-slate-500">
                  This file type cannot be previewed here. Use Download to open it locally.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
