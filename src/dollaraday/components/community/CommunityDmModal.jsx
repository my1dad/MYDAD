import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MessageCircle, X } from "lucide-react";
import { lockBodyScroll } from "@/lib/modalBodyLock";
import { sendCommunityDirectMessage } from "../../lib/communityDm";
import { useLocale } from "../../i18n/LocaleContext";

export default function CommunityDmModal({ open, onClose, recipient }) {
  const { t } = useLocale();
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    return lockBodyScroll();
  }, [open]);

  if (!open || !recipient?.profileId) return null;

  const handleClose = () => {
    setBody("");
    setError("");
    setSent(false);
    onClose?.();
  };

  const handleSend = () => {
    const result = sendCommunityDirectMessage({
      toProfileId: recipient.profileId,
      body,
      replyToPostId: recipient.postId,
      recipientName: recipient.name,
    });

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setSent(true);
    setBody("");
    setError("");
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label={t("common.close")}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="community-dm-title"
        className="relative w-full max-w-md overflow-hidden rounded-t-3xl border border-white/10 bg-dda-bg shadow-2xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dda-accent-bar" />

        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="flex min-w-0 items-center gap-2">
            <MessageCircle className="h-4 w-4 shrink-0 text-dda-green-light" aria-hidden="true" />
            <h2 id="community-dm-title" className="truncate text-base font-semibold text-white">
              {t("notifications.dmTitle", { name: recipient.name })}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-white/5 hover:text-white"
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          {sent ? (
            <p className="text-sm text-dda-green-light">{t("notifications.dmSent")}</p>
          ) : (
            <>
              <p className="text-sm text-gray-400">{t("notifications.dmHint")}</p>
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={4}
                className="dda-input w-full resize-none"
                placeholder={t("notifications.dmPlaceholder")}
              />
              {error ? <p className="text-sm text-red-400">{error}</p> : null}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-white/10 px-5 py-4">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg px-3 py-2 text-sm font-medium text-gray-400 transition hover:bg-white/5 hover:text-white"
          >
            {t("common.close")}
          </button>
          {!sent ? (
            <button
              type="button"
              onClick={handleSend}
              disabled={body.trim().length < 2}
              className="dda-btn-primary px-3 py-2 text-sm disabled:opacity-50"
            >
              {t("notifications.dmSend")}
            </button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
