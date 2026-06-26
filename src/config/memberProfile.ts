import { isAdminProfile } from "./admin";

/** Reference member profile — used as the baseline for all non-admin members. */
export const MEMBER_PROFILE_TEMPLATE = {
  username: "mortega",
  displayName: "Matt Ortega",
  role: "Builder",
  tier: "Builder",
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
