const PENDING_DM_PARTNER_KEY = "dda-pending-dm-partner-id";

export function setPendingDmPartnerId(profileId: string): void {
  sessionStorage.setItem(PENDING_DM_PARTNER_KEY, profileId);
}

export function clearPendingDmPartnerId(): void {
  sessionStorage.removeItem(PENDING_DM_PARTNER_KEY);
}

export function consumePendingDmPartnerId(): string | null {
  const profileId = sessionStorage.getItem(PENDING_DM_PARTNER_KEY);
  if (profileId) {
    sessionStorage.removeItem(PENDING_DM_PARTNER_KEY);
  }
  return profileId;
}
