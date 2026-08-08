const PENDING_ADMIN_PROFILE_KEY = "dda-pending-admin-profile";
const PENDING_ADMIN_PROFILE_EVENT = "dda-pending-admin-profile";

/** @deprecated legacy session key (id-only) */
const LEGACY_PENDING_ADMIN_PROFILE_KEY = "dda-pending-admin-profile-id";

export type PendingAdminProfileTarget = {
  profileId?: string;
  username?: string;
  name?: string;
};

type PendingListener = (target: PendingAdminProfileTarget) => void;
const listeners = new Set<PendingListener>();

function normalizeTarget(
  input: string | PendingAdminProfileTarget | null | undefined,
): PendingAdminProfileTarget | null {
  if (!input) return null;
  if (typeof input === "string") {
    const profileId = input.trim();
    return profileId ? { profileId } : null;
  }
  const profileId = input.profileId?.trim() || undefined;
  const username = input.username?.trim() || undefined;
  const name = input.name?.trim() || undefined;
  if (!profileId && !username) return null;
  return { profileId, username, name };
}

export function setPendingAdminProfileId(
  profileIdOrTarget: string | PendingAdminProfileTarget,
  extra: Omit<PendingAdminProfileTarget, "profileId"> = {},
): void {
  const target =
    typeof profileIdOrTarget === "string"
      ? normalizeTarget({ profileId: profileIdOrTarget, ...extra })
      : normalizeTarget(profileIdOrTarget);
  if (!target) return;

  try {
    sessionStorage.setItem(PENDING_ADMIN_PROFILE_KEY, JSON.stringify(target));
    sessionStorage.removeItem(LEGACY_PENDING_ADMIN_PROFILE_KEY);
  } catch {
    /* ignore quota */
  }

  listeners.forEach((listener) => listener(target));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PENDING_ADMIN_PROFILE_EVENT, { detail: target }));
  }
}

export function consumePendingAdminProfileId(): PendingAdminProfileTarget | null {
  try {
    const raw = sessionStorage.getItem(PENDING_ADMIN_PROFILE_KEY);
    if (raw) {
      sessionStorage.removeItem(PENDING_ADMIN_PROFILE_KEY);
      sessionStorage.removeItem(LEGACY_PENDING_ADMIN_PROFILE_KEY);
      try {
        return normalizeTarget(JSON.parse(raw) as PendingAdminProfileTarget);
      } catch {
        return normalizeTarget(raw);
      }
    }

    const legacy = sessionStorage.getItem(LEGACY_PENDING_ADMIN_PROFILE_KEY);
    if (legacy) {
      sessionStorage.removeItem(LEGACY_PENDING_ADMIN_PROFILE_KEY);
      return normalizeTarget(legacy);
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function subscribePendingAdminProfileId(listener: PendingListener): () => void {
  listeners.add(listener);
  const onWindow = (event: Event) => {
    const detail = (event as CustomEvent<string | PendingAdminProfileTarget>).detail;
    const target = normalizeTarget(detail);
    if (target) listener(target);
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
