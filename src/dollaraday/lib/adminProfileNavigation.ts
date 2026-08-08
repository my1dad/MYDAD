const PENDING_ADMIN_PROFILE_KEY = "dda-pending-admin-profile-id";
const PENDING_ADMIN_PROFILE_EVENT = "dda-pending-admin-profile";

type PendingListener = (profileId: string) => void;
const listeners = new Set<PendingListener>();

export function setPendingAdminProfileId(profileId: string): void {
  const id = profileId?.trim();
  if (!id) return;
  sessionStorage.setItem(PENDING_ADMIN_PROFILE_KEY, id);
  listeners.forEach((listener) => listener(id));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PENDING_ADMIN_PROFILE_EVENT, { detail: id }));
  }
}

export function consumePendingAdminProfileId(): string | null {
  const profileId = sessionStorage.getItem(PENDING_ADMIN_PROFILE_KEY);
  if (profileId) {
    sessionStorage.removeItem(PENDING_ADMIN_PROFILE_KEY);
  }
  return profileId;
}

export function subscribePendingAdminProfileId(listener: PendingListener): () => void {
  listeners.add(listener);
  const onWindow = (event: Event) => {
    const id = (event as CustomEvent<string>).detail;
    if (id) listener(id);
  };
  if (typeof window !== "undefined") {
    window.addEventListener(PENDING_ADMIN_PROFILE_EVENT, onWindow);
  }
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener(PENDING_ADMIN_PROFILE_EVENT, onWindow);
    }
  };
}
