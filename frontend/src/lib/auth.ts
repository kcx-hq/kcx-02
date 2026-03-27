export const KCX_AUTH_TOKEN_KEY = "kcx_auth_token"
export const KCX_AUTH_USER_KEY = "kcx_auth_user"

export type AuthUser = {
  id: number
  email: string
  firstName: string
  lastName: string
  companyName: string | null
  role: string
  status: string
  source: string
}

type AuthSession = {
  token: string
  user: AuthUser
}

export function setAuthSession(session: AuthSession) {
  localStorage.setItem(KCX_AUTH_TOKEN_KEY, session.token)
  localStorage.setItem(KCX_AUTH_USER_KEY, JSON.stringify(session.user))
}

export function clearAuthSession() {
  localStorage.removeItem(KCX_AUTH_TOKEN_KEY)
  localStorage.removeItem(KCX_AUTH_USER_KEY)
}

export function getAuthToken() {
  return localStorage.getItem(KCX_AUTH_TOKEN_KEY)
}

export function getAuthUser(): AuthUser | null {
  const raw = localStorage.getItem(KCX_AUTH_USER_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export function isAuthenticated() {
  return Boolean(getAuthToken())
}
