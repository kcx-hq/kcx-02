import { useEffect, useState } from "react"

import { Header } from "@/components/layout/Header"
import { ActionPage } from "@/features/actions"
import {
  ClientAwsConnectionPage,
  ClientBillingPage,
  ClientBillingUploadHistoryPage,
  ClientCloudIntegrationPage,
  ClientLayout,
  ClientOverviewPage,
  ClientProfilePage,
  ClientSupportPage,
  ClientUsersPage,
} from "@/features/client-home"
import { DashboardRoutes } from "@/features/dashboard"
import { ManualDashboardRoutes } from "@/features/manual-dashboard"
import {
  AwsIntegrationPage,
  BlogDetailPage,
  BlogPage,
  CareersPage,
  DocumentationPage,
  ForgotPasswordPage,
  LeadershipPage,
  LoginPage,
  OurStoryPage,
  ResetPasswordPage,
  ScheduleDemoPage,
} from "@/features/landing/pages"
import { clearAuthSession, isAuthenticated } from "@/lib/auth"
import { ApiError, apiGet } from "@/lib/api"
import { getBlogSlugFromPath, getRouteRedirectTarget, navigateTo, useCurrentRoute } from "@/lib/navigation"
import { HomePage } from "@/pages/HomePage"

const CLIENT_WORKSPACE_ROUTES = new Set([
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
  "/client/billing/connect-cloud/azure",
  "/client/billing/connect-cloud/gcp",
  "/client/billing/connect-cloud/oracle-cloud",
  "/client/billing/connect-cloud/aws/automatic",
  "/client/billing/connect-cloud/aws/manual",
  "/client/billing/connect-cloud/aws/manual/success",
  "/client/billing/cloud-integration",
  "/client/billing/upload-files",
  "/client/support",
  "/client/support/tickets",
  "/client/support/schedule-call",
  "/client/support/live-chat",
  "/client/users",
  "/client/actions",
  "/client/profile",
])
const AWS_CONNECTION_SETUP_ROUTE_REGEX = /^\/client\/billing\/(?:connect-cloud|connections)\/aws\/setup\/[0-9a-fA-F-]{36}$/
const CLOUD_PROVIDER_ROUTE_REGEX = /^\/client\/billing\/(?:connect-cloud|connections)\/(aws|azure|gcp|oracle-cloud)$/
const NON_AWS_PROVIDER_ROUTE_REGEX = /^\/client\/billing\/(?:connect-cloud|connections)\/(azure|gcp|oracle-cloud)$/
const AWS_MANUAL_EXPLORER_ROUTE_REGEX = /^\/client\/billing\/(?:connect-cloud|connections)\/aws\/manual\/explorer(?:\/|$)/
const AWS_MANUAL_SUCCESS_ROUTE_REGEX = /^\/client\/billing\/(?:connect-cloud|connections)\/aws\/manual\/success(?:\/|$)/
const DASHBOARD_ROUTE_REGEX =
  /^\/dashboard(?:\/(?:overview|cost-explorer|resources|allocation|optimization|anomalies-alerts|budget|report))?$/
const MANUAL_DASHBOARD_ROUTE_REGEX =
  /^\/uploads-dashboard(?:\/(?:overview|cost-explorer|anomalies-alerts))?$/

function isClientWorkspaceRoute(route: string) {
  return (
    CLIENT_WORKSPACE_ROUTES.has(route) ||
    AWS_CONNECTION_SETUP_ROUTE_REGEX.test(route) ||
    CLOUD_PROVIDER_ROUTE_REGEX.test(route) ||
    AWS_MANUAL_EXPLORER_ROUTE_REGEX.test(route) ||
    AWS_MANUAL_SUCCESS_ROUTE_REGEX.test(route)
  )
}

const HEADERLESS_ROUTES = new Set(["/schedule-demo", "/login", "/forgot-password", "/reset-password", ...CLIENT_WORKSPACE_ROUTES])

export function App() {
  const route = useCurrentRoute()
  const storedAuthenticated = isAuthenticated()
  const [authChecked, setAuthChecked] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)
  const blogSlug = getBlogSlugFromPath(route)
  const showMarketingHeader =
    !HEADERLESS_ROUTES.has(route) &&
    !AWS_CONNECTION_SETUP_ROUTE_REGEX.test(route) &&
    !CLOUD_PROVIDER_ROUTE_REGEX.test(route) &&
    !AWS_MANUAL_EXPLORER_ROUTE_REGEX.test(route) &&
    !AWS_MANUAL_SUCCESS_ROUTE_REGEX.test(route) &&
    !DASHBOARD_ROUTE_REGEX.test(route) &&
    !MANUAL_DASHBOARD_ROUTE_REGEX.test(route)

  useEffect(() => {
    if (!storedAuthenticated) {
      setAuthenticated(false)
      setAuthChecked(true)
      return
    }

    let cancelled = false
    void (async () => {
      try {
        await apiGet<{ user: { id: string } | null }>("/auth/me")
        if (!cancelled) {
          setAuthenticated(true)
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          clearAuthSession()
        }
        if (!cancelled) {
          setAuthenticated(false)
        }
      } finally {
        if (!cancelled) {
          setAuthChecked(true)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [storedAuthenticated])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" })
  }, [route])

  useEffect(() => {
    const redirectTarget = getRouteRedirectTarget(window.location.pathname)
    if (redirectTarget) {
      navigateTo(redirectTarget, { replace: true })
    }
  }, [route])

  useEffect(() => {
    if (!authChecked) return

    if (isClientWorkspaceRoute(route) && !authenticated) {
      navigateTo("/login", { replace: true })
      return
    }

    if (route === "/login" && authenticated) {
      navigateTo("/client/overview", { replace: true })
    }
  }, [route, authenticated, authChecked])

  return (
    <main className="min-h-screen overflow-x-clip bg-background text-foreground">
      {showMarketingHeader ? <Header /> : null}

      {route === "/" ? <HomePage /> : null}
      {route === "/schedule-demo" ? <ScheduleDemoPage /> : null}
      {route === "/login" ? <LoginPage /> : null}
      {route === "/forgot-password" ? <ForgotPasswordPage /> : null}
      {route === "/reset-password" ? <ResetPasswordPage /> : null}
      {route === "/about/our-story" ? <OurStoryPage /> : null}
      {route === "/about/leadership" ? <LeadershipPage /> : null}
      {route === "/about/careers" ? <CareersPage /> : null}
      {route === "/integrations/aws" ? <AwsIntegrationPage /> : null}
      {route === "/resources/blog" || route === "/resources/blogs" ? <BlogPage /> : null}
      {blogSlug ? <BlogDetailPage slug={blogSlug} /> : null}
      {route === "/resources/documentation" ? <DocumentationPage /> : null}
      {DASHBOARD_ROUTE_REGEX.test(route) ? <DashboardRoutes /> : null}
      {MANUAL_DASHBOARD_ROUTE_REGEX.test(route) ? <ManualDashboardRoutes /> : null}
      {route === "/client/overview" ? (
        <ClientLayout>
          <ClientOverviewPage />
        </ClientLayout>
      ) : null}
      {route === "/client/billing/uploads" || route === "/client/billing/upload-files" ? (
        <ClientLayout>
          <ClientBillingUploadHistoryPage />
        </ClientLayout>
      ) : null}
      {route === "/client/billing/cloud-integration" ||
      route === "/client/billing/connections" ||
      route === "/client/billing/connections/add" ||
      route === "/client/billing/connections/add/aws" ||
      route === "/client/billing/connect-cloud" ||
      route === "/client/billing/connect-cloud/add" ||
      route === "/client/billing/connect-cloud/add/aws" ? (
        <ClientLayout>
          <ClientCloudIntegrationPage />
        </ClientLayout>
      ) : null}
      {route === "/client/billing/connections/aws" ||
      route === "/client/billing/connect-cloud/aws" ||
      route === "/client/billing/connections/aws/automatic" ||
      route === "/client/billing/connect-cloud/aws/automatic" ||
      route === "/client/billing/connections/aws/manual" ||
      route === "/client/billing/connect-cloud/aws/manual" ||
      route === "/client/billing/connections/aws/manual/success" ||
      route === "/client/billing/connect-cloud/aws/manual/success" ||
      AWS_MANUAL_EXPLORER_ROUTE_REGEX.test(route) ||
      AWS_MANUAL_SUCCESS_ROUTE_REGEX.test(route) ||
      AWS_CONNECTION_SETUP_ROUTE_REGEX.test(route) ? (
        <ClientLayout>
          <ClientAwsConnectionPage />
        </ClientLayout>
      ) : null}
      {route === "/client/billing" ||
      route === "/client/billing/import-s3" ||
      NON_AWS_PROVIDER_ROUTE_REGEX.test(route) ? (
        <ClientLayout>
          <ClientBillingPage />
        </ClientLayout>
      ) : null}
      {route === "/client/support" || route === "/client/support/tickets" || route === "/client/support/schedule-call" || route === "/client/support/live-chat" ? (
        <ClientLayout>
          <ClientSupportPage />
        </ClientLayout>
      ) : null}
      {route === "/client/users" ? (
        <ClientLayout>
          <ClientUsersPage />
        </ClientLayout>
      ) : null}
      {route === "/client/actions" ? (
        <ClientLayout>
          <ActionPage />
        </ClientLayout>
      ) : null}
      {route === "/client/profile" ? (
        <ClientLayout>
          <ClientProfilePage />
        </ClientLayout>
      ) : null}
    </main>
  )
}

export default App

