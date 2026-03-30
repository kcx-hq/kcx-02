import { useEffect } from "react"

import { Header } from "@/components/layout/Header"
import {
  ClientBillingPage,
  ClientLayout,
  ClientOverviewPage,
  ClientProfilePage,
  ClientSupportPage,
  ClientUsersPage,
} from "@/features/client-home"
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
import { isAuthenticated } from "@/lib/auth"
import { getBlogSlugFromPath, getRouteRedirectTarget, navigateTo, useCurrentRoute } from "@/lib/navigation"
import { HomePage } from "@/pages/HomePage"

const CLIENT_WORKSPACE_ROUTES = new Set([
  "/client",
  "/client/overview",
  "/client/billing",
  "/client/billing/uploads",
  "/client/billing/connections",
  "/client/billing/connections/aws",
  "/client/billing/connections/aws/automatic",
  "/client/billing/connections/aws/manual",
  "/client/support",
  "/client/support/tickets",
  "/client/support/schedule-call",
  "/client/support/live-chat",
  "/client/users",
  "/client/profile",
  "/clienthome",
  "/client-home",
])
const AWS_CONNECTION_SETUP_ROUTE_REGEX = /^\/client\/billing\/connections\/aws\/setup\/\d+$/

function isClientWorkspaceRoute(route: string) {
  return CLIENT_WORKSPACE_ROUTES.has(route) || AWS_CONNECTION_SETUP_ROUTE_REGEX.test(route)
}

const HEADERLESS_ROUTES = new Set(["/schedule-demo", "/login", "/forgot-password", "/reset-password", ...CLIENT_WORKSPACE_ROUTES])

export function App() {
  const route = useCurrentRoute()
  const authenticated = isAuthenticated()
  const blogSlug = getBlogSlugFromPath(route)
  const showMarketingHeader = !HEADERLESS_ROUTES.has(route) && !AWS_CONNECTION_SETUP_ROUTE_REGEX.test(route)

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
    if (isClientWorkspaceRoute(route) && !authenticated) {
      navigateTo("/login", { replace: true })
      return
    }

    if (route === "/login" && authenticated) {
      navigateTo("/client/overview", { replace: true })
    }
  }, [route, authenticated])

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
      {route === "/client" || route === "/client/overview" || route === "/clienthome" || route === "/client-home" ? (
        <ClientLayout>
          <ClientOverviewPage />
        </ClientLayout>
      ) : null}
      {route === "/client/billing" ||
      route === "/client/billing/uploads" ||
      route === "/client/billing/connections" ||
      route === "/client/billing/connections/aws" ||
      route === "/client/billing/connections/aws/automatic" ||
      route === "/client/billing/connections/aws/manual" ||
      AWS_CONNECTION_SETUP_ROUTE_REGEX.test(route) ? (
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
      {route === "/client/profile" ? (
        <ClientLayout>
          <ClientProfilePage />
        </ClientLayout>
      ) : null}
    </main>
  )
}

export default App
