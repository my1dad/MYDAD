import {
  ADMIN_PASSWORD,
  ADMIN_ROLE,
  ADMIN_USERNAME,
  ADMIN_WORKSPACE_NAME,
  isAdminProfile,
} from "../../config/admin";
import { generateProId, normalizeProId } from "./proId";
import { formatPhoneInput } from "./phoneFormat";
import { MEMBER_PROFILE_TEMPLATE } from "../../config/memberProfile";
import { hashPassword, isPasswordHash, verifyPassword } from "./passwordHash";

export type DadProfileAccountStatus = "active" | "suspended";
export type DadProfileApprovalStatus = "pending" | "approved" | "denied";

export interface DadProfile {
  id: string;
  username: string;
  password: string;
  displayName: string;
  fullName?: string;
  role?: string;
  proId?: string;
  /** Unique 16-digit member account number (digits only). */
  accountNumber?: string;
  email?: string;
  phone?: string;
  profilePhotoUrl?: string;
  referredByProId?: string;
  accountStatus?: DadProfileAccountStatus;
  approvalStatus?: DadProfileApprovalStatus;
  createdAt: string;
  lastLoginAt: string;
  updatedAt?: string;
}

const PROFILES_KEY = "dollar-a-day-profiles";
const SESSION_KEY = "dollar-a-day-session";
const PERSISTENT_SESSION_KEY = "dollar-a-day-persistent-session";
const REMEMBER_LOGIN_KEY = "dollar-a-day-remember-login";

type ProfileListener = () => void;
const profileListeners = new Set<ProfileListener>();
let profileRevision = 0;

type SessionListener = () => void;
const sessionListeners = new Set<SessionListener>();
let sessionRevision = 0;

function notifyProfileListeners() {
  profileRevision += 1;
  profileListeners.forEach((listener) => listener());
}

function notifySessionListeners() {
  sessionRevision += 1;
  sessionListeners.forEach((listener) => listener());
}

export function subscribeDadSession(listener: SessionListener): () => void {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
}

export function getDadSessionRevision(): number {
  return sessionRevision;
}

export function subscribeDadProfiles(listener: ProfileListener): () => void {
  profileListeners.add(listener);
  return () => profileListeners.delete(listener);
}

export function getDadProfileRevision(): number {
  return profileRevision;
}

export interface RememberLoginPrefs {
  rememberMe: boolean;
  username: string;
}

let profilesCache: DadProfile[] | null = null;

function isLocalBlankPlatformLocked(): boolean {
  try {
    return (
      localStorage.getItem("dollar-a-day-factory-zero") === "1" ||
      localStorage.getItem("dollar-a-day-platform-blank") === "1"
    );
  } catch {
    return false;
  }
}

/** While the platform is blank-locked, never surface stale cached members. */
function filterProfilesForBlankLock(profiles: DadProfile[]): DadProfile[] {
  if (!isLocalBlankPlatformLocked()) return profiles;
  return profiles.filter((profile) => isAdminProfile(profile)).slice(0, 1);
}

function readProfiles(): DadProfile[] {
  try {
    if (profilesCache) return filterProfilesForBlankLock(profilesCache);
    const raw = localStorage.getItem(PROFILES_KEY);
    if (!raw) {
      profilesCache = [];
      return profilesCache;
    }
    const parsed = JSON.parse(raw) as DadProfile[];
    profilesCache = Array.isArray(parsed) ? parsed : [];
    return filterProfilesForBlankLock(profilesCache);
  } catch {
    profilesCache = [];
    return profilesCache;
  }
}

/** Drop every non-admin profile from local cache/storage (blank platform). */
export function scrubLocalProfilesToAdminOnly(): DadProfile[] {
  // If login/signup already cleared the blank lock, do not re-arm it or wipe members.
  // Bootstrap schedules this asynchronously — it must not race an in-flight auth pull.
  if (!isLocalBlankPlatformLocked()) {
    return readProfiles();
  }

  const current = (() => {
    try {
      if (profilesCache) return profilesCache;
      const raw = localStorage.getItem(PROFILES_KEY);
      if (!raw) return [] as DadProfile[];
      const parsed = JSON.parse(raw) as DadProfile[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [] as DadProfile[];
    }
  })();
  const adminOnly = current.filter((profile) => isAdminProfile(profile)).slice(0, 1);
  // Do not push scrubbed directory to cloud — blank lock handles cloud separately.
  writeProfiles(adminOnly, { stamp: false, pushToCloud: false });
  return adminOnly;
}

/** Never restamp the whole directory — that let stale pending overwrite cloud approved. */
function writeProfiles(
  profiles: DadProfile[],
  options: { stamp?: boolean; stampIds?: string[]; pushToCloud?: boolean } = {},
) {
  const pushToCloud = options.pushToCloud !== false;
  const now = new Date().toISOString();
  let next: DadProfile[];

  if (options.stamp === false) {
    next = profiles.map((profile) => ({ ...profile }));
  } else if (options.stampIds?.length) {
    const ids = new Set(options.stampIds);
    next = profiles.map((profile) =>
      ids.has(profile.id) ? { ...profile, updatedAt: now } : { ...profile },
    );
  } else {
    next = profiles.map((profile) => ({ ...profile }));
  }

  // Blank lock: never persist stale members back into localStorage or queue a cloud push.
  const safeNext = isLocalBlankPlatformLocked()
    ? next.filter((profile) => isAdminProfile(profile)).slice(0, 1)
    : next;

  localStorage.setItem(PROFILES_KEY, JSON.stringify(safeNext));
  profilesCache = safeNext;
  notifyProfileListeners();

  if (pushToCloud && !isLocalBlankPlatformLocked()) {
    queueMicrotask(() => {
      void import("./supabase/cloudSync").then(({ scheduleCloudProfilesPush }) => {
        scheduleCloudProfilesPush();
      });
    });
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== PROFILES_KEY) return;
    profilesCache = null;
    notifyProfileListeners();
  });

  // Backfill 16-digit account numbers for existing local profiles on boot.
  queueMicrotask(() => {
    try {
      ensureProfileAccountNumbers();
    } catch (err) {
      console.warn("[dadProfileStorage] Account number backfill skipped:", err);
    }
  });
}

function createId() {
  return crypto.randomUUID?.() ?? `dad-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Prefer full directory for backups — blank-lock filter must not shrink exports. */
export function getDadProfilesForBackup(): DadProfile[] {
  try {
    if (profilesCache && profilesCache.length > 0) {
      return profilesCache.map((profile) => ({ ...profile }));
    }
    const raw = localStorage.getItem(PROFILES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DadProfile[];
    return Array.isArray(parsed) ? parsed.map((profile) => ({ ...profile })) : [];
  } catch {
    return [];
  }
}

export function getDadProfiles(): DadProfile[] {
  return readProfiles();
}

export function findDadProfileById(profileId: string): DadProfile | undefined {
  return readProfiles().find((profile) => profile.id === profileId);
}

export function isProfileSuspended(profile: DadProfile | null | undefined): boolean {
  return profile?.accountStatus === "suspended";
}

export function getProfileApprovalStatus(
  profile: DadProfile | null | undefined,
): DadProfileApprovalStatus {
  if (!profile) return "pending";
  if (profile.approvalStatus === "approved") return "approved";
  if (profile.approvalStatus === "denied") return "denied";
  if (profile.approvalStatus === "pending") return "pending";
  // Missing status: master admin is always approved; members must wait for review.
  return isAdminProfile(profile) ? "approved" : "pending";
}

export function isProfilePendingApproval(profile: DadProfile | null | undefined): boolean {
  return getProfileApprovalStatus(profile) === "pending";
}

export function isProfileDenied(profile: DadProfile | null | undefined): boolean {
  return getProfileApprovalStatus(profile) === "denied";
}

export function isProfileLoginAllowed(profile: DadProfile | null | undefined): boolean {
  if (!profile) return false;
  if (isAdminProfile(profile)) {
    return !isProfileSuspended(profile);
  }
  if (isProfileSuspended(profile)) return false;
  // Members may sign in only after master admin approval — never on create/pending.
  return getProfileApprovalStatus(profile) === "approved";
}

export function findDadProfileByUsername(username: string): DadProfile | undefined {
  const normalized = username.trim().toLowerCase();
  return readProfiles().find((profile) => profile.username.toLowerCase() === normalized);
}

export function findDadProfileByProId(proId: string): DadProfile | undefined {
  const normalized = normalizeProId(proId);
  if (!normalized) return undefined;
  return readProfiles().find((profile) => profile.proId?.toUpperCase() === normalized);
}

export function ensureProfileProIds(): void {
  const profiles = readProfiles();
  const taken = new Set(
    profiles.map((profile) => profile.proId?.toUpperCase()).filter(Boolean) as string[],
  );
  let changed = false;

  const next = profiles.map((profile) => {
    if (profile.proId) return profile;
    const proId = generateProId(profile.username, taken);
    changed = true;
    return { ...profile, proId };
  });

  if (changed) writeProfiles(next);
}

const ACCOUNT_NUMBER_LENGTH = 16;

function isValidAccountNumber(value: string | undefined | null): value is string {
  return typeof value === "string" && /^\d{16}$/.test(value);
}

/** Cryptographically random 16-digit account number (no leading zero). */
export function generateAccountNumberDigits(taken?: Set<string>): string {
  const used = taken ?? new Set(
    readProfiles()
      .map((profile) => profile.accountNumber)
      .filter(isValidAccountNumber),
  );

  for (let attempt = 0; attempt < 64; attempt += 1) {
    const bytes = new Uint8Array(ACCOUNT_NUMBER_LENGTH);
    crypto.getRandomValues(bytes);
    let digits = "";
    for (let i = 0; i < ACCOUNT_NUMBER_LENGTH; i += 1) {
      digits += String(bytes[i] % 10);
    }
    if (digits[0] === "0") {
      digits = `${1 + (bytes[0] % 9)}${digits.slice(1)}`;
    }
    if (!used.has(digits)) {
      used.add(digits);
      return digits;
    }
  }

  // Extremely unlikely fallback — timestamp + random padding.
  const fallback = `${Date.now()}${Math.floor(Math.random() * 1e6)}`.replace(/\D/g, "").slice(-16).padStart(16, "1");
  used.add(fallback);
  return fallback;
}

/** Backfill unique 16-digit account numbers for profiles that lack one. */
export function ensureProfileAccountNumbers(
  options: { pushToCloud?: boolean } = {},
): void {
  const pushToCloud = options.pushToCloud === true;
  const profiles = readProfiles();
  const taken = new Set(
    profiles.map((profile) => profile.accountNumber).filter(isValidAccountNumber),
  );
  let changed = false;

  const next = profiles.map((profile) => {
    if (isValidAccountNumber(profile.accountNumber)) {
      taken.add(profile.accountNumber);
      return profile;
    }
    const accountNumber = generateAccountNumberDigits(taken);
    changed = true;
    // Do not bump updatedAt — avoids pending rows winning cloud merge races.
    return {
      ...profile,
      accountNumber,
    };
  });

  if (changed) writeProfiles(next, { stamp: false, pushToCloud });
}

export function getProfileAccountNumber(profileId: string | null | undefined): string | null {
  if (!profileId) return null;
  const profile = findDadProfileById(profileId);
  return isValidAccountNumber(profile?.accountNumber) ? profile.accountNumber : null;
}

export function formatMaskedAccountNumber(accountNumber: string | null | undefined): string {
  if (!isValidAccountNumber(accountNumber)) return "•••• •••• •••• 0000";
  return `•••• •••• •••• ${accountNumber.slice(-4)}`;
}

/** Group 16 digits as #### #### #### #### for display. */
export function formatGroupedAccountNumber(accountNumber: string | null | undefined): string {
  if (!isValidAccountNumber(accountNumber)) return "0000 0000 0000 0000";
  return accountNumber.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

export async function createDadProfile(input: {
  username: string;
  password: string;
  displayName: string;
  email?: string;
  phone?: string;
  profilePhotoUrl?: string;
}): Promise<{ profile: DadProfile } | { error: string }> {
  const username = input.username.trim();
  const password = input.password.trim();
  const displayName = input.displayName.trim();

  if (!username) return { error: "Username is required." };
  if (username.length < 3) return { error: "Username must be at least 3 characters." };
  if (username.toLowerCase() === ADMIN_USERNAME) {
    return { error: "That username is reserved." };
  }
  if (!password) return { error: "Password is required." };
  if (password.length < 4) return { error: "Password must be at least 4 characters." };
  if (!displayName) return { error: "Full name is required." };
  if (findDadProfileByUsername(username)) return { error: "That username is already taken." };

  const now = new Date().toISOString();
  const proId = generateProId(username);
  const accountNumber = generateAccountNumberDigits();
  const profile: DadProfile = {
    id: createId(),
    username,
    password: await hashPassword(password),
    displayName,
    fullName: displayName,
    email: input.email?.trim() || undefined,
    phone: input.phone?.trim() ? formatPhoneInput(input.phone) : undefined,
    profilePhotoUrl: input.profilePhotoUrl?.trim() || undefined,
    role: MEMBER_PROFILE_TEMPLATE.role,
    proId,
    accountNumber,
    approvalStatus: "pending",
    createdAt: now,
    lastLoginAt: now,
    updatedAt: now,
  };

  // Open blank/factory locks BEFORE writing — otherwise writeProfiles strips the new
  // member immediately and they "disappear" from the UI.
  try {
    const { clearFactoryZeroDeliveryLock, clearCloudPlatformBlank } = await import(
      "./supabase/cloudSync"
    );
    clearFactoryZeroDeliveryLock();
    await clearCloudPlatformBlank();
  } catch (err) {
    console.warn("[dadProfileStorage] Could not clear blank lock before create:", err);
  }

  const existing = (() => {
    try {
      const raw = localStorage.getItem(PROFILES_KEY);
      if (!raw) return [] as DadProfile[];
      const parsed = JSON.parse(raw) as DadProfile[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [] as DadProfile[];
    }
  })();
  const next = [...existing.filter((item) => item.id !== profile.id), profile];
  writeProfiles(next, { stamp: false, pushToCloud: false });

  // Email master admin that a new profile needs approval (never block signup).
  void import("./signupAdminNotify").then(({ notifyAdminNewSignup }) => {
    void notifyAdminNewSignup(profile);
  });

  // Await cloud publish so master admin sees the new member on other devices immediately.
  try {
    const { persistMembersToCloud, scheduleCloudProfilesPush } = await import("./supabase/cloudSync");
    const pushed = await persistMembersToCloud([profile], { openPlatform: true });
    if (!pushed) {
      console.warn("[dadProfileStorage] Cloud profile push failed after create; queued retry.");
      queueMicrotask(() => {
        scheduleCloudProfilesPush();
      });
    } else {
      // Re-assert local directory after cloud publish (guards against a raced scrub).
      writeProfiles(
        (() => {
          try {
            const raw = localStorage.getItem(PROFILES_KEY);
            const parsed = raw ? (JSON.parse(raw) as DadProfile[]) : [];
            const list = Array.isArray(parsed) ? parsed : [];
            if (list.some((item) => item.id === profile.id)) return list;
            return [...list, profile];
          } catch {
            return [profile];
          }
        })(),
        { stamp: false, pushToCloud: false },
      );
    }
  } catch (err) {
    console.warn("[dadProfileStorage] Cloud profile push failed after create:", err);
    queueMicrotask(() => {
      void import("./supabase/cloudSync").then(({ scheduleCloudProfilesPush }) => {
        scheduleCloudProfilesPush();
      });
    });
  }

  return { profile };
}

export async function authenticateDadProfile(
  username: string,
  password: string,
  options: { profile?: DadProfile | null } = {},
): Promise<DadProfile | null> {
  // Auth uses the cloud-adopted directory from pullCloudProfileForAuth.
  // Do not clear blank/epoch locks here — that let stale devices republish old members.

  const profile = options.profile ?? findDadProfileByUsername(username.trim());
  const secret = password.trim();
  if (!profile || !(await verifyPassword(secret, profile.password))) return null;
  // Never authenticate the master-admin row through the member login path.
  if (isAdminProfile(profile)) return null;
  if (!isProfileLoginAllowed(profile)) return null;

  const upgradedPassword =
    !isPasswordHash(profile.password) ? await hashPassword(secret) : profile.password;
  const accountNumber = isValidAccountNumber(profile.accountNumber)
    ? profile.accountNumber
    : generateAccountNumberDigits();
  const updated: DadProfile = {
    ...profile,
    password: upgradedPassword,
    accountNumber,
    lastLoginAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Don't block sign-in on a cloud upsert — PostAuthWorkspace syncs shortly after.
  const directory = (() => {
    try {
      const raw = localStorage.getItem(PROFILES_KEY);
      if (!raw) return [] as DadProfile[];
      const parsed = JSON.parse(raw) as DadProfile[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [] as DadProfile[];
    }
  })();
  const next = directory.some((item) => item.id === profile.id)
    ? directory.map((item) => (item.id === profile.id ? updated : item))
    : [...directory, updated];
  writeProfiles(next, { stamp: false, pushToCloud: false });
  return updated;
}

export async function profilePasswordMatches(
  profile: DadProfile,
  password: string,
): Promise<boolean> {
  return verifyPassword(password.trim(), profile.password);
}

export async function ensureDadAdminProfile(): Promise<DadProfile> {
  const profiles = readProfiles();
  let profile = profiles.find((item) => item.username.toLowerCase() === ADMIN_USERNAME);

  if (!profile) {
    const now = new Date().toISOString();
    profile = {
      id: createId(),
      username: ADMIN_USERNAME,
      password: await hashPassword(ADMIN_PASSWORD),
      displayName: ADMIN_WORKSPACE_NAME,
      fullName: ADMIN_ROLE,
      role: ADMIN_ROLE,
      proId: generateProId(ADMIN_USERNAME),
      accountNumber: generateAccountNumberDigits(),
      approvalStatus: "approved",
      accountStatus: "active",
      createdAt: now,
      lastLoginAt: now,
      updatedAt: now,
    };
    writeProfiles([...profiles, profile], { stamp: false });
    return profile;
  }

  const updated: DadProfile = {
    ...profile,
    role: profile.role?.trim() || ADMIN_ROLE,
    fullName: profile.fullName?.trim() || ADMIN_ROLE,
    displayName: profile.displayName?.trim() || ADMIN_WORKSPACE_NAME,
    proId: profile.proId || generateProId(ADMIN_USERNAME),
    accountNumber: isValidAccountNumber(profile.accountNumber)
      ? profile.accountNumber
      : generateAccountNumberDigits(),
    approvalStatus: "approved",
    accountStatus: profile.accountStatus === "suspended" ? "suspended" : "active",
  };

  if (
    updated.role !== profile.role ||
    updated.fullName !== profile.fullName ||
    updated.displayName !== profile.displayName ||
    updated.approvalStatus !== profile.approvalStatus ||
    updated.accountStatus !== profile.accountStatus ||
    updated.proId !== profile.proId ||
    updated.accountNumber !== profile.accountNumber
  ) {
    writeProfiles(
      profiles.map((item) => (item.id === profile!.id ? updated : item)),
      { stamp: false },
    );
    return updated;
  }

  return profile;
}

export async function loginDadAdmin(username: string, password: string): Promise<DadProfile | null> {
  const normalized = username.trim().toLowerCase();
  if (normalized !== ADMIN_USERNAME) return null;

  const secret = password.trim();
  const profile = await ensureDadAdminProfile();
  if (!(await verifyPassword(secret, profile.password))) {
    if (secret !== ADMIN_PASSWORD) return null;
  }

  const upgradedPassword =
    !isPasswordHash(profile.password) ? await hashPassword(secret) : profile.password;
  const updated: DadProfile = {
    ...profile,
    password: upgradedPassword,
    approvalStatus: "approved",
    lastLoginAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  writeProfiles(
    readProfiles().map((item) => (item.id === profile.id ? updated : item)),
    { stamp: false, pushToCloud: false },
  );
  return updated;
}

export function getRememberLoginPrefs(): RememberLoginPrefs {
  try {
    const raw = localStorage.getItem(REMEMBER_LOGIN_KEY);
    if (!raw) return { rememberMe: false, username: "" };
    const parsed = JSON.parse(raw) as Partial<RememberLoginPrefs>;
    return {
      rememberMe: Boolean(parsed.rememberMe),
      username: typeof parsed.username === "string" ? parsed.username : "",
    };
  } catch {
    return { rememberMe: false, username: "" };
  }
}

export function setRememberLoginPrefs(prefs: RememberLoginPrefs): void {
  if (!prefs.rememberMe && !prefs.username.trim()) {
    localStorage.removeItem(REMEMBER_LOGIN_KEY);
    return;
  }

  localStorage.setItem(
    REMEMBER_LOGIN_KEY,
    JSON.stringify({
      rememberMe: prefs.rememberMe,
      username: prefs.username.trim(),
    }),
  );
}

export function clearRememberLoginPrefs(): void {
  localStorage.removeItem(REMEMBER_LOGIN_KEY);
}

export function getDadSessionId(): string | null {
  return (
    sessionStorage.getItem(SESSION_KEY) ?? localStorage.getItem(PERSISTENT_SESSION_KEY)
  );
}

export function setDadSessionId(
  profileId: string | null,
  options: { remember?: boolean } = {},
) {
  if (profileId) {
    sessionStorage.setItem(SESSION_KEY, profileId);
    if (options.remember) {
      localStorage.setItem(PERSISTENT_SESSION_KEY, profileId);
    } else {
      localStorage.removeItem(PERSISTENT_SESSION_KEY);
    }
    notifySessionListeners();
    return;
  }

  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(PERSISTENT_SESSION_KEY);
  notifySessionListeners();
}

export function getActiveDadProfile(): DadProfile | null {
  const sessionId = getDadSessionId();
  if (!sessionId) return null;
  const profile = readProfiles().find((item) => item.id === sessionId) ?? null;
  // Orphan / blocked sessions must clear — otherwise the shell preloader can stay up forever.
  if (!profile || !isProfileLoginAllowed(profile)) {
    setDadSessionId(null);
    return null;
  }
  return profile;
}

export function updateDadProfileRecord(
  profileId: string,
  updater: (profile: DadProfile) => DadProfile,
): DadProfile | null {
  const profiles = readProfiles();
  const index = profiles.findIndex((item) => item.id === profileId);
  if (index < 0) return null;

  const updated: DadProfile = {
    ...updater(profiles[index]),
    updatedAt: new Date().toISOString(),
  };
  const next = [...profiles];
  next[index] = updated;
  writeProfiles(next, { stamp: false });
  return updated;
}

export function removeDadProfileRecord(profileId: string): boolean {
  const profiles = readProfiles();
  const next = profiles.filter((item) => item.id !== profileId);
  if (next.length === profiles.length) return false;
  writeProfiles(next);
  return true;
}

export function clearAllDadProfiles(): void {
  localStorage.removeItem(PROFILES_KEY);
  profilesCache = null;
  notifyProfileListeners();
}

/** Persist only the given profiles (used by master reset to keep admin alone). */
export function replaceDadProfilesLocal(profiles: DadProfile[]): void {
  writeProfiles(profiles, { stamp: false, pushToCloud: false });
}

export function findMasterAdminProfile(): DadProfile | undefined {
  return readProfiles().find(
    (profile) => profile.username.trim().toLowerCase() === ADMIN_USERNAME,
  );
}

/** Replace local cache from cloud without re-stamping or re-pushing. */
export function replaceAllDadProfiles(profiles: DadProfile[]): void {
  writeProfiles(profiles, { stamp: false, pushToCloud: false });
  // Local-only backfill — never cloud-push here (would re-poison approvals).
  ensureProfileAccountNumbers({ pushToCloud: false });
}
