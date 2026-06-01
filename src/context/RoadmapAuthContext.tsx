import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { isAdminProfile } from '../config/admin'
import {
  adminDeleteRoadmapProfile,
  adminUpdateRoadmapProfile,
  authenticateRoadmapProfile,
  changeRoadmapPassword,
  connectRoadmapGoogleAccount,
  connectRoadmapSocialAccount,
  createRoadmapProfile,
  deleteRoadmapProfile,
  disconnectRoadmapGoogleAccount,
  disconnectRoadmapSocialAccount,
  getActiveRoadmapProfile,
  getRoadmapProfiles,
  getRoadmapSessionId,
  isGuestProfile,
  loginGuest,
  loginRoadmapAdmin,
  setRoadmapSessionId,
  updateRoadmapProfile,
  type RoadmapProfile,
  type RoadmapSocialProvider,
} from '../data/roadmapProfileStorage'
import type { GoogleUserInfo } from '../lib/roadmap/googleAuth'
import {
  logConnectedAccount,
  logProfileFieldChanges,
  logWorkspaceActivity,
} from '../lib/workspaceActivityLog'

interface RoadmapAuthContextValue {
  profile: RoadmapProfile | null
  isAuthenticated: boolean
  isGuest: boolean
  isAdmin: boolean
  login: (username: string, password: string) => { ok: true } | { ok: false; error: string }
  loginGuest: () => void
  loginAdmin: (username: string, password: string) => { ok: true } | { ok: false; error: string }
  register: (input: {
    username: string
    password: string
    workspaceName: string
  }) => { ok: true } | { ok: false; error: string }
  updateProfile: (input: {
    username?: string
    workspaceName?: string
    fullName?: string | null
    role?: string | null
    email?: string | null
    phoneNumber?: string | null
    timezone?: string
    profilePicture?: string | null
  }) => { ok: true } | { ok: false; error: string }
  changePassword: (input: {
    currentPassword: string
    newPassword: string
    confirmPassword: string
  }) => { ok: true } | { ok: false; error: string }
  deleteAccount: (password: string) => { ok: true } | { ok: false; error: string }
  connectGoogle: (account: GoogleUserInfo) => { ok: true } | { ok: false; error: string }
  disconnectGoogle: () => { ok: true } | { ok: false; error: string }
  connectSocial: (
    provider: RoadmapSocialProvider,
    account: { label: string; detail?: string },
  ) => { ok: true } | { ok: false; error: string }
  disconnectSocial: (provider: RoadmapSocialProvider) => { ok: true } | { ok: false; error: string }
  listProfiles: () => RoadmapProfile[]
  adminUpdateProfile: (
    profileId: string,
    updates: { username?: string; password?: string; workspaceName?: string },
  ) => { ok: true } | { ok: false; error: string }
  adminDeleteProfile: (profileId: string) => { ok: true } | { ok: false; error: string }
  logout: () => void
}

const RoadmapAuthContext = createContext<RoadmapAuthContextValue | null>(null)

export function RoadmapAuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<RoadmapProfile | null>(() => getActiveRoadmapProfile())

  const login = useCallback((username: string, password: string) => {
    const matched = authenticateRoadmapProfile(username, password)
    if (!matched) {
      return { ok: false as const, error: 'Invalid username or password.' }
    }

    setRoadmapSessionId(matched.id)
    setProfile(matched)
    return { ok: true as const }
  }, [])

  const loginGuestSession = useCallback(() => {
    const guest = loginGuest()
    setProfile(guest)
  }, [])

  const loginAdmin = useCallback((username: string, password: string) => {
    const matched = loginRoadmapAdmin(username, password)
    if (!matched) {
      return { ok: false as const, error: 'Invalid admin credentials.' }
    }

    setProfile(matched)
    return { ok: true as const }
  }, [])

  const register = useCallback(
    (input: { username: string; password: string; workspaceName: string }) => {
      const result = createRoadmapProfile(input)
      if ('error' in result) {
        return { ok: false as const, error: result.error }
      }

      setRoadmapSessionId(result.profile.id)
      setProfile(result.profile)
      return { ok: true as const }
    },
    [],
  )

  const updateProfile = useCallback(
    (input: {
      username?: string
      workspaceName?: string
      fullName?: string | null
      role?: string | null
      email?: string | null
      phoneNumber?: string | null
      timezone?: string
      profilePicture?: string | null
    }) => {
      if (!profile) return { ok: false as const, error: 'Not signed in.' }

      const result = updateRoadmapProfile(profile.id, input)
      if ('error' in result) {
        return { ok: false as const, error: result.error }
      }

      logProfileFieldChanges(profile, input)
      setProfile(result.profile)
      return { ok: true as const }
    },
    [profile],
  )

  const changePassword = useCallback(
    (input: { currentPassword: string; newPassword: string; confirmPassword: string }) => {
      if (!profile) return { ok: false as const, error: 'Not signed in.' }

      if (input.newPassword !== input.confirmPassword) {
        return { ok: false as const, error: 'New passwords do not match.' }
      }

      const result = changeRoadmapPassword(profile.id, input.currentPassword, input.newPassword)
      if ('error' in result) {
        return { ok: false as const, error: result.error }
      }

      logWorkspaceActivity({ type: 'password_changed', message: profile.username })
      setProfile(result.profile)
      return { ok: true as const }
    },
    [profile],
  )

  const deleteAccount = useCallback(
    (password: string) => {
      if (!profile) return { ok: false as const, error: 'Not signed in.' }

      const result = deleteRoadmapProfile(profile.id, password)
      if ('error' in result) {
        return { ok: false as const, error: result.error }
      }

      setRoadmapSessionId(null)
      setProfile(null)
      return { ok: true as const }
    },
    [profile],
  )

  const connectGoogle = useCallback(
    (account: GoogleUserInfo) => {
      if (!profile) return { ok: false as const, error: 'Not signed in.' }

      const result = connectRoadmapGoogleAccount(profile.id, account)
      if ('error' in result) {
        return { ok: false as const, error: result.error }
      }

      logConnectedAccount('google')
      setProfile(result.profile)
      return { ok: true as const }
    },
    [profile],
  )

  const disconnectGoogle = useCallback(() => {
    if (!profile) return { ok: false as const, error: 'Not signed in.' }

    const result = disconnectRoadmapGoogleAccount(profile.id)
    if ('error' in result) {
      return { ok: false as const, error: result.error }
    }

    setProfile(result.profile)
    return { ok: true as const }
  }, [profile])

  const connectSocial = useCallback(
    (provider: RoadmapSocialProvider, account: { label: string; detail?: string }) => {
      if (!profile) return { ok: false as const, error: 'Not signed in.' }

      const result = connectRoadmapSocialAccount(profile.id, provider, account)
      if ('error' in result) {
        return { ok: false as const, error: result.error }
      }

      logConnectedAccount(provider)
      setProfile(result.profile)
      return { ok: true as const }
    },
    [profile],
  )

  const disconnectSocial = useCallback(
    (provider: RoadmapSocialProvider) => {
      if (!profile) return { ok: false as const, error: 'Not signed in.' }

      const result = disconnectRoadmapSocialAccount(profile.id, provider)
      if ('error' in result) {
        return { ok: false as const, error: result.error }
      }

      setProfile(result.profile)
      return { ok: true as const }
    },
    [profile],
  )

  const logout = useCallback(() => {
    setRoadmapSessionId(null)
    setProfile(null)
  }, [])

  const listProfiles = useCallback(() => {
    if (!isAdminProfile(profile)) return []
    return getRoadmapProfiles()
  }, [profile])

  const adminUpdateProfile = useCallback(
    (
      profileId: string,
      updates: { username?: string; password?: string; workspaceName?: string },
    ) => {
      if (!isAdminProfile(profile)) {
        return { ok: false as const, error: 'Admin access required.' }
      }

      const result = adminUpdateRoadmapProfile(profileId, updates)
      if ('error' in result) {
        return { ok: false as const, error: result.error }
      }

      if (profile?.id === profileId) {
        setProfile(result.profile)
      }

      return { ok: true as const }
    },
    [profile],
  )

  const adminDeleteProfile = useCallback(
    (profileId: string) => {
      if (!isAdminProfile(profile)) {
        return { ok: false as const, error: 'Admin access required.' }
      }

      if (profile?.id === profileId) {
        return { ok: false as const, error: 'You cannot delete your active admin session.' }
      }

      const result = adminDeleteRoadmapProfile(profileId)
      if ('error' in result) {
        return { ok: false as const, error: result.error }
      }

      return { ok: true as const }
    },
    [profile],
  )

  const value = useMemo<RoadmapAuthContextValue>(
    () => ({
      profile,
      isAuthenticated: Boolean(getRoadmapSessionId() && (profile ?? getActiveRoadmapProfile())),
      isGuest: isGuestProfile(profile),
      isAdmin: isAdminProfile(profile),
      login,
      loginGuest: loginGuestSession,
      loginAdmin,
      register,
      updateProfile,
      changePassword,
      deleteAccount,
      connectGoogle,
      disconnectGoogle,
      connectSocial,
      disconnectSocial,
      listProfiles,
      adminUpdateProfile,
      adminDeleteProfile,
      logout,
    }),
    [profile, login, loginGuestSession, loginAdmin, register, updateProfile, changePassword, deleteAccount, connectGoogle, disconnectGoogle, connectSocial, disconnectSocial, listProfiles, adminUpdateProfile, adminDeleteProfile, logout],
  )

  return <RoadmapAuthContext.Provider value={value}>{children}</RoadmapAuthContext.Provider>
}

export function useRoadmapAuth() {
  const context = useContext(RoadmapAuthContext)
  if (!context) {
    throw new Error('useRoadmapAuth must be used within RoadmapAuthProvider')
  }
  return context
}
