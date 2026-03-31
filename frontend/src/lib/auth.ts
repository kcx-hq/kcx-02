export const KCX_AUTH_TOKEN_KEY = "kcx_auth_token"
export const KCX_AUTH_USER_KEY = "kcx_auth_user"
export const KCX_AUTH_EXPIRES_AT_KEY = "kcx_auth_expires_at"

export type AuthUser = {
  id: number | string
  email: string
  firstName: string
  lastName: string
  companyName: string | null
  tenantSlug?: string | null
  role: string
  status: string
  source: string
}

type AuthSession = {
  token: string
  user: AuthUser
  expiresAt: string
}

export function setAuthSession(session: AuthSession) {
  localStorage.setItem(KCX_AUTH_TOKEN_KEY, session.token)
  localStorage.setItem(KCX_AUTH_USER_KEY, JSON.stringify(session.user))
  localStorage.setItem(KCX_AUTH_EXPIRES_AT_KEY, session.expiresAt)
}

export function clearAuthSession() {
  localStorage.removeItem(KCX_AUTH_TOKEN_KEY)
  localStorage.removeItem(KCX_AUTH_USER_KEY)
  localStorage.removeItem(KCX_AUTH_EXPIRES_AT_KEY)
}

export function getAuthToken() {
  if (isSessionExpired()) {
    clearAuthSession()
    return null
  }
  return localStorage.getItem(KCX_AUTH_TOKEN_KEY)
}

export function getAuthUser(): AuthUser | null {
  if (isSessionExpired()) {
    clearAuthSession()
    return null
  }

  const raw = localStorage.getItem(KCX_AUTH_USER_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export function isAuthenticated() {
  return Boolean(getAuthToken() && !isSessionExpired())
}

export function isSessionExpired() {
  const expiresAt = localStorage.getItem(KCX_AUTH_EXPIRES_AT_KEY)
  if (!expiresAt) return true

  const expiresAtMs = Date.parse(expiresAt)
  if (Number.isNaN(expiresAtMs)) return true

  return Date.now() >= expiresAtMs
}
