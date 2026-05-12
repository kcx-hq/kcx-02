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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? ""
  if (contentType.toLowerCase().includes("application/json")) {
    return response.json().catch(() => null)
  }

  const text = await response.text().catch(() => "")
  const trimmed = text.trim()
  if (!trimmed) return null

  try {
    return JSON.parse(trimmed) as unknown
  } catch {
    return { message: trimmed }
  }
}

function getErrorMessage(payload: unknown, fallback = "Request failed"): string {
  if (!isRecord(payload)) return fallback

  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message
  }

  const errorValue = payload.error
  if (isRecord(errorValue)) {
    if (typeof errorValue.message === "string" && errorValue.message.trim()) {
      return errorValue.message
    }
    if (typeof errorValue.details === "string" && errorValue.details.trim()) {
      return errorValue.details
    }
    if (isRecord(errorValue.details) && typeof errorValue.details.message === "string" && errorValue.details.message.trim()) {
      return errorValue.details.message
    }
  }

  return fallback
}

export async function apiPost<TData>(path: string, body: unknown, init?: RequestInit): Promise<TData> {
  const url = joinUrl(appEnv.apiBaseUrl, path)
  const token = getAuthToken()
  const { headers: initHeaders, ...restInit } = init ?? {}
  let response: Response
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(initHeaders ?? {}),
      },
      body: JSON.stringify(body),
      ...restInit,
    })
  } catch (error) {
    throw new ApiError(
      `Network error while calling ${url}. Check backend server, VITE_API_BASE_URL, and CORS settings.`,
      0,
      error,
    )
  }

  const payload = (await parseResponseBody(response)) as ApiResponse<TData> | null

  if (!response.ok) {
    handleUnauthorized(path, response.status)
    throw new ApiError(getErrorMessage(payload), response.status, payload)
  }
  if (!payload || payload.success !== true) {
    handleUnauthorized(path, response.status)
    throw new ApiError(getErrorMessage(payload), response.status, payload)
  }

  return payload.data
}

export async function apiGet<TData>(path: string, init?: RequestInit): Promise<TData> {
  const url = joinUrl(appEnv.apiBaseUrl, path)
  const token = getAuthToken()
  const { headers: initHeaders, ...restInit } = init ?? {}
  let response: Response
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(initHeaders ?? {}),
      },
      ...restInit,
    })
  } catch (error) {
    throw new ApiError(
      `Network error while calling ${url}. Check backend server, VITE_API_BASE_URL, and CORS settings.`,
      0,
      error,
    )
  }

  const payload = (await parseResponseBody(response)) as ApiResponse<TData> | null

  if (!response.ok) {
    handleUnauthorized(path, response.status)
    throw new ApiError(getErrorMessage(payload), response.status, payload)
  }
  if (!payload || payload.success !== true) {
    handleUnauthorized(path, response.status)
    throw new ApiError(getErrorMessage(payload), response.status, payload)
  }

  return payload.data
}

export async function apiPatch<TData>(path: string, body: unknown, init?: RequestInit): Promise<TData> {
  const url = joinUrl(appEnv.apiBaseUrl, path)
  const token = getAuthToken()
  const { headers: initHeaders, ...restInit } = init ?? {}
  let response: Response
  try {
    response = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(initHeaders ?? {}),
      },
      body: JSON.stringify(body),
      ...restInit,
    })
  } catch (error) {
    throw new ApiError(
      `Network error while calling ${url}. Check backend server, VITE_API_BASE_URL, and CORS settings.`,
      0,
      error,
    )
  }

  const payload = (await parseResponseBody(response)) as ApiResponse<TData> | null

  if (!response.ok) {
    handleUnauthorized(path, response.status)
    throw new ApiError(getErrorMessage(payload), response.status, payload)
  }
  if (!payload || payload.success !== true) {
    handleUnauthorized(path, response.status)
    throw new ApiError(getErrorMessage(payload), response.status, payload)
  }

  return payload.data
}

export async function apiPostForm<TData>(path: string, formData: FormData, init?: RequestInit): Promise<TData> {
  const url = joinUrl(appEnv.apiBaseUrl, path)
  const token = getAuthToken()
  const { headers: initHeaders, ...restInit } = init ?? {}
  let response: Response
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(initHeaders ?? {}),
      },
      body: formData,
      ...restInit,
    })
  } catch (error) {
    throw new ApiError(
      `Network error while calling ${url}. Check backend server, VITE_API_BASE_URL, and CORS settings.`,
      0,
      error,
    )
  }

  const payload = (await parseResponseBody(response)) as (ApiResponse<TData> | TData | { message?: string } | null)

  if (!response.ok) {
    handleUnauthorized(path, response.status)
    throw new ApiError(getErrorMessage(payload), response.status, payload)
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
