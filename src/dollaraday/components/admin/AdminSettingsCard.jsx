import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  Bell,
  Download,
  Globe,
  RotateCcw,
  Upload,
  UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";
import DashboardCard from "../layout/DashboardCard";
import PasswordInput from "../auth/PasswordInput";
import { useDadAuth } from "../../context/DadAuthContext";
import { useLocale } from "../../i18n/LocaleContext";
import {
  getAppSettings,
  getAppSettingsRevision,
  subscribeAppSettings,
  TIMEZONE_OPTIONS,
  updateAppSettings,
} from "../../lib/appSettings";
import { downloadDashboardCsv, importDashboardCsv } from "../../lib/dashboardCsv";
import { formatPhoneInput } from "../../lib/phoneFormat";
import { updateMasterAdminOwnProfile } from "../../lib/profileAdminActions";
import { masterResetDashboard } from "../../lib/workspaceReset";

function useAppSettings() {
  const revision = useSyncExternalStore(subscribeAppSettings, getAppSettingsRevision, () => 0);
  return { settings: getAppSettings(), revision };
}

function SettingsSection({ icon: Icon, title, description, children }) {
  return (
    <section className="rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="mb-3 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-dda-green/15 text-dda-green-light ring-1 ring-dda-green/25">
          <Icon className="h-4 w-4" strokeWidth={2.25} />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          {description ? <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export default function AdminSettingsCard() {
  const { t } = useLocale();
  const { profile, isAdmin } = useDadAuth();
  const { settings } = useAppSettings();
  const fileInputRef = useRef(null);

  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [resetting, setResetting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);

  const [displayName, setDisplayName] = useState(profile?.displayName ?? "");
  const [email, setEmail] = useState(profile?.email ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName ?? "");
    setEmail(profile.email ?? "");
    setPhone(profile.phone ?? "");
  }, [profile]);

  if (!isAdmin) return null;

  const notificationsSupported = typeof window !== "undefined" && "Notification" in window;
  const notificationPermission =
    notificationsSupported && typeof Notification !== "undefined" ? Notification.permission : "default";

  const handleSaveCsv = () => {
    setError("");
    downloadDashboardCsv();
    setStatus(t("pages.admin.settings.csvSaved"));
  };

  const handleLoadCsv = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImporting(true);
    setError("");
    setStatus("");

    try {
      const text = await file.text();
      const result = importDashboardCsv(text);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setStatus(t("pages.admin.settings.csvLoaded"));
      window.setTimeout(() => window.location.reload(), 600);
    } catch {
      setError(t("pages.admin.settings.csvLoadFailed"));
    } finally {
      setImporting(false);
    }
  };

  const handleMasterReset = async () => {
    const confirmed = window.confirm(t("pages.admin.settings.masterResetConfirm"));
    if (!confirmed) return;

    const finalConfirm = window.confirm(t("pages.admin.settings.masterResetConfirmFinal"));
    if (!finalConfirm) return;

    setResetting(true);
    setError("");
    try {
      await masterResetDashboard();
      window.location.reload();
    } catch {
      setError(t("pages.admin.settings.masterResetFailed"));
      setResetting(false);
    }
  };

  const handleNotificationToggle = async () => {
    setError("");
    if (!notificationsSupported) {
      setError(t("pages.admin.settings.notificationsUnsupported"));
      return;
    }

    if (!settings.notificationsEnabled) {
      const permission = await Notification.requestPermission();
      const enabled = permission === "granted";
      updateAppSettings({ notificationsEnabled: enabled });
      setStatus(
        enabled
          ? t("pages.admin.settings.notificationsEnabled")
          : t("pages.admin.settings.notificationsDenied"),
      );
      return;
    }

    updateAppSettings({ notificationsEnabled: false });
    setStatus(t("pages.admin.settings.notificationsDisabled"));
  };

  const handleTimezoneChange = (event) => {
    updateAppSettings({ timezone: event.target.value });
    setStatus(t("pages.admin.settings.timezoneUpdated"));
  };

  const handleAccountSave = async (event) => {
    event.preventDefault();
    setSavingAccount(true);
    setError("");
    setStatus("");

    const result = await updateMasterAdminOwnProfile({
      displayName,
      email,
      phone,
      password: password || undefined,
    });

    setSavingAccount(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setPassword("");
    setStatus(t("pages.admin.settings.accountSaved"));
  };

  return (
    <DashboardCard
      title={t("pages.admin.settings.title")}
      subtitle={t("pages.admin.settings.subtitle")}
      collapsible
      defaultCollapsed
      collapseAriaLabel={t("pages.admin.settings.collapse")}
      expandAriaLabel={t("pages.admin.settings.expand")}
    >
      <div className="space-y-4">
        <SettingsSection
          icon={Download}
          title={t("pages.admin.settings.csvTitle")}
          description={t("pages.admin.settings.csvDesc")}
        >
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSaveCsv}
              className="inline-flex items-center gap-1.5 rounded-lg border border-dda-green/25 bg-dda-green/10 px-3 py-2 text-xs font-semibold text-dda-green-light transition hover:bg-dda-green/15"
            >
              <Download className="h-3.5 w-3.5" />
              {t("pages.admin.settings.saveCsv")}
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10 disabled:opacity-60"
            >
              <Upload className={cn("h-3.5 w-3.5", importing && "animate-pulse")} />
              {t("pages.admin.settings.loadCsv")}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleLoadCsv}
            />
          </div>
        </SettingsSection>

        <SettingsSection
          icon={RotateCcw}
          title={t("pages.admin.settings.masterResetTitle")}
          description={t("pages.admin.settings.masterResetDesc")}
        >
          <button
            type="button"
            onClick={handleMasterReset}
            disabled={resetting}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/15 disabled:opacity-60"
          >
            <RotateCcw className={cn("h-3.5 w-3.5", resetting && "animate-spin")} />
            {t("pages.admin.settings.masterResetAction")}
          </button>
        </SettingsSection>

        <SettingsSection
          icon={Bell}
          title={t("pages.admin.settings.notificationsTitle")}
          description={t("pages.admin.settings.notificationsDesc")}
        >
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={settings.notificationsEnabled}
              onClick={handleNotificationToggle}
              className={cn(
                "relative h-7 w-12 rounded-full transition",
                settings.notificationsEnabled ? "bg-dda-green-light/80" : "bg-white/15",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition",
                  settings.notificationsEnabled ? "left-[22px]" : "left-0.5",
                )}
              />
            </button>
            <span className="text-xs text-gray-400">
              {settings.notificationsEnabled
                ? t("pages.admin.settings.notificationsOn")
                : t("pages.admin.settings.notificationsOff")}
              {notificationsSupported ? ` · ${notificationPermission}` : ""}
            </span>
          </div>
        </SettingsSection>

        <SettingsSection
          icon={Globe}
          title={t("pages.admin.settings.timezoneTitle")}
          description={t("pages.admin.settings.timezoneDesc")}
        >
          <select
            value={settings.timezone}
            onChange={handleTimezoneChange}
            className="dda-select w-full max-w-sm"
          >
            {TIMEZONE_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {t(option.labelKey)}
              </option>
            ))}
          </select>
        </SettingsSection>

        <SettingsSection
          icon={UserCog}
          title={t("pages.admin.settings.accountTitle")}
          description={t("pages.admin.settings.accountDesc")}
        >
          <form onSubmit={handleAccountSave} className="space-y-3">
            <div>
              <label htmlFor="admin-settings-name" className="mb-1.5 block text-xs font-semibold text-gray-400">
                {t("login.fullName")}
              </label>
              <input
                id="admin-settings-name"
                type="text"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className="dda-input"
              />
            </div>
            <div>
              <label htmlFor="admin-settings-email" className="mb-1.5 block text-xs font-semibold text-gray-400">
                {t("login.email")}
              </label>
              <input
                id="admin-settings-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="dda-input"
              />
            </div>
            <div>
              <label htmlFor="admin-settings-phone" className="mb-1.5 block text-xs font-semibold text-gray-400">
                {t("login.phone")}
              </label>
              <input
                id="admin-settings-phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(formatPhoneInput(event.target.value))}
                className="dda-input"
              />
            </div>
            <div>
              <label htmlFor="admin-settings-password" className="mb-1.5 block text-xs font-semibold text-gray-400">
                {t("login.password")}
              </label>
              <PasswordInput
                id="admin-settings-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t("pages.admin.profileEditPasswordPlaceholder")}
              />
            </div>
            <button
              type="submit"
              disabled={savingAccount}
              className="dda-btn-primary px-4 py-2.5 text-sm disabled:opacity-60"
            >
              {t("pages.admin.settings.accountSave")}
            </button>
          </form>
        </SettingsSection>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        {status ? <p className="text-sm text-gray-400">{status}</p> : null}
      </div>
    </DashboardCard>
  );
}
