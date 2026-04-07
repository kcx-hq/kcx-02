import { appEnv } from "@/lib/env"
import { clearAuthSession, getAuthToken } from "@/lib/auth"
import { navigateTo } from "@/lib/navigation"

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

function handleUnauthorized(path: string, status: number) {
  if (status !== 401) return
  if (path.startsWith("/auth/") || path.startsWith("/admin/auth/")) return
  if (path === "/api/aws/manual/create-connection") return

  clearAuthSession()
  navigateTo("/login", { replace: true })
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
    handleUnauthorized(path, response.status)
    throw new ApiError(payload?.message ?? "Request failed", response.status, payload)
  }
  if (!payload || payload.success !== true) {
    handleUnauthorized(path, response.status)
    throw new ApiError(payload?.message ?? "Request failed", response.status, payload)
  }

  return payload.data
}

export async function apiGet<TData>(path: string, init?: RequestInit): Promise<TData> {
  const url = joinUrl(appEnv.apiBaseUrl, path)
  const token = getAuthToken()
  const response = await fetch(url, {
    method: "GET",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  const payload = (await response.json().catch(() => null)) as ApiResponse<TData> | null

  if (!response.ok) {
    handleUnauthorized(path, response.status)
    throw new ApiError(payload?.message ?? "Request failed", response.status, payload)
  }
  if (!payload || payload.success !== true) {
    handleUnauthorized(path, response.status)
    throw new ApiError(payload?.message ?? "Request failed", response.status, payload)
  }

  return payload.data
}

export async function apiPatch<TData>(path: string, body: unknown, init?: RequestInit): Promise<TData> {
  const url = joinUrl(appEnv.apiBaseUrl, path)
  const token = getAuthToken()
  const response = await fetch(url, {
    method: "PATCH",
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
    handleUnauthorized(path, response.status)
    throw new ApiError(payload?.message ?? "Request failed", response.status, payload)
  }
  if (!payload || payload.success !== true) {
    handleUnauthorized(path, response.status)
    throw new ApiError(payload?.message ?? "Request failed", response.status, payload)
  }

  return payload.data
}

export async function apiPostForm<TData>(path: string, formData: FormData, init?: RequestInit): Promise<TData> {
  const url = joinUrl(appEnv.apiBaseUrl, path)
  const token = getAuthToken()
  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    body: formData,
    ...init,
  })

  const payload = (await response.json().catch(() => null)) as (ApiResponse<TData> | TData | { message?: string } | null)

  if (!response.ok) {
    handleUnauthorized(path, response.status)
    const errorMessage =
      payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
        ? payload.message
        : "Request failed"
    throw new ApiError(errorMessage, response.status, payload)
  }

  if (
    payload &&
    typeof payload === "object" &&
    "success" in payload &&
    (payload as ApiResponse<TData>).success === true
  ) {
    return (payload as ApiSuccess<TData>).data
  }

  return payload as TData
}

