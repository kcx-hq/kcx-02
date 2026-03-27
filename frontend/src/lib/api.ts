import { appEnv } from "@/lib/env"
import { getAuthToken } from "@/lib/auth"

type ApiSuccess<T> = {
  success: true
  message: string
  data: T
  error: null
  meta: unknown
}

type ApiFailure = {
  success: false
  message: string
  data: null
  error: { code: string; details?: unknown }
  meta: unknown
}

type ApiResponse<T> = ApiSuccess<T> | ApiFailure

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly payload?: unknown
  ) {
    super(message)
  }
}

function joinUrl(base: string, path: string) {
  const normalizedBase = base.replace(/\/$/, "")
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${normalizedBase}${normalizedPath}`
}

export async function apiPost<TData>(path: string, body: unknown, init?: RequestInit): Promise<TData> {
  const url = joinUrl(appEnv.apiBaseUrl, path)
  const token = getAuthToken()
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    body: JSON.stringify(body),
    ...init,
  })

  const payload = (await response.json().catch(() => null)) as ApiResponse<TData> | null

  if (!response.ok) {
    throw new ApiError(payload?.message ?? "Request failed", response.status, payload)
  }
  if (!payload || payload.success !== true) {
    throw new ApiError(payload?.message ?? "Request failed", response.status, payload)
  }

  return payload.data
}

