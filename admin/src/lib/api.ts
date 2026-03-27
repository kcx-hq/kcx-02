const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:5000"

export type ApiResponse<T> = {
  success: boolean
  message: string
  data: T | null
  error: { code: string; details?: unknown } | null
  meta: { timestamp: string; requestId?: string }
}

export class ApiError extends Error {
  code?: string
  status?: number

  constructor(message: string, params?: { code?: string; status?: number }) {
    super(message)
    this.name = "ApiError"
    this.code = params?.code
    this.status = params?.status
  }
}

export const getApiBaseUrl = () => API_BASE_URL

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { token?: string | null }
): Promise<T> {
  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`
  const headers = new Headers(init?.headers)
  headers.set("Content-Type", "application/json")

  if (init?.token) {
    headers.set("Authorization", `Bearer ${init.token}`)
  }

  const res = await fetch(url, { ...init, headers })
  const json = (await res.json().catch(() => null)) as ApiResponse<T> | null

  if (!res.ok || !json?.success) {
    throw new ApiError(json?.message ?? "Request failed", {
      code: json?.error?.code,
      status: res.status,
    })
  }

  return (json.data ?? null) as T
}

