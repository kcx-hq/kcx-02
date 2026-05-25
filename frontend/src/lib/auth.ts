export const KCX_AUTH_TOKEN_KEY = "kcx_auth_token"
export const KCX_AUTH_USER_KEY = "kcx_auth_user"
export const KCX_AUTH_EXPIRES_AT_KEY = "kcx_auth_expires_at"
const LEGACY_AUTH_EXPIRES_AT_KEYS = ["expires_at", "auth_expires_at", "access_token_expires_at"] as const
const LEGACY_AUTH_TOKEN_KEYS = ["auth_token", "token", "access_token", "accessToken", "authToken"] as const

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
  sessionStorage.removeItem(KCX_AUTH_TOKEN_KEY)
  sessionStorage.removeItem(KCX_AUTH_USER_KEY)
  sessionStorage.removeItem(KCX_AUTH_EXPIRES_AT_KEY)
}

export function getAuthToken() {
  const primaryToken = localStorage.getItem(KCX_AUTH_TOKEN_KEY)
  const sessionToken = sessionStorage.getItem(KCX_AUTH_TOKEN_KEY)
  const rawToken =
    primaryToken ??
    sessionToken ??
    LEGACY_AUTH_TOKEN_KEYS.map((key) => localStorage.getItem(key)).find((value) => Boolean(value)) ??
    LEGACY_AUTH_TOKEN_KEYS.map((key) => sessionStorage.getItem(key)).find((value) => Boolean(value)) ??
    null
  if (!rawToken) return null

  if (isSessionExpired()) {
    clearAuthSession()
    return null
  }

  const trimmed = String(rawToken).trim()
  if (!trimmed) return null
  return trimmed.startsWith("Bearer ") ? trimmed.slice("Bearer ".length).trim() : trimmed
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
  const expiresAt =
    localStorage.getItem(KCX_AUTH_EXPIRES_AT_KEY) ??
    sessionStorage.getItem(KCX_AUTH_EXPIRES_AT_KEY) ??
    LEGACY_AUTH_EXPIRES_AT_KEYS.map((key) => localStorage.getItem(key)).find((value) => Boolean(value)) ??
    LEGACY_AUTH_EXPIRES_AT_KEYS.map((key) => sessionStorage.getItem(key)).find((value) => Boolean(value)) ??
    null
  if (!expiresAt) return false

  const expiresAtMs = Date.parse(expiresAt)
  if (Number.isNaN(expiresAtMs)) return false

  return Date.now() >= expiresAtMs
}
