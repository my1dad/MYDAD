import { isAdminProfile } from "../../config/admin";
import {
  ensureDadAdminProfile,
  findDadProfileById,
  findDadProfileByUsername,
  getDadSessionId,
  getProfileApprovalStatus,
  isProfilePendingApproval,
  isProfileSuspended,
  removeDadProfileRecord,
  setDadSessionId,
  updateDadProfileRecord,
  type DadProfile,
} from "./dadProfileStorage";
import { hashPassword } from "./passwordHash";
import { removeDataRecord, removeDataRecordsByPayload } from "./internalDatabase";
import { formatPhoneInput } from "./phoneFormat";
import { logProfileActivity } from "./profileActivity";
import { syncProfileToMemberRegistry } from "./profileRegistry";

type AdminActionResult = { ok: true; profile?: DadProfile } | { ok: false; error: string };

function memberRecordId(profileId: string): string {
  return `member-${profileId}`;
}

function guardProtectedProfile(profile: DadProfile | undefined): AdminActionResult | null {
  if (!profile) {
    return { ok: false, error: "Profile not found." };
  }
  if (isAdminProfile(profile)) {
    return { ok: false, error: "The master admin account cannot be changed this way." };
  }
  return null;
}

function clearProfileSession(profileId: string): void {
  if (getDadSessionId() === profileId) {
    setDadSessionId(null);
  }
}

function purgeProfileData(profileId: string): void {
  removeDataRecord("members", memberRecordId(profileId));
  removeDataRecord("settings", `member-accounts-${profileId}`);
  removeDataRecordsByPayload("contributions", (payload) => payload.profileId === profileId);
}

export function suspendDadProfileByAdmin(profileId: string): AdminActionResult {
  const profile = findDadProfileById(profileId);
  const blocked = guardProtectedProfile(profile);
  if (blocked) return blocked;

  const updated = updateDadProfileRecord(profileId, (current) => ({
    ...current,
    accountStatus: "suspended",
  }));
  if (!updated) return { ok: false, error: "Profile not found." };

  syncProfileToMemberRegistry(updated);

  clearProfileSession(profileId);
  logProfileActivity({
    profileId: updated.id,
    proId: updated.proId,
    type: "profile_suspend",
    summary: "Account suspended by admin",
  });

  return { ok: true, profile: updated };
}

export function unsuspendDadProfileByAdmin(profileId: string): AdminActionResult {
  const profile = findDadProfileById(profileId);
  const blocked = guardProtectedProfile(profile);
  if (blocked) return blocked;

  if (!isProfileSuspended(profile)) {
    return { ok: false, error: "This account is not suspended." };
  }

  const updated = updateDadProfileRecord(profileId, (current) => ({
    ...current,
    accountStatus: "active",
  }));
  if (!updated) return { ok: false, error: "Profile not found." };

  syncProfileToMemberRegistry(updated);

  logProfileActivity({
    profileId: updated.id,
    proId: updated.proId,
    type: "profile_unsuspend",
    summary: "Account reactivated by admin",
  });

  return { ok: true, profile: updated };
}

export function deleteDadProfileByAdmin(profileId: string): AdminActionResult {
  const profile = findDadProfileById(profileId);
  const blocked = guardProtectedProfile(profile);
  if (blocked) return blocked;
  if (!profile) return { ok: false, error: "Profile not found." };

  logProfileActivity({
    profileId: profile.id,
    proId: profile.proId,
    type: "profile_delete",
    summary: "Account permanently deleted by admin",
  });

  clearProfileSession(profileId);
  purgeProfileData(profileId);

  if (!removeDadProfileRecord(profileId)) {
    return { ok: false, error: "Profile not found." };
  }

  return { ok: true };
}

export function approveDadProfileByAdmin(profileId: string): AdminActionResult {
  const profile = findDadProfileById(profileId);
  const blocked = guardProtectedProfile(profile);
  if (blocked) return blocked;

  if (!isProfilePendingApproval(profile)) {
    return { ok: false, error: "This member is not awaiting approval." };
  }

  const updated = updateDadProfileRecord(profileId, (current) => ({
    ...current,
    approvalStatus: "approved",
    accountStatus: current.accountStatus === "suspended" ? "suspended" : "active",
  }));
  if (!updated) return { ok: false, error: "Profile not found." };

  syncProfileToMemberRegistry(updated);
  logProfileActivity({
    profileId: updated.id,
    proId: updated.proId,
    type: "profile_approve",
    summary: "Membership approved by admin",
  });

  return { ok: true, profile: updated };
}

export function denyDadProfileByAdmin(profileId: string): AdminActionResult {
  const profile = findDadProfileById(profileId);
  const blocked = guardProtectedProfile(profile);
  if (blocked) return blocked;

  if (getProfileApprovalStatus(profile) === "denied") {
    return { ok: false, error: "This membership request was already denied." };
  }

  const updated = updateDadProfileRecord(profileId, (current) => ({
    ...current,
    approvalStatus: "denied",
  }));
  if (!updated) return { ok: false, error: "Profile not found." };

  syncProfileToMemberRegistry(updated);
  clearProfileSession(profileId);
  logProfileActivity({
    profileId: updated.id,
    proId: updated.proId,
    type: "profile_deny",
    summary: "Membership denied by admin",
  });

  return { ok: true, profile: updated };
}

export async function updateDadProfileByAdmin(
  profileId: string,
  input: {
    username: string;
    displayName: string;
    email?: string;
    phone?: string;
    password?: string;
    role?: string;
  },
): Promise<AdminActionResult> {
  const profile = findDadProfileById(profileId);
  const blocked = guardProtectedProfile(profile);
  if (blocked) return blocked;

  const username = input.username.trim();
  const displayName = input.displayName.trim();
  const password = input.password?.trim() ?? "";
  const role = input.role?.trim() || undefined;

  if (!username) return { ok: false, error: "Username is required." };
  if (username.length < 3) return { ok: false, error: "Username must be at least 3 characters." };
  if (!displayName) return { ok: false, error: "Full name is required." };
  if (password && password.length < 4) {
    return { ok: false, error: "Password must be at least 4 characters." };
  }

  const taken = findDadProfileByUsername(username);
  if (taken && taken.id !== profileId) {
    return { ok: false, error: "That username is already taken." };
  }

  const hashedPassword = password ? await hashPassword(password) : null;
  const updated = updateDadProfileRecord(profileId, (current) => ({
    ...current,
    username,
    displayName,
    fullName: displayName,
    email: input.email?.trim() || undefined,
    phone: input.phone?.trim() ? formatPhoneInput(input.phone) : undefined,
    role,
    password: hashedPassword ?? current.password,
  }));
  if (!updated) return { ok: false, error: "Profile not found." };

  syncProfileToMemberRegistry(updated);
  logProfileActivity({
    profileId: updated.id,
    proId: updated.proId,
    type: "profile_edit",
    summary: "Profile updated by admin",
  });

  return { ok: true, profile: updated };
}

export async function updateMasterAdminOwnProfile(input: {
  displayName: string;
  email?: string;
  phone?: string;
  password?: string;
}): Promise<AdminActionResult> {
  const profile = await ensureDadAdminProfile();
  const displayName = input.displayName.trim();
  const password = input.password?.trim() ?? "";

  if (!displayName) return { ok: false, error: "Full name is required." };
  if (password && password.length < 4) {
    return { ok: false, error: "Password must be at least 4 characters." };
  }

  const hashedPassword = password ? await hashPassword(password) : null;
  const updated = updateDadProfileRecord(profile.id, (current) => ({
    ...current,
    displayName,
    fullName: displayName,
    email: input.email?.trim() || undefined,
    phone: input.phone?.trim() ? formatPhoneInput(input.phone) : undefined,
    password: hashedPassword ?? current.password,
  }));

  if (!updated) return { ok: false, error: "Profile not found." };

  syncProfileToMemberRegistry(updated);
  logProfileActivity({
    profileId: updated.id,
    proId: updated.proId,
    type: "profile_edit",
    summary: "Master admin account updated",
  });

  return { ok: true, profile: updated };
}
