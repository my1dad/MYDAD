import { ADMIN_ROLE, isAdminProfile } from "./admin";

/** Canonical membership role for all non-admin members. */
export const MEMBER_ROLE = "Investor";

/** Reference member profile — used as the baseline for all non-admin members. */
export const MEMBER_PROFILE_TEMPLATE = {
  username: "mortega",
  displayName: "Matt Ortega",
  role: MEMBER_ROLE,
  tier: MEMBER_ROLE,
  score: 78,
  streak: 0,
  contributed: 0,
  equity: 0,
  days: 0,
  status: "active" as const,
};

export function isMemberProfile(profile: { username?: string } | null | undefined): boolean {
  return Boolean(profile && !isAdminProfile(profile));
}

/** Display / store tier: Master Admin stays; everyone else is Investor. */
export function resolveMembershipTier(
  profileOrRole?: { username?: string; role?: string } | string | null,
): string {
  if (typeof profileOrRole === "string") {
    const value = profileOrRole.trim();
    if (value === ADMIN_ROLE || value === "Master Admin") return ADMIN_ROLE;
    return MEMBER_ROLE;
  }
  if (isAdminProfile(profileOrRole) || profileOrRole?.role?.trim() === ADMIN_ROLE) {
    return ADMIN_ROLE;
  }
  return MEMBER_ROLE;
}
