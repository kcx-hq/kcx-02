import type { MouseEvent } from "react"
import { useSyncExternalStore } from "react"

const STATIC_ROUTES = [
  "/",
  "/client",
  "/client/overview",
  "/client/billing",
  "/client/billing/uploads",
  "/client/billing/connections",
  "/client/billing/connections/aws",
  "/client/billing/connections/aws/manual",
  "/client/support",
  "/client/support/tickets",
  "/client/support/schedule-call",
  "/client/support/live-chat",
  "/client/users",
  "/client/profile",
  "/clienthome",
  "/client-home",
  "/schedule-demo",
  "/login",
  "/reset-password",
  "/about/our-story",
  "/about/leadership",
  "/about/careers",
  "/our-story",
  "/leadership",
  "/careers",
  "/resources/blog",
  "/resources/blogs",
  "/blogs",
  "/resources/documentation",
  "/integrations/aws",
] as const
type StaticRoute = (typeof STATIC_ROUTES)[number]

const STATIC_ROUTE_SET = new Set<string>(STATIC_ROUTES)
const LEGACY_ROUTE_REDIRECTS: Record<string, StaticRoute> = {
  "/blog": "/resources/blog",
  "/blogs": "/resources/blog",
  "/documentation": "/resources/documentation",
  "/our-story": "/about/our-story",
  "/leadership": "/about/leadership",
  "/careers": "/about/careers",
  "/demo": "/schedule-demo",
  "/client-sign-in": "/",
  "/client-home": "/client/overview",
  "/clienthome": "/client/overview",
  "/client/tickets": "/client/support/tickets",
  "/client/billing": "/client/billing/uploads",
  "/client/billing/manual-setup": "/client/billing/connections",
  "/client/billing/connections/add": "/client/billing/connections/aws",
  "/client/billing/connections/manual-setup": "/client/billing/connections/aws/manual",
}
const VALID_PATH_SET = new Set<string>([...STATIC_ROUTES, ...Object.keys(LEGACY_ROUTE_REDIRECTS)])
const BLOG_DETAIL_PATH_REGEX = /^\/resources\/blogs?\/([^/]+)$/

function normalizePathname(pathname: string): string {
  if (!pathname.startsWith("/")) return `/${pathname}`
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1)
  return pathname
}

type RouteResolution = {
  route: string
  redirectTo: string | null
}

function resolvePathname(pathname: string): RouteResolution {
  const normalized = normalizePathname(pathname)
  if (STATIC_ROUTE_SET.has(normalized)) {
    return { route: normalized, redirectTo: null }
  }

  if (BLOG_DETAIL_PATH_REGEX.test(normalized)) {
    return { route: normalized, redirectTo: null }
  }

  if (normalized in LEGACY_ROUTE_REDIRECTS) {
    const redirectTo = LEGACY_ROUTE_REDIRECTS[normalized]
    return { route: redirectTo, redirectTo }
  }

  return { route: "/", redirectTo: null }
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener("popstate", onStoreChange)
  return () => window.removeEventListener("popstate", onStoreChange)
}

function getSnapshot() {
  return resolvePathname(window.location.pathname).route
}

export function useCurrentRoute() {
  return useSyncExternalStore<string>(subscribe, getSnapshot, () => "/")
}

export function getRouteRedirectTarget(pathname: string) {
  return resolvePathname(pathname).redirectTo
}

export function navigateTo(pathname: string, options?: { replace?: boolean }) {
  const target = resolvePathname(pathname).route
  const currentPath = normalizePathname(window.location.pathname)
  if (currentPath === target) return

  const historyMethod = options?.replace ? "replaceState" : "pushState"
  window.history[historyMethod]({}, "", target)
  window.dispatchEvent(new PopStateEvent("popstate"))
}

export function handleAppLinkClick(
  event: MouseEvent<HTMLAnchorElement>,
  href: string,
  onNavigate?: () => void
) {
  const isModifiedClick =
    event.button !== 0 || event.metaKey || event.altKey || event.ctrlKey || event.shiftKey
  if (isModifiedClick || event.defaultPrevented) return

  const normalizedHref = normalizePathname(href)
  const isKnownPath = VALID_PATH_SET.has(normalizedHref) || BLOG_DETAIL_PATH_REGEX.test(normalizedHref)
  if (!isKnownPath) return

  event.preventDefault()
  navigateTo(normalizedHref)
  onNavigate?.()
}

export function getBlogSlugFromPath(pathname: string): string | null {
  const normalized = normalizePathname(pathname)
  const match = BLOG_DETAIL_PATH_REGEX.exec(normalized)
  if (!match) return null

  return decodeURIComponent(match[1])
}

export function isBlogDetailPath(pathname: string) {
  const normalized = normalizePathname(pathname)
  return BLOG_DETAIL_PATH_REGEX.test(normalized)
}
