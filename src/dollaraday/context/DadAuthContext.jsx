import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { isAdminProfile } from "../../config/admin";
import {
  authenticateDadProfile,
  createDadProfile,
  getActiveDadProfile,
  getDadSessionId,
  loginDadAdmin,
  setDadSessionId,
} from "../lib/dadProfileStorage";
import { persistMemberFromProfile } from "../lib/memberRegistry";

const DadAuthContext = createContext(null);

function resetShellScroll() {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

function beginAuthenticatedSession(profile) {
  persistMemberFromProfile(profile);
  setDadSessionId(profile.id);
  window.location.hash = "";
  resetShellScroll();
  return profile;
}

export function DadAuthProvider({ children }) {
  const [profile, setProfile] = useState(() => getActiveDadProfile());
  const [authEntryTick, setAuthEntryTick] = useState(0);

  const login = useCallback((username, password) => {
    const adminMatch = loginDadAdmin(username, password);
    if (adminMatch) {
      setProfile(beginAuthenticatedSession(adminMatch));
      setAuthEntryTick((tick) => tick + 1);
      return { ok: true };
    }

    const matched = authenticateDadProfile(username, password);
    if (!matched) {
      return { ok: false, error: "Invalid username or password." };
    }

    setProfile(beginAuthenticatedSession(matched));
    setAuthEntryTick((tick) => tick + 1);
    return { ok: true };
  }, []);

  const register = useCallback((input) => {
    const result = createDadProfile(input);
    if ("error" in result) {
      return { ok: false, error: result.error };
    }

    persistMemberFromProfile(result.profile, { isNew: true });
    setDadSessionId(result.profile.id);
    window.location.hash = "";
    resetShellScroll();
    setProfile(result.profile);
    setAuthEntryTick((tick) => tick + 1);
    return { ok: true };
  }, []);

  const logout = useCallback(() => {
    setDadSessionId(null);
    setProfile(null);
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
