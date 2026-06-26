const PENDING_ADMIN_PROFILE_KEY = "dda-pending-admin-profile-id";

export function setPendingAdminProfileId(profileId: string): void {
  sessionStorage.setItem(PENDING_ADMIN_PROFILE_KEY, profileId);
}

export function consumePendingAdminProfileId(): string | null {
  const profileId = sessionStorage.getItem(PENDING_ADMIN_PROFILE_KEY);
  if (profileId) {
    sessionStorage.removeItem(PENDING_ADMIN_PROFILE_KEY);
  }
  return profileId;
}
