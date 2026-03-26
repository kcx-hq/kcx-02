import { useEffect } from "react"
import { Navigate, Route, Routes } from "react-router-dom"

import { Header } from "@/components/layout/Header"
import { getBlogSlugFromPath, getRouteRedirectTarget, navigateTo, useCurrentRoute } from "@/lib/navigation"
import { HomePage } from "@/pages/HomePage"
import {
  AwsIntegrationPage,
  BlogDetailPage,
  BlogPage,
  CareersPage,
  DocumentationPage,
  LeadershipPage,
  LoginPage,
  OurStoryPage,
  ScheduleDemoPage,
} from "@/features/landing/pages"

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/schedule-demo" element={<ScheduleDemoPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/integrations/aws" element={<AwsIntegrationPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export function App() {
  const route = useCurrentRoute()
  const blogSlug = getBlogSlugFromPath(route)

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" })
  }, [route])

  useEffect(() => {
    const redirectTarget = getRouteRedirectTarget(window.location.pathname)
    if (redirectTarget) {
      navigateTo(redirectTarget, { replace: true })
    }
  }, [route])

  return (
    <main className="min-h-screen overflow-x-clip bg-background text-foreground">
      {route === "/schedule-demo" || route === "/login" ? null : <Header />}

      {route === "/" ? <HomePage /> : null}
      {route === "/schedule-demo" ? <ScheduleDemoPage /> : null}
      {route === "/login" ? <LoginPage /> : null}
      {route === "/about/our-story" ? <OurStoryPage /> : null}
      {route === "/about/leadership" ? <LeadershipPage /> : null}
      {route === "/about/careers" ? <CareersPage /> : null}
      {route === "/integrations/aws" ? <AwsIntegrationPage /> : null}
      {route === "/resources/blog" || route === "/resources/blogs" ? <BlogPage /> : null}
      {blogSlug ? <BlogDetailPage slug={blogSlug} /> : null}
      {route === "/resources/documentation" ? <DocumentationPage /> : null}
    </main>
  )
}

export default App


