import { buildInviteHomeUrl } from "@/lib/assetUrl";
import { useDadAuth } from "../../context/DadAuthContext";
import { useLocale } from "../../i18n/LocaleContext";

function AirdropIcon({ className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="17.25" r="1.4" fill="currentColor" stroke="none" />
      <path d="M10 16a2 2 0 0 1 4 0" />
      <path d="M8 16a4 4 0 0 1 8 0" />
      <path d="M5.5 16a6.5 6.5 0 0 1 13 0" />
      <circle cx="5.5" cy="15.25" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="18.5" cy="15.25" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function canUseWebShare(data) {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
    return false;
  }
  if (typeof navigator.canShare === "function") {
    try {
      return navigator.canShare(data);
    } catch {
      return false;
    }
  }
  return true;
}

export default function InviteHomeLink() {
  const { t } = useLocale();
  const { profile } = useDadAuth();
  const inviteUrl = buildInviteHomeUrl(profile?.proId);

  const openInviteFallback = () => {
    window.open(inviteUrl, "_blank", "noopener,noreferrer");
  };

  const handleInvite = (event) => {
    event.preventDefault();

    const shareData = {
      title: t("notifications.inviteShareTitle"),
      text: t("notifications.inviteShareText"),
      url: inviteUrl,
    };

    // Web Share opens the iOS sheet (AirDrop, Messages, Mail, etc.).
    // Call share as the first async step so the user-gesture token is kept.
    if (canUseWebShare(shareData)) {
      void navigator.share(shareData).catch((error) => {
        if (error?.name === "AbortError") return;
        openInviteFallback();
      });
      return;
    }

    if (canUseWebShare({ url: inviteUrl })) {
      void navigator.share({ url: inviteUrl }).catch((error) => {
        if (error?.name === "AbortError") return;
        openInviteFallback();
      });
      return;
    }

    openInviteFallback();
  };

  return (
    <button
      type="button"
      onClick={handleInvite}
      className="dda-invite-home-link"
      aria-label={t("notifications.inviteHomeAria")}
      title={t("notifications.inviteHomeTitle")}
    >
      <AirdropIcon className="h-4 w-4" />
    </button>
  );
}
