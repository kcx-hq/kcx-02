import type { MouseEvent } from "react"
import { useSyncExternalStore } from "react"

const STATIC_ROUTES = [
  "/",
  "/dashboard",
  "/dashboard/overview",
  "/dashboard/cfo-dashboard",
  "/dashboard/cost",
  "/dashboard/cost/explorer",
  "/dashboard/cost/history",
  "/dashboard/cost-explorer",
  "/dashboard/ec2",
  "/dashboard/ec2/cost",
  "/dashboard/ec2/usage",
  "/dashboard/ec2/instance-hours",
  "/dashboard/ec2/anomaly-detection",
  "/dashboard/resources",
  "/dashboard/allocation",
  "/dashboard/optimization",
  "/dashboard/anomalies-alerts",
  "/dashboard/budget",
  "/dashboard/report",
  "/dashboard/inventory",
  "/dashboard/inventory/aws",
  "/dashboard/inventory/aws/ec2",
  "/dashboard/inventory/aws/ec2/instances",
  "/dashboard/inventory/aws/ec2/snapshots",
  "/dashboard/inventory/aws/ec2/volumes",
  "/uploads-dashboard",
  "/uploads-dashboard/overview",
  "/uploads-dashboard/cost-explorer",
  "/uploads-dashboard/anomalies-alerts",
  "/client/overview",
  "/client/billing",
  "/client/billing/import-s3",
  "/client/billing/uploads",
  "/client/billing/connections",
  "/client/billing/connections/add",
  "/client/billing/connections/add/aws",
  "/client/billing/connections/aws",
  "/client/billing/connections/aws/automatic",
  "/client/billing/connections/aws/manual",
  "/client/billing/connections/aws/manual/success",
  "/client/billing/connect-cloud",
  "/client/billing/connect-cloud/add",
  "/client/billing/connect-cloud/add/aws",
  "/client/billing/connect-cloud/aws",
  "/client/billing/connect-cloud/aws/automatic",
  "/client/billing/connect-cloud/aws/manual",
  "/client/billing/connect-cloud/aws/manual/success",
  "/client/billing/cloud-integration",
  "/client/billing/upload-files",
  "/client/support",
  "/client/support/tickets",
  "/client/support/schedule-call",
  "/client/support/live-chat",
  "/client/support/ticket-management",
  "/client/support/meetings",
  "/client/users",
  "/client/organization/users",
  "/client/profile",
  "/schedule-demo",
  "/login",
  "/forgot-password",
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
  "/client": "/client/overview",
  "/client-home": "/client/overview",
  "/clienthome": "/client/overview",
  "/client/tickets": "/client/support/tickets",
  "/client/billing": "/client/billing/uploads",
  "/billing/cloud-integration": "/client/billing/cloud-integration",
  "/billing/upload-files": "/client/billing/upload-files",
  "/support/ticket-management": "/client/support/ticket-management",
  "/support/meetings": "/client/support/meetings",
  "/organization/users": "/client/organization/users",
  "/organization/roles": "/client/organization/users",
  "/organization/users-roles": "/client/organization/users",
  "/client/support/ticket-management": "/client/support/ticket-management",
  "/client/support/meetings": "/client/support/meetings",
  "/client/users": "/client/organization/users",
  "/client/organization/users-roles": "/client/organization/users",
  "/client/organization/roles": "/client/organization/users",
  "/client/billing/connections": "/client/billing/connect-cloud",
  "/client/billing/connections/add": "/client/billing/connect-cloud/add/aws",
  "/client/billing/connections/add/aws": "/client/billing/connect-cloud/add/aws",
  "/client/billing/connect-cloud/add": "/client/billing/connect-cloud/add/aws",
  "/client/billing/connections/aws": "/client/billing/connect-cloud/aws",
  "/client/billing/connections/aws/automatic": "/client/billing/connect-cloud/aws/automatic",
  "/client/billing/connections/aws/manual": "/client/billing/connect-cloud/aws/manual",
  "/client/billing/connections/aws/manual/success": "/client/billing/connect-cloud/aws/manual/success",
  "/client/billing/connections/manual-setup": "/client/billing/connect-cloud/aws/manual",
  "/client/inventory": "/dashboard/inventory/aws",
  "/client/inventory/aws": "/dashboard/inventory/aws",
  "/client/inventory/aws/ec2": "/dashboard/inventory/aws/ec2/instances",
  "/client/inventory/aws/ec2/instances": "/dashboard/inventory/aws/ec2/instances",
  "/client/inventory/aws/ec2/snapshots": "/dashboard/inventory/aws/ec2/snapshots",
  "/client/inventory/aws/ec2/volumes": "/dashboard/inventory/aws/ec2/volumes",
  "/dashboard/ec2/volumes": "/dashboard/inventory/aws/ec2/volumes",
  "/dashboard/cost-analysis": "/dashboard/cost/explorer",
  "/dashboard/cost-driver": "/dashboard/allocation",
  "/dashboard/data-quality": "/dashboard/anomalies-alerts",
  "/manual-dashboard": "/uploads-dashboard/overview",
  "/client/billing/manual-setup": "/client/billing/connect-cloud/aws/manual",
}
const VALID_PATH_SET = new Set<string>([...STATIC_ROUTES, ...Object.keys(LEGACY_ROUTE_REDIRECTS)])
const BLOG_DETAIL_PATH_REGEX = /^\/resources\/blogs?\/([^/]+)$/
const AWS_CONNECTION_SETUP_PATH_REGEX = /^\/client\/billing\/(?:connect-cloud|connections)\/aws\/setup\/[0-9a-fA-F-]{36}$/
const AWS_MANUAL_EXPLORER_PATH_REGEX = /^\/client\/billing\/(?:connect-cloud|connections)\/aws\/manual\/explorer(?:\/|$)/
const AWS_MANUAL_SUCCESS_PATH_REGEX = /^\/client\/billing\/(?:connect-cloud|connections)\/aws\/manual\/success(?:\/|$)/

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

  if (AWS_CONNECTION_SETUP_PATH_REGEX.test(normalized)) {
    return { route: normalized, redirectTo: null }
  }

  if (AWS_MANUAL_EXPLORER_PATH_REGEX.test(normalized)) {
    return { route: normalized, redirectTo: null }
  }

  if (AWS_MANUAL_SUCCESS_PATH_REGEX.test(normalized)) {
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
  const isKnownPath =
    VALID_PATH_SET.has(normalizedHref) ||
    BLOG_DETAIL_PATH_REGEX.test(normalizedHref) ||
    AWS_CONNECTION_SETUP_PATH_REGEX.test(normalizedHref) ||
    AWS_MANUAL_EXPLORER_PATH_REGEX.test(normalizedHref) ||
    AWS_MANUAL_SUCCESS_PATH_REGEX.test(normalizedHref)
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
