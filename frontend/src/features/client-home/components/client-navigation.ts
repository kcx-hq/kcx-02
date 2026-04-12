import { Banknote, Building2, Headset, PlaySquare, type LucideIcon } from "lucide-react"

export type ClientSidebarSubmenuItem = {
  label: string
  href: string
  activeMatches: string[]
}

export type ClientSidebarMenuItem = {
  id: string
  label: string
  href: string
  icon: LucideIcon
  activeMatches: string[]
  submenu?: ClientSidebarSubmenuItem[]
}

export const CLIENT_SIDEBAR_MENU: ClientSidebarMenuItem[] = [
  {
    id: "billing",
    label: "Billing",
    href: "/client/billing",
    icon: Banknote,
    activeMatches: ["/client/billing"],
    submenu: [
      {
        label: "Cloud Integration",
        href: "/client/billing/cloud-integration",
        activeMatches: ["/client/billing/connect-cloud", "/client/billing/connections", "/client/billing/cloud-integration"],
      },
      {
        label: "Upload Files",
        href: "/client/billing/uploads",
        activeMatches: ["/client/billing/uploads", "/client/billing/upload-files"],
      },
    ],
  },
  {
    id: "actions",
    label: "Actions",
    href: "/client/actions",
    icon: PlaySquare,
    activeMatches: ["/client/actions"],
  },
  {
    id: "support",
    label: "Support",
    href: "/client/support/ticket-management",
    icon: Headset,
    activeMatches: ["/client/support"],
    submenu: [
      {
        label: "Ticket Management",
        href: "/client/support/ticket-management",
        activeMatches: ["/client/support", "/client/support/tickets", "/client/support/ticket-management"],
      },
      {
        label: "Meetings",
        href: "/client/support/meetings",
        activeMatches: ["/client/support/schedule-call", "/client/support/meetings"],
      },
    ],
  },
  {
    id: "organization-management",
    label: "Organization Management",
    href: "/client/organization/users-roles",
    icon: Building2,
    activeMatches: ["/client/users", "/client/organization"],
    submenu: [
      {
        label: "Users & Roles",
        href: "/client/organization/users-roles",
        activeMatches: ["/client/users", "/client/organization/users-roles"],
      },
    ],
  },
]

export function routeMatches(route: string, patterns: string[]) {
  return patterns.some((pattern) => route === pattern || route.startsWith(`${pattern}/`))
}

export const CLIENT_BREADCRUMB_ROOT = "Client Home"

export function getClientBreadcrumbLabel(route: string) {
  if (route === "/client/overview") return "Overview"
  if (route === "/client/profile") return "Profile"
  if (route === "/client/billing") return "Billing / Ingestion"
  if (routeMatches(route, ["/client/support", "/client/support/tickets", "/client/support/ticket-management"])) {
    return "Support / Ticket Management"
  }
  if (routeMatches(route, ["/client/support/schedule-call", "/client/support/meetings"])) {
    return "Support / Meeting"
  }
  if (routeMatches(route, ["/client/support/live-chat"])) {
    return "Support / Live Chat"
  }

  for (const item of CLIENT_SIDEBAR_MENU) {
    const submenuMatch = item.submenu?.find((submenu) => routeMatches(route, submenu.activeMatches))
    if (submenuMatch) return submenuMatch.label
    if (routeMatches(route, item.activeMatches)) return item.label
  }

  return "Overview"
}
