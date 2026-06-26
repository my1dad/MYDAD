import { useRef } from "react";
import { Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "../../i18n/LocaleContext";

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

function initialsFromName(name) {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default function ProfilePhotoPicker({
  photoUrl,
  name,
  onPhotoChange,
  onError,
}) {
  const { t } = useLocale();
  const inputRef = useRef(null);
  const initials = initialsFromName(name);

  const openFilePicker = () => inputRef.current?.click();

  const handleFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      onError?.(t("login.profilePhotoInvalid"));
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      onError?.(t("login.profilePhotoTooLarge"));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onPhotoChange(reader.result);
        onError?.("");
      }
    };
    reader.onerror = () => onError?.(t("login.profilePhotoInvalid"));
    reader.readAsDataURL(file);
  };

  return (
    <div className="dda-profile-photo-picker">
      <div className="dda-profile-photo-picker__avatar-wrap">
        <button
          type="button"
          onClick={openFilePicker}
          className={cn(
            "dda-profile-photo-picker__button",
            photoUrl && "dda-profile-photo-picker__button--has-photo",
          )}
          aria-label={photoUrl ? t("login.profilePhotoChange") : t("login.profilePhotoUpload")}
        >
          {photoUrl ? (
            <img src={photoUrl} alt="" className="dda-profile-photo-picker__image" />
          ) : (
            <span className="dda-profile-photo-picker__initials">{initials}</span>
          )}
        </button>

        <button
          type="button"
          onClick={openFilePicker}
          className="dda-profile-photo-picker__badge"
          aria-label={photoUrl ? t("login.profilePhotoChange") : t("login.profilePhotoUpload")}
        >
          <Camera className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      <div className="dda-profile-photo-picker__copy">
        <button
          type="button"
          onClick={openFilePicker}
          className="text-sm font-semibold text-dda-green-light transition hover:text-white"
        >
          {photoUrl ? t("login.profilePhotoChange") : t("login.profilePhotoUpload")}
        </button>
        {photoUrl ? (
          <button
            type="button"
            onClick={() => onPhotoChange("")}
            className="text-xs text-gray-500 transition hover:text-gray-300"
          >
            {t("login.profilePhotoRemove")}
          </button>
        ) : (
          <p className="text-xs text-gray-500">{t("login.profilePhotoHint")}</p>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleFile}
      />
    </div>
  );
}
