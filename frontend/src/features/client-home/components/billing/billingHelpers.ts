import type {
  CloudIntegrationListItem,
  CloudIntegrationStatus,
} from "@/features/client-home/api/cloud-integrations.api"

export const ADD_CONNECTION_PROVIDERS = [
  {
    name: "AWS",
    icon: "/aws.svg",
    availability: "Available",
    description: "Connect AWS billing for cost ingestion.",
    href: "/client/billing/connect-cloud/aws",
  },
  {
    name: "Azure",
    icon: "/azure.svg",
    availability: "Beta",
    description: "Azure billing integration is currently in beta.",
    href: "/client/billing/connect-cloud/azure",
  },
  {
    name: "GCP",
    icon: "/gcp.svg",
    availability: "Planned",
    description: "GCP billing integration will be available soon.",
    href: "/client/billing/connect-cloud/gcp",
  },
  {
    name: "Oracle Cloud",
    icon: "/oracle.svg",
    availability: "Planned",
    description: "Oracle billing integration will be available soon.",
    href: "/client/billing/connect-cloud/oracle-cloud",
  },
] as const

export function isCloudConnectionsRoute(path: string) {
  return path.startsWith("/client/billing/connect-cloud") || path.startsWith("/client/billing/connections")
}

export const AWS_SETUP_ROUTE_REGEX = /^\/client\/billing\/(?:connect-cloud|connections)\/aws\/setup\/([0-9a-fA-F-]{36})$/
export const CLOUD_PROVIDER_ROUTE_REGEX = /^\/client\/billing\/(?:connect-cloud|connections)\/(aws|azure|gcp|oracle-cloud)(?:\/|$)/
export const CLOUD_SETUP_METHOD_ROUTE_REGEX = /^\/client\/billing\/(?:connect-cloud|connections)\/(?:aws|azure|gcp|oracle-cloud)\/(automatic|manual)(?:\/|$)/
export const AWS_MANUAL_SUCCESS_ROUTE_REGEX = /^\/client\/billing\/(?:connect-cloud|connections)\/aws\/manual\/success(?:\/|$)/

export const CLOUD_PROVIDER_LABELS: Record<string, string> = {
  aws: "AWS",
  azure: "Azure",
  gcp: "GCP",
  "oracle-cloud": "Oracle Cloud",
}

export type CloudConnection = {
  id: string
  connection_name: string
  provider: string
  status: string
  account_type: string
}

export const ACTIVE_INGESTION_STORAGE_KEY = "kcx.activeBillingIngestionRunId"

export type CloudIntegrationOverviewRow = {
  id: string
  connectionName: string
  provider: string
  cloudAccountId: string | null
  lastChecked: string
  lastSuccess: string
  statusLabel: "NOT AVAILABLE" | "CONNECTING" | "PENDING" | "HEALTHY" | "WARNING" | "FAILED" | "SUSPENDED"
}

export function normalizeUploadStatusLabel(
  value: string | null | undefined,
): "Idle" | "Queued" | "Processing" | "Completed" | "Warning" | "Failed" {
  if (!value) return "Idle"
  if (value === "queued") return "Queued"
  if (value === "completed") return "Completed"
  if (value === "completed_with_warnings" || value === "warning") return "Warning"
  if (value === "failed") return "Failed"
  return "Processing"
}

function formatCloudIntegrationLastChecked(row: CloudIntegrationListItem) {
  const candidate = row.last_checked_at ?? row.last_validated_at ?? row.updated_at ?? row.created_at

  if (!candidate) return "-"

  const date = new Date(candidate)
  if (Number.isNaN(date.getTime())) return "-"

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function mapCloudIntegrationStatusLabel(status: CloudIntegrationStatus): CloudIntegrationOverviewRow["statusLabel"] {
  if (status === "draft") return "NOT AVAILABLE"
  if (status === "connecting") return "CONNECTING"
  if (status === "awaiting_validation") return "PENDING"
  if (status === "active") return "HEALTHY"
  if (status === "active_with_warnings") return "WARNING"
  if (status === "failed") return "FAILED"
  return "SUSPENDED"
}

function formatCloudIntegrationLastSuccess(row: CloudIntegrationListItem) {
  if (!row.last_success_at) return "-"
  const date = new Date(row.last_success_at)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function mapCloudIntegrationOverviewRow(row: CloudIntegrationListItem): CloudIntegrationOverviewRow {
  const providerLabel = row.provider?.name?.trim() || row.provider?.code?.toUpperCase() || "Unknown"

  return {
    id: row.id,
    connectionName: row.display_name,
    provider: providerLabel,
    cloudAccountId: row.cloud_account_id,
    lastChecked: formatCloudIntegrationLastChecked(row),
    lastSuccess: formatCloudIntegrationLastSuccess(row),
    statusLabel: mapCloudIntegrationStatusLabel(row.status),
  }
}
