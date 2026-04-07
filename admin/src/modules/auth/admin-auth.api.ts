import { apiFetch } from "@/lib/api"

export type AdminLoginResult = {
  token: string
  expiresAt: string
  admin: { id: number; email: string; role: string }
}

export async function adminLogin(email: string, password: string): Promise<AdminLoginResult> {
  return apiFetch<AdminLoginResult>("/admin/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  })
}

export async function adminMe(token: string): Promise<{ admin: { id: number; email: string; role: string } | null }> {
  return apiFetch<{ admin: { id: number; email: string; role: string } | null }>("/admin/auth/me", {
    method: "GET",
    token,
  })
}

