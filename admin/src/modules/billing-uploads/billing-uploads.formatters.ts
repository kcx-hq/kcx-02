import type { BillingUploadNormalizedStatus } from "@/modules/billing-uploads/admin-billing-uploads.api"

export type BillingUploadStatusBadge = {
  variant: "outline" | "subtle" | "warning"
  className?: string
}

export function formatDateTime(value: string | null): string {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date)
}

export function formatValue(value: string | number | null | undefined): string {
  if (value === null || typeof value === "undefined" || value === "") return "-"
  return String(value)
}

export function formatBoolean(value: boolean): string {
  return value ? "Yes" : "No"
}

export function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes < 0) return "-"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export function getStatusBadge(status: BillingUploadNormalizedStatus): BillingUploadStatusBadge {
  if (status === "completed") return { variant: "subtle" }
  if (status === "warning") return { variant: "warning" }
  if (status === "processing") {
    return {
      variant: "outline",
      className: "border-[color:rgba(37,99,235,0.28)] bg-[color:rgba(37,99,235,0.10)] text-[color:rgba(30,64,175,0.95)]",
    }
  }
  if (status === "failed") {
    return {
      variant: "outline",
      className: "border-[color:rgba(220,38,38,0.28)] bg-[color:rgba(220,38,38,0.10)] text-[color:rgba(153,27,27,0.95)]",
    }
  }
  return { variant: "outline" }
}
