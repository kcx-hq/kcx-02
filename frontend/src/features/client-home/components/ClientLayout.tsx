import type { ReactNode } from "react"

import { ClientTopNavbar } from "@/features/client-home/components/ClientTopNavbar"

type ClientLayoutProps = {
  children: ReactNode
  orgName?: string
}

export function ClientLayout({ children, orgName = "Acme Cloud Services" }: ClientLayoutProps) {
  return (
    <div className="min-h-screen bg-white text-text-primary">
      <ClientTopNavbar orgName={orgName} />
      <div className="mx-auto w-full max-w-[1440px] px-6 py-7">
        <div className="space-y-6">{children}</div>
      </div>
    </div>
  )
}
