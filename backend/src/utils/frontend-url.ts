import env from "../config/env.js";

export function buildFrontendUrl(pathname: string, params?: Record<string, string>): string | null {
  if (!env.frontendBaseUrl) return null;

  const base = env.frontendBaseUrl.replace(/\/$/, "");
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const url = new URL(`${base}${path}`);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}

