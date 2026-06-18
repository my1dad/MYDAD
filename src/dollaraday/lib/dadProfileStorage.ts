import {
  ADMIN_PASSWORD,
  ADMIN_ROLE,
  ADMIN_USERNAME,
  ADMIN_WORKSPACE_NAME,
} from "../../config/admin";

export interface DadProfile {
  id: string;
  username: string;
  password: string;
  displayName: string;
  fullName?: string;
  role?: string;
  createdAt: string;
  lastLoginAt: string;
}

const PROFILES_KEY = "dollar-a-day-profiles";
const SESSION_KEY = "dollar-a-day-session";

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

function writeProfiles(profiles: DadProfile[]) {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
}

function createId() {
  return crypto.randomUUID?.() ?? `dad-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getDadProfiles(): DadProfile[] {
  return readProfiles();
}

export function findDadProfileByUsername(username: string): DadProfile | undefined {
  const normalized = username.trim().toLowerCase();
  return readProfiles().find((profile) => profile.username.toLowerCase() === normalized);
}

export function createDadProfile(input: {
  username: string;
  password: string;
  displayName: string;
}): { profile: DadProfile } | { error: string } {
  const username = input.username.trim();
  const password = input.password.trim();
  const displayName = input.displayName.trim();

  if (!username) return { error: "Username is required." };
  if (username.length < 3) return { error: "Username must be at least 3 characters." };
  if (!password) return { error: "Password is required." };
  if (password.length < 4) return { error: "Password must be at least 4 characters." };
  if (!displayName) return { error: "Display name is required." };
  if (findDadProfileByUsername(username)) return { error: "That username is already taken." };

  const now = new Date().toISOString();
  const profile: DadProfile = {
    id: createId(),
    username,
    password,
    displayName,
    createdAt: now,
    lastLoginAt: now,
  };

  writeProfiles([...readProfiles(), profile]);
  return { profile };
}

export function authenticateDadProfile(username: string, password: string): DadProfile | null {
  const profile = findDadProfileByUsername(username);
  if (!profile || profile.password !== password.trim()) return null;

  const updated: DadProfile = {
    ...profile,
    lastLoginAt: new Date().toISOString(),
  };

  writeProfiles(readProfiles().map((item) => (item.id === profile.id ? updated : item)));
  return updated;
}

export function ensureDadAdminProfile(): DadProfile {
  const profiles = readProfiles();
  let profile = profiles.find((item) => item.username.toLowerCase() === ADMIN_USERNAME);

  if (!profile) {
    const now = new Date().toISOString();
    profile = {
      id: createId(),
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD,
      displayName: ADMIN_WORKSPACE_NAME,
      fullName: ADMIN_ROLE,
      role: ADMIN_ROLE,
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

export function loginDadAdmin(username: string, password: string): DadProfile | null {
  const normalized = username.trim().toLowerCase();
  if (normalized !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) return null;

  const profile = ensureDadAdminProfile();
  const updated: DadProfile = {
    ...profile,
    lastLoginAt: new Date().toISOString(),
  };

  writeProfiles(readProfiles().map((item) => (item.id === profile.id ? updated : item)));
  setDadSessionId(updated.id);
  return updated;
}

export function getDadSessionId(): string | null {
  return sessionStorage.getItem(SESSION_KEY);
}

export function setDadSessionId(profileId: string | null) {
  if (profileId) {
    sessionStorage.setItem(SESSION_KEY, profileId);
  } else {
    sessionStorage.removeItem(SESSION_KEY);
  }
}

export function getActiveDadProfile(): DadProfile | null {
  const sessionId = getDadSessionId();
  if (!sessionId) return null;
  return readProfiles().find((profile) => profile.id === sessionId) ?? null;
}
