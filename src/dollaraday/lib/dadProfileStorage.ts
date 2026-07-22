import {
  ADMIN_PASSWORD,
  ADMIN_ROLE,
  ADMIN_USERNAME,
  ADMIN_WORKSPACE_NAME,
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

function readProfiles(): DadProfile[] {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DadProfile[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeProfiles(
  profiles: DadProfile[],
  options: { stamp?: boolean; pushToCloud?: boolean } = {},
) {
  const stamp = options.stamp !== false;
  const pushToCloud = options.pushToCloud !== false;
  const next = stamp
    ? profiles.map((profile) => ({
        ...profile,
        updatedAt: new Date().toISOString(),
      }))
    : profiles.map((profile) => ({ ...profile }));

  localStorage.setItem(PROFILES_KEY, JSON.stringify(next));
  notifyProfileListeners();

  if (pushToCloud) {
    queueMicrotask(() => {
      void import("./supabase/cloudSync").then(({ scheduleCloudProfilesPush }) => {
        scheduleCloudProfilesPush(next);
      });
    });
  }
}

function createId() {
  return crypto.randomUUID?.() ?? `dad-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
  return profile?.approvalStatus ?? "approved";
}

export function isProfilePendingApproval(profile: DadProfile | null | undefined): boolean {
  return getProfileApprovalStatus(profile) === "pending";
}

export function isProfileDenied(profile: DadProfile | null | undefined): boolean {
  return getProfileApprovalStatus(profile) === "denied";
}

export function isProfileLoginAllowed(profile: DadProfile | null | undefined): boolean {
  if (!profile) return false;
  if (isProfileSuspended(profile)) return false;
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
  if (!password) return { error: "Password is required." };
  if (password.length < 4) return { error: "Password must be at least 4 characters." };
  if (!displayName) return { error: "Full name is required." };
  if (findDadProfileByUsername(username)) return { error: "That username is already taken." };

  const now = new Date().toISOString();
  const proId = generateProId(username);
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
    approvalStatus: "pending",
    createdAt: now,
    lastLoginAt: now,
  };

  writeProfiles([...readProfiles(), profile]);
  return { profile };
}

export async function authenticateDadProfile(
  username: string,
  password: string,
): Promise<DadProfile | null> {
  const profile = findDadProfileByUsername(username);
  if (!profile || !(await verifyPassword(password, profile.password))) return null;
  if (!isProfileLoginAllowed(profile)) return null;

  const upgradedPassword =
    !isPasswordHash(profile.password) ? await hashPassword(password) : profile.password;
  const updated: DadProfile = {
    ...profile,
    password: upgradedPassword,
    lastLoginAt: new Date().toISOString(),
  };

  writeProfiles(readProfiles().map((item) => (item.id === profile.id ? updated : item)));
  return updated;
}

export async function profilePasswordMatches(
  profile: DadProfile,
  password: string,
): Promise<boolean> {
  return verifyPassword(password, profile.password);
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
      approvalStatus: "approved",
      createdAt: now,
      lastLoginAt: now,
    };
    writeProfiles([...profiles, profile]);
    return profile;
  }

  const updated: DadProfile = {
    ...profile,
    role: profile.role?.trim() || ADMIN_ROLE,
    fullName: profile.fullName?.trim() || ADMIN_ROLE,
    displayName: profile.displayName?.trim() || ADMIN_WORKSPACE_NAME,
    proId: profile.proId || generateProId(ADMIN_USERNAME),
    approvalStatus: profile.approvalStatus ?? "approved",
  };

  if (
    updated.role !== profile.role ||
    updated.fullName !== profile.fullName ||
    updated.displayName !== profile.displayName
  ) {
    writeProfiles(profiles.map((item) => (item.id === profile!.id ? updated : item)));
    return updated;
  }

  return profile;
}

export async function loginDadAdmin(username: string, password: string): Promise<DadProfile | null> {
  const normalized = username.trim().toLowerCase();
  if (normalized !== ADMIN_USERNAME) return null;

  const profile = await ensureDadAdminProfile();
  if (!(await verifyPassword(password, profile.password))) {
    if (password !== ADMIN_PASSWORD) return null;
  }

  const upgradedPassword =
    !isPasswordHash(profile.password) ? await hashPassword(password) : profile.password;
  const updated: DadProfile = {
    ...profile,
    password: upgradedPassword,
    lastLoginAt: new Date().toISOString(),
  };

  writeProfiles(readProfiles().map((item) => (item.id === profile.id ? updated : item)));
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
  if (!profile || !isProfileLoginAllowed(profile)) {
    if (profile && !isProfileLoginAllowed(profile)) {
      setDadSessionId(null);
    }
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

  const updated = updater(profiles[index]);
  const next = [...profiles];
  next[index] = updated;
  writeProfiles(next);
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
  notifyProfileListeners();
}

/** Replace local cache from cloud without re-stamping or re-pushing. */
export function replaceAllDadProfiles(profiles: DadProfile[]): void {
  writeProfiles(profiles, { stamp: false, pushToCloud: false });
}
