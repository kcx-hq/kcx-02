import type { ComponentType } from "react"
import { AnnouncementIcon, BillingUploadsIcon, MeetingIcon, TicketIcon, UserIcon } from "@/components/ui/icons"

export type AdminNavItem = {
  label: string
  to: string
  Icon: ComponentType<{ className?: string }>
  description: string
}

export const ADMIN_NAV: AdminNavItem[] = [
  {
    label: "User",
    to: "/user",
    Icon: UserIcon,
    description: "Access, roles, onboarding",
  },
  {
    label: "Ticket Management",
    to: "/ticket-management",
    Icon: TicketIcon,
    description: "Triage, assign, resolve",
  },
  {
    label: "Meeting",
    to: "/meeting",
    Icon: MeetingIcon,
    description: "Schedule, prep, follow-up",
  },
  {
    label: "Announcement",
    to: "/announcement",
    Icon: AnnouncementIcon,
    description: "Draft, publish, audit",
  },
  {
    label: "Billing Uploads",
    to: "/billing-uploads",
    Icon: BillingUploadsIcon,
    description: "Upload, validate, reconcile",
  },
]

