import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { isAdminProfile } from "../../config/admin";
import {
  authenticateDadProfile,
  createDadProfile,
  findDadProfileByUsername,
  getActiveDadProfile,
  getDadSessionId,
  isProfileDenied,
  isProfilePendingApproval,
  isProfileSuspended,
  loginDadAdmin,
  profilePasswordMatches,
  setDadSessionId,
  subscribeDadProfiles,
} from "../lib/dadProfileStorage";
import { clearPendingDmPartnerId } from "../lib/communityDmNavigation";
import { logProfileActivity } from "../lib/profileActivity";
import { syncProfileToMemberRegistry } from "../lib/profileRegistry";
import { persistMemberFromProfile } from "../lib/memberRegistry";

const DadAuthContext = createContext(null);

function resetShellScroll() {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

function beginAuthenticatedSession(profile, activityType, remember = false) {
  persistMemberFromProfile(profile, { isNew: activityType === "register" });
  syncProfileToMemberRegistry(profile);
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
  setDadSessionId(profile.id, { remember });
  window.location.hash = "";
  resetShellScroll();
  return profile;
}

export function DadAuthProvider({ children }) {
  const [profile, setProfile] = useState(() => getActiveDadProfile());
  const [authEntryTick, setAuthEntryTick] = useState(0);

  useEffect(() => {
    return subscribeDadProfiles(() => {
      setProfile(getActiveDadProfile());
    });
  }, []);

  const login = useCallback(async (username, password, options = {}) => {
    const rememberMe = Boolean(options.rememberMe);

    const adminMatch = await loginDadAdmin(username, password);
    if (adminMatch) {
      setProfile(beginAuthenticatedSession(adminMatch, "login", rememberMe));
      setAuthEntryTick((tick) => tick + 1);
      return { ok: true };
    }

    const matched = await authenticateDadProfile(username, password);
    if (!matched) {
      const existing = findDadProfileByUsername(username);
      if (existing && (await profilePasswordMatches(existing, password))) {
        if (isProfilePendingApproval(existing)) {
          return { ok: false, error: "pendingApproval" };
        }
        if (isProfileDenied(existing)) {
          return { ok: false, error: "denied" };
        }
        if (isProfileSuspended(existing)) {
          return { ok: false, error: "suspended" };
        }
      }
      return { ok: false, error: "Invalid username or password." };
    }

    setProfile(beginAuthenticatedSession(matched, "login", rememberMe));
    setAuthEntryTick((tick) => tick + 1);
    return { ok: true };
  }, []);

  const register = useCallback(async (input) => {
    const result = await createDadProfile(input);
    if ("error" in result) {
      return { ok: false, error: result.error };
    }

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
    return { ok: true, pendingApproval: true };
  }, []);

  const logout = useCallback(() => {
    clearPendingDmPartnerId();
    setDadSessionId(null);
    setProfile(null);
    setAuthEntryTick((tick) => tick + 1);
  }, []);

  const value = useMemo(
    () => ({
      profile,
      authEntryTick,
      isAuthenticated: Boolean(getDadSessionId() && (profile ?? getActiveDadProfile())),
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
  const context = useContext(DadAuthContext);
  if (!context) {
    throw new Error("useDadAuth must be used within DadAuthProvider");
  }
  return context;
}
