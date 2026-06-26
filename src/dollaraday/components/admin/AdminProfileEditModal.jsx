import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { lockBodyScroll } from "@/lib/modalBodyLock";
import PasswordInput from "../auth/PasswordInput";
import { useLocale } from "../../i18n/LocaleContext";
import { formatPhoneInput } from "../../lib/phoneFormat";
import { updateDadProfileByAdmin } from "../../lib/profileAdminActions";

export default function AdminProfileEditModal({ profile, open, onClose, onSaved }) {
  const { t } = useLocale();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !profile) return;
    setUsername(profile.username ?? "");
    setDisplayName(profile.displayName ?? profile.fullName ?? "");
    setEmail(profile.email ?? "");
    setPhone(profile.phone ?? "");
    setRole(profile.role ?? "");
    setPassword("");
    setError("");
  }, [open, profile]);

  useEffect(() => {
    if (!open) return undefined;
    return lockBodyScroll();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || !profile) return null;

  const handleSubmit = (event) => {
    event.preventDefault();
    setError("");

    const result = updateDadProfileByAdmin(profile.id, {
      username,
      displayName,
      email,
      phone,
      role,
      password: password || undefined,
    });

    if (!result.ok) {
      setError(result.error);
      return;
    }

    onSaved?.(result.profile);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label={t("common.close")}
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-profile-edit-title"
        className="relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-dda-bg shadow-2xl sm:max-h-[88dvh] sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dda-accent-bar" />

        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-dda-green-light">
              {t("pages.admin.profileEditKicker")}
            </p>
            <h2 id="admin-profile-edit-title" className="mt-1 text-lg font-semibold text-white">
              {t("pages.admin.profileEditTitle")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="dda-scroll space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <label htmlFor="admin-edit-full-name" className="mb-1.5 block text-xs font-semibold text-gray-400">
              {t("login.fullName")}
            </label>
            <input
              id="admin-edit-full-name"
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="dda-input"
            />
          </div>

          <div>
            <label htmlFor="admin-edit-username" className="mb-1.5 block text-xs font-semibold text-gray-400">
              {t("login.username")}
            </label>
            <input
              id="admin-edit-username"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="dda-input"
            />
          </div>

          <div>
            <label htmlFor="admin-edit-email" className="mb-1.5 block text-xs font-semibold text-gray-400">
              {t("login.email")}
            </label>
            <input
              id="admin-edit-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="dda-input"
            />
          </div>

          <div>
            <label htmlFor="admin-edit-phone" className="mb-1.5 block text-xs font-semibold text-gray-400">
              {t("login.phone")}
            </label>
            <input
              id="admin-edit-phone"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(formatPhoneInput(event.target.value))}
              className="dda-input"
            />
          </div>

          <div>
            <label htmlFor="admin-edit-role" className="mb-1.5 block text-xs font-semibold text-gray-400">
              {t("pages.admin.memberDetailRole")}
            </label>
            <input
              id="admin-edit-role"
              type="text"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              placeholder={t("pages.admin.profileEditRolePlaceholder")}
              className="dda-input"
            />
          </div>

          <div>
            <label htmlFor="admin-edit-password" className="mb-1.5 block text-xs font-semibold text-gray-400">
              {t("login.password")}
            </label>
            <PasswordInput
              id="admin-edit-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t("pages.admin.profileEditPasswordPlaceholder")}
            />
          </div>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          <div className="flex flex-wrap gap-2 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-white/10 px-4 py-2.5 text-sm font-semibold text-gray-300 transition hover:bg-white/5 hover:text-white sm:flex-none"
            >
              {t("pages.admin.profileEditCancel")}
            </button>
            <button type="submit" className="dda-btn-primary flex-1 sm:flex-none">
              {t("pages.admin.profileEditSave")}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
