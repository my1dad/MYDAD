import { isMemberProfile } from "../../config/memberProfile";
import {
  findDadProfileById,
  getActiveDadProfile,
  updateDadProfileRecord,
  type DadProfile,
} from "./dadProfileStorage";
import { formatPhoneInput } from "./phoneFormat";
import { logProfileActivity } from "./profileActivity";
import { syncProfileToMemberRegistry } from "./profileRegistry";

type MemberActionResult = { ok: true; profile: DadProfile } | { ok: false; error: string };

export function updateMemberOwnProfile(input: {
  displayName: string;
  email?: string;
  phone?: string;
  password?: string;
}): MemberActionResult {
  const profile = getActiveDadProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (!isMemberProfile(profile)) {
    return { ok: false, error: "Master admin account is managed from Admin settings." };
  }

  const displayName = input.displayName.trim();
  const password = input.password?.trim() ?? "";

  if (!displayName) return { ok: false, error: "Full name is required." };
  if (password && password.length < 4) {
    return { ok: false, error: "Password must be at least 4 characters." };
  }

  const updated = updateDadProfileRecord(profile.id, (current) => ({
    ...current,
    displayName,
    fullName: displayName,
    email: input.email?.trim() || undefined,
    phone: input.phone?.trim() ? formatPhoneInput(input.phone) : undefined,
    password: password || current.password,
  }));

  if (!updated) return { ok: false, error: "Profile not found." };

  syncProfileToMemberRegistry(updated);
  logProfileActivity({
    profileId: updated.id,
    proId: updated.proId,
    type: "profile_edit",
    summary: "Member profile updated",
  });

  return { ok: true, profile: updated };
}

export function canEditMemberProfile(profileId: string | undefined, viewerProfile: DadProfile | null): boolean {
  if (!profileId || !viewerProfile) return false;
  if (!isMemberProfile(viewerProfile)) return false;
  return viewerProfile.id === profileId;
}

export function findMemberProfileById(profileId: string): DadProfile | undefined {
  const profile = findDadProfileById(profileId);
  if (!profile || !isMemberProfile(profile)) return undefined;
  return profile;
}
