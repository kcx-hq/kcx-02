import type {
  AdminCloudConnectionListItem,
  AdminCloudIntegrationMode,
  AdminCloudIntegrationStatus,
} from "@/modules/cloud-connections/admin-cloud-connections.api"

export type CloudConnectionStatusBadge = {
  variant: "outline" | "subtle" | "warning"
  className?: string
}

export function formatDateTime(value: string | null): string {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date)
}

export function formatCompactDateTime(value: string | null): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")

  return `${year}-${month}-${day} ${hours}:${minutes}`
}

export function formatCloudAccountId(value: string | null): string {
  if (!value) return "-"
  const normalized = String(value).trim()
  if (!normalized) return "-"

  // AWS account IDs are typically 12 digits; render as 4-4-4 for better scanability.
  if (/^\d{12}$/.test(normalized)) {
    return `${normalized.slice(0, 4)}-${normalized.slice(4, 8)}-${normalized.slice(8, 12)}`
  }

  return normalized
}

export function formatValue(value: string | number | boolean | null | undefined): string {
  if (value === null || typeof value === "undefined" || value === "") return "-"
  return String(value)
}

export function formatBoolean(value: boolean | null | undefined): string {
  if (value === null || typeof value === "undefined") return "-"
  return value ? "Yes" : "No"
}

export function formatModeLabel(mode: AdminCloudIntegrationMode): string {
  return mode === "manual" ? "Manual" : "Automatic"
}

export function formatStatusLabel(status: AdminCloudIntegrationStatus): string {
  if (status === "awaiting_validation") return "Awaiting Validation"
  if (status === "active_with_warnings") return "Active With Warnings"
  if (status === "draft") return "Draft"
  if (status === "connecting") return "Connecting"
  if (status === "active") return "Active"
  if (status === "failed") return "Failed"
  return "Suspended"
}

export function getStatusBadge(status: AdminCloudIntegrationStatus): CloudConnectionStatusBadge {
  if (status === "active") return { variant: "subtle" }
  if (status === "active_with_warnings" || status === "awaiting_validation" || status === "connecting") {
    return {
      variant: "warning",
    }
  }
  if (status === "failed") {
    return {
      variant: "outline",
      className: "border-[color:rgba(220,38,38,0.28)] bg-[color:rgba(220,38,38,0.10)] text-[color:rgba(153,27,27,0.95)]",
    }
  }
  if (status === "suspended") {
    return {
      variant: "outline",
      className: "border-[color:rgba(100,116,139,0.28)] bg-[color:rgba(100,116,139,0.10)] text-[color:rgba(51,65,85,0.95)]",
    }
  }
  return { variant: "outline" }
}

export function getLastActivity(item: AdminCloudConnectionListItem): string | null {
  return (
    item.latestIngestion.lastIngestedAt ||
    item.latestIngestion.lastFileReceivedAt ||
    item.timestamps.lastCheckedAt ||
    item.timestamps.updatedAt ||
    null
  )
}
