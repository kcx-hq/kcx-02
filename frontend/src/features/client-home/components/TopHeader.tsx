import { ClientTopNavbar } from "@/features/client-home/components/ClientTopNavbar"

type TopHeaderProps = {
  orgName: string
  userDisplayName: string
  userEmail: string
  userRole: string
  onOpenSidebar: () => void
}

export function TopHeader({ orgName, userDisplayName, userEmail, userRole, onOpenSidebar }: TopHeaderProps) {
  return (
    <ClientTopNavbar
      orgName={orgName}
      userDisplayName={userDisplayName}
      userEmail={userEmail}
      userRole={userRole}
      onOpenSidebar={onOpenSidebar}
    />
  )
}
