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

export function DadAuthProvider({ children }) {
  const [profile, setProfile] = useState(() => getActiveDadProfile());

  const login = useCallback((username, password) => {
    const adminMatch = loginDadAdmin(username, password);
    if (adminMatch) {
      persistMemberFromProfile(adminMatch);
      setProfile(adminMatch);
      return { ok: true };
    }

    const matched = authenticateDadProfile(username, password);
    if (!matched) {
      return { ok: false, error: "Invalid username or password." };
    }

    setDadSessionId(matched.id);
    persistMemberFromProfile(matched);
    setProfile(matched);
    return { ok: true };
  }, []);

  const register = useCallback((input) => {
    const result = createDadProfile(input);
    if ("error" in result) {
      return { ok: false, error: result.error };
    }

    setDadSessionId(result.profile.id);
    persistMemberFromProfile(result.profile, { isNew: true });
    setProfile(result.profile);
    return { ok: true };
  }, []);

  const logout = useCallback(() => {
    setDadSessionId(null);
    setProfile(null);
  }, []);

  const value = useMemo(
    () => ({
      profile,
      isAuthenticated: Boolean(getDadSessionId() && (profile ?? getActiveDadProfile())),
      isAdmin: isAdminProfile(profile),
      login,
      register,
      logout,
    }),
    [profile, login, register, logout],
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
