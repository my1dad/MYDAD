export const ADMIN_USERNAME = 'admin'
export const ADMIN_PASSWORD = 'dollaraday'
export const ADMIN_ROLE = 'Master Admin'
export const ADMIN_WORKSPACE_NAME = 'Master Admin Workspace'

export function isAdminCredentialMatch(username: string, password: string) {
  return (
    username.trim().toLowerCase() === ADMIN_USERNAME &&
    password === ADMIN_PASSWORD
  )
}

export function isAdminProfile(profile: { username?: string } | null | undefined) {
  return profile?.username?.trim().toLowerCase() === ADMIN_USERNAME
}
