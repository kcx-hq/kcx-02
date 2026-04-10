import type { AdminAnnouncement, AnnouncementStatus } from "@/modules/announcements/admin-announcements.api"
import type { AdminClientSummary } from "@/modules/clients/admin-clients.api"

export const STATUS_OPTIONS: AnnouncementStatus[] = ["DRAFT", "PUBLISHED", "ARCHIVED"]

export function toLocalInputValue(iso?: string | null): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const offsetMs = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

export function toIsoValue(localValue: string): string | null {
  if (!localValue) return null
  const date = new Date(localValue)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return "-"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "-"
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date)
}

export function statusVariant(status: AnnouncementStatus) {
  if (status === "PUBLISHED") return "subtle" as const
  if (status === "ARCHIVED") return "warning" as const
  return "outline" as const
}

export function toClientLabel(client: AdminClientSummary): string {
  const fullName = `${client.firstName} ${client.lastName}`.trim()
  return fullName.length > 0 ? fullName : client.email
}

export function audienceText(item: AdminAnnouncement): string {
  if (item.audience_scope === "ALL") return "All clients"
  if (item.audience_scope === "CLIENT_TIER") return `${item.audience_tier ?? "Tier"} clients`
  return `${item.audience_client_ids?.length ?? 0} selected`
}
