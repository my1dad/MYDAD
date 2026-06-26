const SETTINGS_KEY = "dollar-a-day-app-settings";

export const DEFAULT_TIMEZONE = "America/New_York";

export const TIMEZONE_OPTIONS = [
  { id: "America/New_York", labelKey: "pages.admin.settings.timezoneEastern" },
  { id: "America/Chicago", labelKey: "pages.admin.settings.timezoneCentral" },
  { id: "America/Denver", labelKey: "pages.admin.settings.timezoneMountain" },
  { id: "America/Los_Angeles", labelKey: "pages.admin.settings.timezonePacific" },
  { id: "America/Phoenix", labelKey: "pages.admin.settings.timezoneArizona" },
  { id: "Pacific/Honolulu", labelKey: "pages.admin.settings.timezoneHawaii" },
  { id: "UTC", labelKey: "pages.admin.settings.timezoneUtc" },
] as const;

export interface AppSettings {
  timezone: string;
  notificationsEnabled: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  timezone: DEFAULT_TIMEZONE,
  notificationsEnabled: false,
};

type SettingsListener = () => void;
const listeners = new Set<SettingsListener>();
let settingsRevision = 0;

function notifyListeners(): void {
  settingsRevision += 1;
  listeners.forEach((listener) => listener());
}

function readSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      timezone:
        typeof parsed.timezone === "string" && parsed.timezone.trim()
          ? parsed.timezone.trim()
          : DEFAULT_TIMEZONE,
      notificationsEnabled: Boolean(parsed.notificationsEnabled),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function writeSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  notifyListeners();
  queueMicrotask(() => {
    void import("./supabase/cloudSync").then(({ scheduleCloudKvPush }) => {
      scheduleCloudKvPush("dollar-a-day-app-settings");
    });
  });
}

export function getAppSettings(): AppSettings {
  return readSettings();
}

export function getAppTimezone(): string {
  return readSettings().timezone;
}

export function areAppNotificationsEnabled(): boolean {
  return readSettings().notificationsEnabled;
}

export function updateAppSettings(patch: Partial<AppSettings>): AppSettings {
  const next = { ...readSettings(), ...patch };
  writeSettings(next);
  return next;
}

export function resetAppSettings(): void {
  localStorage.removeItem(SETTINGS_KEY);
  notifyListeners();
}

export function subscribeAppSettings(listener: SettingsListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAppSettingsRevision(): number {
  return settingsRevision;
}
