function readEnv(key: string): string {
  const value = (import.meta.env as Record<string, unknown>)[key]
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing env var: ${key}`)
  }
  return value.trim()
}

export const appEnv = {
  apiBaseUrl: readEnv("VITE_API_BASE_URL"),
  frontendUrl: readEnv("VITE_FRONTEND_URL"),
} as const

