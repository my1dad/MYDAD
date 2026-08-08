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
  isProfilePendingApproval,
  isProfileSuspended,
  loginDadAdmin,
  replaceAllDadProfiles,
  setDadSessionId,
  subscribeDadProfiles,
} from "../lib/dadProfileStorage";
import { clearPendingDmPartnerId } from "../lib/communityDmNavigation";

const AUTH_SYNC_TIMEOUT_MS = 12_000;

async function pullProfilesOnce() {
  const { pullCloudProfilesNow, clearFactoryZeroDeliveryLock, pauseCloudPushes } = await import(
    "../lib/supabase/cloudSync"
  );
  clearFactoryZeroDeliveryLock();
  pauseCloudPushes(0);
  const pull = pullCloudProfilesNow(getDadProfiles, replaceAllDadProfiles);
  const timeout = new Promise((_, reject) => {
    window.setTimeout(() => reject(new Error("AUTH_SYNC_TIMEOUT")), AUTH_SYNC_TIMEOUT_MS);
  });
  await Promise.race([pull, timeout]);
}

async function syncProfilesBeforeAuth() {
  try {
    await pullProfilesOnce();
    return { ok: true };
  } catch (firstErr) {
    console.warn("[auth] Cloud profile pull before auth failed, retrying once:", firstErr);
    try {
      await pullProfilesOnce();
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err ?? "");
      console.warn("[auth] Cloud profile pull before auth failed after retry:", err);
      return {
        ok: false,
        error: message === "AUTH_SYNC_TIMEOUT" ? "syncTimeout" : "syncFailed",
      };
    }
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

    // Auth screen has no PostAuthWorkspace sync — pull approvals/passwords first.
    const sync = await syncProfilesBeforeAuth();

    // Single authenticate path: admin is included via authenticateDadProfile / loginDadAdmin
    // without a third PBKDF2 verify for status checks.
    const adminMatch = await loginDadAdmin(normalizedUsername, normalizedPassword);
    if (adminMatch) {
      setProfile(beginAuthenticatedSession(adminMatch, "login", rememberMe));
      setAuthEntryTick((tick) => tick + 1);
      return { ok: true };
    }

    const existing = findDadProfileByUsername(normalizedUsername);
    if (existing) {
      const { profilePasswordMatches } = await import("../lib/dadProfileStorage");
      if (isProfilePendingApproval(existing)) {
        // Still verify password so we don't leak account status without credentials.
        if (await profilePasswordMatches(existing, normalizedPassword)) {
          // Local pending may be stale if the cloud pull failed — don't block as pending.
          if (!sync.ok) return { ok: false, error: sync.error };
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

    const matched = await authenticateDadProfile(normalizedUsername, normalizedPassword);
    if (!matched) {
      // New phone / empty local cache: prefer sync errors over "invalid credentials".
      if (!sync.ok && !existing) return { ok: false, error: sync.error };
      return { ok: false, error: "Invalid username or password." };
    }

    setProfile(beginAuthenticatedSession(matched, "login", rememberMe));
    setAuthEntryTick((tick) => tick + 1);
    return { ok: true };
  }, []);

  const register = useCallback(async (input) => {
    await syncProfilesBeforeAuth();

    const result = await createDadProfile(input);
    if ("error" in result) {
      return { ok: false, error: result.error };
    }

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
    setAuthEntryTick((tick) => tick + 1);
  }, []);

  const sessionId = getDadSessionId();
  const isAuthenticated = Boolean(sessionId && (profile ?? getActiveDadProfile()));
  const isAdmin = isAdminProfile(profile);

  const value = useMemo(
    () => ({
      profile,
      authEntryTick,
      isAuthenticated,
      isAdmin,
      login,
      register,
      logout,
    }),
    [profile, authEntryTick, isAuthenticated, isAdmin, login, register, logout],
  );

  return <DadAuthContext.Provider value={value}>{children}</DadAuthContext.Provider>;
}

export function useDadAuth() {
  const context = useContext(DadAuthContext);
  if (!context) {
    throw new Error("useDadAuth must be used within DadAuthProvider");
  }
  return context;
}
