import type { ReactNode } from "react"

import { getAuthUser } from "@/lib/auth"
import { ClientTopNavbar } from "@/features/client-home/components/ClientTopNavbar"

type ClientLayoutProps = {
  children: ReactNode
  orgName?: string
}

export function ClientLayout({ children, orgName = "Your Organization" }: ClientLayoutProps) {
  const user = getAuthUser()
  const fallbackName = "User"
  const firstName = user?.firstName?.trim() ?? ""
  const lastName = user?.lastName?.trim() ?? ""
  const fullName = `${firstName} ${lastName}`.trim() || fallbackName
  const userDisplayName = fullName
  const organizationName = user?.tenantSlug?.trim() || user?.companyName?.trim() || orgName
  const userEmail = user?.email ?? "no-email@kcx.local"
  const userRole = user?.role ?? "client"

  return (
    <div className="min-h-screen bg-white text-text-primary">
      <ClientTopNavbar
        orgName={organizationName}
        userDisplayName={userDisplayName}
        userEmail={userEmail}
        userRole={userRole}
      />
      <div className="mx-auto w-full max-w-[1440px] px-6 py-7">
        <div className="space-y-6">{children}</div>
      </div>
    </div>
  )
}
