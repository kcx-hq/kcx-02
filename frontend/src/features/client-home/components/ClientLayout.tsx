import { useEffect, useState, type ReactNode } from "react"

import { Sidebar } from "@/features/client-home/components/Sidebar"
import { TopHeader } from "@/features/client-home/components/TopHeader"
import { getAuthUser } from "@/lib/auth"
import { useCurrentRoute } from "@/lib/navigation"

type ClientLayoutProps = {
  children: ReactNode
  orgName?: string
}

export function ClientLayout({ children, orgName = "Your Organization" }: ClientLayoutProps) {
  const route = useCurrentRoute()
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const user = getAuthUser()
  const fallbackName = "User"
  const firstName = user?.firstName?.trim() ?? ""
  const lastName = user?.lastName?.trim() ?? ""
  const fullName = `${firstName} ${lastName}`.trim() || fallbackName
  const userDisplayName = fullName
  const organizationName = user?.tenantSlug?.trim() || user?.companyName?.trim() || orgName
  const userEmail = user?.email ?? "no-email@kcx.local"
  const userRole = user?.role ?? "client"

  useEffect(() => {
    setMobileSidebarOpen(false)
  }, [route])

  useEffect(() => {
    if (!mobileSidebarOpen) return

    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileSidebarOpen(false)
      }
    }

    document.addEventListener("keydown", onEscape)
    return () => document.removeEventListener("keydown", onEscape)
  }, [mobileSidebarOpen])

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#eef5f2_0%,#e7f1ed_100%)] text-text-primary [font-family:'IBM_Plex_Sans',sans-serif]">
      <TopHeader
        orgName={organizationName}
        userDisplayName={userDisplayName}
        userEmail={userEmail}
        userRole={userRole}
        onOpenSidebar={() => setMobileSidebarOpen(true)}
      />

      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[228px] border-r border-[rgba(132,165,157,0.24)] bg-[linear-gradient(180deg,#0f1a24_0%,#122432_100%)] lg:block">
        <div className="h-full overflow-y-auto">
          <Sidebar route={route} orgName={organizationName} onNavigate={() => setMobileSidebarOpen(false)} />
        </div>
      </aside>

      <div className="relative min-h-[calc(100vh-4rem)] w-full bg-[linear-gradient(180deg,#edf4f1_0%,#eaf2ef_35%,#e6efeb_100%)] lg:ml-[228px] lg:w-[calc(100%-228px)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_40%_at_90%_0%,rgba(102,172,147,0.12),rgba(102,172,147,0)_70%)]" />
        <main className="relative min-w-0 px-4 py-5 sm:px-[22px] sm:py-[18px]">
          <div className="mx-auto w-full max-w-[1440px]">
            <div className="space-y-6">{children}</div>
          </div>
        </main>
      </div>

      {mobileSidebarOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Sidebar navigation">
          <button
            type="button"
            className="absolute inset-0 bg-[rgba(3,9,10,0.62)] backdrop-blur-[1px]"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="Close sidebar navigation"
          />
          <div className="relative h-full w-[228px] max-w-[88vw] border-r border-[rgba(132,165,157,0.24)] bg-[linear-gradient(180deg,#0f1a24_0%,#122432_100%)]">
            <div className="h-full overflow-auto">
              <Sidebar route={route} orgName={organizationName} onNavigate={() => setMobileSidebarOpen(false)} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
