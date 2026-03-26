import { ShieldCheck, UserPlus, Users } from "lucide-react"

import { ClientPageHeader } from "@/features/client-home/components/ClientPageHeader"
import { ClientPlaceholderCard } from "@/features/client-home/components/ClientPlaceholderCard"

export function ClientUsersPage() {
  return (
    <>
      <ClientPageHeader
        eyebrow="Users Workspace"
        title="Users"
        description="Manage team membership, access roles, and invitation workflows."
      />

      <section aria-label="User management placeholders" className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <ClientPlaceholderCard
          title="Team Members"
          description="View and manage users with workspace access."
          icon={<Users className="h-4 w-4" />}
        />
        <ClientPlaceholderCard
          title="Roles"
          description="Define permissions for finance, engineering, and operations teams."
          icon={<ShieldCheck className="h-4 w-4" />}
        />
        <ClientPlaceholderCard
          title="Invitations"
          description="Invite new collaborators and track pending access approvals."
          icon={<UserPlus className="h-4 w-4" />}
        />
      </section>
    </>
  )
}
