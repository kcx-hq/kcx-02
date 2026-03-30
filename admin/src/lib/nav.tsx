import type { ComponentType } from "react"
import {
  AnnouncementIcon,
  BillingUploadsIcon,
  ClientManagementIcon,
  CloudConnectionsIcon,
  MeetingIcon,
  TicketIcon,
  UserIcon,
} from "@/components/ui/icons"

export type AdminNavItem = {
  label: string
  to: string
  Icon: ComponentType<{ className?: string }>
  description: string
}

export const ADMIN_NAV: AdminNavItem[] = [
  {
    label: "Client Management",
    to: "/clients",
    Icon: ClientManagementIcon,
    description: "Accounts, status, notes",
  },
  {
    label: "Cloud Connections",
    to: "/cloud-connections",
    Icon: CloudConnectionsIcon,
    description: "AWS, Azure, GCP links",
  },
  {
    label: "Meetings & Demos",
    to: "/scheduled-meeting",
    Icon: MeetingIcon,
    description: "Schedule, prep, follow-up",
  },
  {
    label: "Billing Uploads",
    to: "/billing-uploads",
    Icon: BillingUploadsIcon,
    description: "Upload, validate, reconcile",
  },
  {
    label: "Users & Roles",
    to: "/user",
    Icon: UserIcon,
    description: "Access, roles, onboarding",
  },
  {
    label: "Announcements",
    to: "/announcement",
    Icon: AnnouncementIcon,
    description: "Draft, publish, audit",
  },
  {
    label: "Issue Management",
    to: "/issue-management",
    Icon: TicketIcon,
    description: "Triage, assign, resolve",
  },
]
