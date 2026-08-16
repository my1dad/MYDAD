import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { isAdminProfile } from "../../config/admin";
import {
  authenticateDadProfile,
  createDadProfile,
  findDadProfileByUsername,
  getActiveDadProfile,
  getDadProfiles,
  getDadSessionId,
  isProfileDenied,
  isProfileLoginAllowed,
  isProfilePendingApproval,
  isProfileSuspended,
  loginDadAdmin,
  profilePasswordMatches,
  replaceAllDadProfiles,
  setDadSessionId,
  subscribeDadProfiles,
} from "../lib/dadProfileStorage";
import { clearPendingDmPartnerId } from "../lib/communityDmNavigation";

/** Member login needs cloud approval status — allow enough time for mobile PBKDF2 + fetch. */
const AUTH_SYNC_TIMEOUT_MS = 10_000;

async function syncUsernameBeforeAuth(username) {
  try {
    const { pullCloudProfileForAuth, pauseCloudPushes } = await import(
      "../lib/supabase/cloudSync"
    );

    // Do NOT clear factory-zero / blank / epoch here — pullCloudProfileForAuth adopts
    // cloud authority and only unlocks when cloud is confirmed open.
    pauseCloudPushes(5_000);
    const pull = pullCloudProfileForAuth(username, getDadProfiles, replaceAllDadProfiles);
    const timeout = new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error("AUTH_SYNC_TIMEOUT")), AUTH_SYNC_TIMEOUT_MS);
    });
    const profiles = await Promise.race([pull, timeout]);
    const normalized = String(username ?? "").trim().toLowerCase();
    const matched = Array.isArray(profiles)
      ? profiles.find((profile) => profile.username?.trim().toLowerCase() === normalized)
      : null;
    return { ok: true, profile: matched ?? findDadProfileByUsername(username) ?? null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err ?? "");
    console.warn("[auth] Fast auth profile pull failed:", err);
    return {
      ok: false,
      profile: findDadProfileByUsername(username) ?? null,
      error: message === "AUTH_SYNC_TIMEOUT" ? "syncTimeout" : "syncFailed",
    };
  }
}

const DadAuthContext = createContext(null);

function resetShellScroll() {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

/** Session first — registry/activity work waits until the UI is quiet. */
function beginAuthenticatedSession(profile, activityType, remember = false) {
  setDadSessionId(profile.id, { remember });
  window.location.hash = "";
  resetShellScroll();

  // Bind pool "current member" to the signed-in profile immediately so contribute /
  // loans / equity UI never keep a previous account's labels.
  void import("../lib/memberRegistry")
    .then(({ persistMemberFromProfile }) => {
      persistMemberFromProfile(profile, { isNew: activityType === "register" });
    })
    .catch((err) => console.warn("[auth] Member session bind failed:", err));

  const runSideEffects = () => {
    void import("../lib/profileActivity")
      .then(({ logProfileActivity }) => {
        logProfileActivity({
          profileId: profile.id,
          proId: profile.proId,
          type: activityType,
          summary:
            activityType === "register"
              ? `Registered with promo code ${profile.proId}`
              : "Signed in to dashboard",
          payload:
            activityType === "register" && profile.referredByProId
              ? { referredByProId: profile.referredByProId }
              : undefined,
        });
        if (activityType === "register" && profile.referredByProId) {
          logProfileActivity({
            profileId: profile.id,
            proId: profile.proId,
            type: "referral",
            summary: `Joined using referral code ${profile.referredByProId}`,
            payload: { referredByProId: profile.referredByProId },
          });
        }
      })
      .catch((err) => console.warn("[auth] Post-login activity log failed:", err));
  };

  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    window.requestIdleCallback(runSideEffects, { timeout: 8000 });
  } else {
    window.setTimeout(runSideEffects, 3000);
  }

  return profile;
}

export function DadAuthProvider({ children }) {
  const [profile, setProfile] = useState(() => getActiveDadProfile());
  const [authEntryTick, setAuthEntryTick] = useState(0);

  useEffect(() => {
    return subscribeDadProfiles(() => {
      // getActiveDadProfile clears pending/denied/suspended sessions.
      const next = getActiveDadProfile();
      setProfile((current) => {
        const currentId = current?.id ?? null;
        const nextId = next?.id ?? null;
        if (currentId === nextId && current === next) return current;
        if (currentId === nextId && !currentId) return current;
        if (!getDadSessionId() && !currentId && !nextId) return current;
        return next;
      });
    });
  }, []);

  const login = useCallback(async (username, password, options = {}) => {
    const rememberMe = Boolean(options.rememberMe);
    const normalizedUsername = String(username ?? "").trim();
    const normalizedPassword = String(password ?? "").trim();
    const isMasterAdminLogin = normalizedUsername.toLowerCase() === "admin";

    // Always refresh from cloud on login (admin + members) so stale local caches cannot win.
    let sync = { ok: true, profile: null };
    sync = await syncUsernameBeforeAuth(normalizedUsername);

    // Master admin only — never route member credentials into the admin workspace.
    if (isMasterAdminLogin) {
      const adminMatch = await loginDadAdmin(normalizedUsername, normalizedPassword);
      if (adminMatch) {
        setProfile(beginAuthenticatedSession(adminMatch, "login", rememberMe));
        setAuthEntryTick((tick) => tick + 1);
        return { ok: true };
      }
      return { ok: false, error: "Invalid username or password." };
    }

    // Prefer the profile returned by the cloud pull (source of truth for password/approval).
    let existing = sync.profile ?? findDadProfileByUsername(normalizedUsername);
    if (existing?.username && isProfilePendingApproval(existing)) {
      // One more forced pull so a just-approved member is not blocked by a stale local row.
      sync = await syncUsernameBeforeAuth(normalizedUsername);
      existing = sync.profile ?? findDadProfileByUsername(normalizedUsername);
    }

    if (existing) {
      if (isAdminProfile(existing)) {
        return { ok: false, error: "Invalid username or password." };
      }
      if (isProfilePendingApproval(existing)) {
        if (await profilePasswordMatches(existing, normalizedPassword)) {
          return { ok: false, error: "pendingApproval" };
        }
        return { ok: false, error: "Invalid username or password." };
      }
      if (isProfileDenied(existing)) {
        if (await profilePasswordMatches(existing, normalizedPassword)) {
          return { ok: false, error: "denied" };
        }
        return { ok: false, error: "Invalid username or password." };
      }
      if (isProfileSuspended(existing)) {
        if (await profilePasswordMatches(existing, normalizedPassword)) {
          return { ok: false, error: "suspended" };
        }
        return { ok: false, error: "Invalid username or password." };
      }
    }

    const matched = await authenticateDadProfile(normalizedUsername, normalizedPassword, {
      profile: existing,
    });
    if (!matched) {
      if (!existing && !sync.ok) return { ok: false, error: sync.error };
      // Profile missing locally after a failed sync — tell the member to retry, not "invalid password".
      if (!existing && sync.ok === false) return { ok: false, error: sync.error };
      return { ok: false, error: "Invalid username or password." };
    }
    if (isAdminProfile(matched) || !isProfileLoginAllowed(matched)) {
      return { ok: false, error: "pendingApproval" };
    }

    setProfile(beginAuthenticatedSession(matched, "login", rememberMe));
    setAuthEntryTick((tick) => tick + 1);
    return { ok: true };
  }, []);

  const register = useCallback(async (input) => {
    // Registration only needs username uniqueness — use the fast single-row pull.
    const username = String(input?.username ?? "").trim();
    if (username) {
      await syncUsernameBeforeAuth(username);
    }

    // Creating a profile must never leave anyone signed in (especially not admin).
    setDadSessionId(null);
    setProfile(null);

    const result = await createDadProfile(input);
    if ("error" in result) {
      return { ok: false, error: result.error };
    }

    // Belt-and-suspenders: registration is a request, not a login.
    setDadSessionId(null);
    setProfile(null);

    void Promise.all([
      import("../lib/memberRegistry"),
      import("../lib/profileRegistry"),
      import("../lib/profileActivity"),
    ]).then(
      ([
        { persistMemberFromProfile },
        { syncProfileToMemberRegistry },
        { logProfileActivity },
      ]) => {
        persistMemberFromProfile(result.profile, { isNew: true });
        syncProfileToMemberRegistry(result.profile);
        logProfileActivity({
          profileId: result.profile.id,
          proId: result.profile.proId,
          type: "register",
          summary: "Submitted membership request — awaiting admin approval",
          payload: result.profile.referredByProId
            ? { referredByProId: result.profile.referredByProId }
            : undefined,
        });
        if (result.profile.referredByProId) {
          logProfileActivity({
            profileId: result.profile.id,
            proId: result.profile.proId,
            type: "referral",
            summary: `Joined using referral code ${result.profile.referredByProId}`,
            payload: { referredByProId: result.profile.referredByProId },
          });
        }
      },
    );

    return { ok: true, pendingApproval: true };
  }, []);

  const logout = useCallback(() => {
    clearPendingDmPartnerId();
    setDadSessionId(null);
    setProfile(null);
  }, []);

  const value = useMemo(
    () => ({
      profile,
      authEntryTick,
      isAuthenticated: Boolean(profile),
      isAdmin: isAdminProfile(profile),
      login,
      register,
      logout,
    }),
    [profile, authEntryTick, login, register, logout],
  );

  return <DadAuthContext.Provider value={value}>{children}</DadAuthContext.Provider>;
}

export function useDadAuth() {
  const ctx = useContext(DadAuthContext);
  if (!ctx) throw new Error("useDadAuth must be used within DadAuthProvider");
  return ctx;
}
