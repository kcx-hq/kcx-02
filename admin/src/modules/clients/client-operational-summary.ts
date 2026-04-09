import type { AdminClientV1 } from "@/modules/clients/admin-clients.api"

export type ClientOperationalState =
  | "Operational"
  | "Not Setup"
  | "Partial"
  | "No Data Flow"
  | "Needs Attention"
  | "Inactive"

export type ClientOperationalSummary = {
  state: ClientOperationalState
  primaryReason: string
  recommendedAction: string
  cloudStatus: string
  setupType: "Automatic" | "Manual" | "Not Available"
  dataStatus: "Active" | "No Data Yet" | "Failed" | "Not Available"
  latestRun: "Success" | "Failed" | "Pending" | "Not Available"
  latestFile: string | null
  cloudAccountId: string | null
  totalFiles: number
  uploadedFiles: number
  processedFiles: number
  ingestedFiles: number
  lastActivity: string
  issues: Array<{
    problemArea: "Cloud" | "Billing Source" | "File Intake" | "Parsing" | "Ingestion" | "No Activity"
    errorSummary: string
    failedRows: number | null
    lastFailureTime: string | null
  }>
}

const ATTENTION_STATUSES = new Set(["failed", "suspended", "active_with_warnings"])
const SETUP_IN_PROGRESS_STATUSES = new Set(["draft", "connecting", "awaiting_validation"])
const RUN_SUCCESS_STATUSES = new Set(["completed", "success", "succeeded"])
const RUN_FAILED_STATUSES = new Set(["failed", "error"])

function normalizeProviderName(value: string | null | undefined): string | null {
  if (!value) return null
  const normalized = value.trim()
  if (!normalized) return null
  if (normalized.toLowerCase() === "amazon web services") return "AWS"
  return normalized
}

function buildCloudStatusLabel(client: AdminClientV1, provider: string | null): string {
  const cloudExists = Boolean(client.platformContext?.cloudConnection.exists)
  const status = (client.platformContext?.cloudConnection.status ?? "").toLowerCase()
  if (!cloudExists) return "Not Connected"
  if (ATTENTION_STATUSES.has(status)) return "Connection Error"
  if (provider) return `${provider} Connected`
  return "Connected"
}

export function deriveClientOperationalSummary(client: AdminClientV1): ClientOperationalSummary {
  const clientInactive = String(client.status).toLowerCase() === "inactive"
  const cloudExists = Boolean(client.platformContext?.cloudConnection.exists)
  const connectionStatus = (client.platformContext?.cloudConnection.status ?? "").toLowerCase()
  const provider = normalizeProviderName(client.platformContext?.cloudConnection.providerName)
  const setupTypeRaw = (client.platformContext?.cloudConnection.setupType ?? "").toLowerCase()
  const billingSourceExists = Boolean(client.platformContext?.billing.sourceExists)
  const hasLastIngested = Boolean(client.platformContext?.billing.lastIngestedAt)
  const hasLastUpload = Boolean(client.platformContext?.billing.lastUploadAt)
  const hasDataSignal = Boolean(client.platformContext?.billing.dataExists) || hasLastIngested || hasLastUpload
  const latestRunStatusRaw = (client.platformContext?.billing.latestRunStatus ?? "").toLowerCase()
  const latestRunAttemptAt = client.platformContext?.billing.latestRunAt ?? null
  const latestRunFailed = RUN_FAILED_STATUSES.has(latestRunStatusRaw)
  const latestRunSucceeded = RUN_SUCCESS_STATUSES.has(latestRunStatusRaw)

  const setupType: ClientOperationalSummary["setupType"] =
    setupTypeRaw === "automatic" ? "Automatic" : setupTypeRaw === "manual" ? "Manual" : "Not Available"

  const latestRun: ClientOperationalSummary["latestRun"] =
    latestRunFailed ? "Failed" : latestRunSucceeded ? "Success" : latestRunStatusRaw ? "Pending" : "Not Available"
  const totalFiles = client.platformContext?.billing.totalFiles ?? 0
  const totalFilesUploaded = client.platformContext?.billing.totalFilesUploaded ?? 0
  const totalFilesProcessed = client.platformContext?.billing.totalFilesProcessed ?? 0
  const totalFilesIngested = client.platformContext?.billing.totalFilesIngested ?? 0

  let dataStatus: ClientOperationalSummary["dataStatus"] = "Not Available"
  if (latestRunFailed || ATTENTION_STATUSES.has(connectionStatus)) {
    dataStatus = "Failed"
  } else if (hasLastIngested || latestRunSucceeded || client.platformContext?.billing.dataExists) {
    dataStatus = "Active"
  } else if (cloudExists && billingSourceExists) {
    dataStatus = "No Data Yet"
  }

  let state: ClientOperationalState
  let primaryReason: string
  let recommendedAction: string

  if (clientInactive) {
    state = "Inactive"
    primaryReason = "Client account is marked inactive."
    recommendedAction = "Activate account only if access should be restored."
  } else if (!cloudExists) {
    state = "Not Setup"
    primaryReason = "No cloud connection has been configured."
    recommendedAction = "Complete cloud setup."
  } else if (latestRunFailed || ATTENTION_STATUSES.has(connectionStatus)) {
    state = "Needs Attention"
    primaryReason = latestRunFailed ? "Latest ingestion failed." : "Cloud connection indicates an error state."
    recommendedAction = latestRunFailed ? "Review ingestion failure." : "Review cloud connection health."
  } else if (!hasLastIngested && !latestRunSucceeded) {
    if (!billingSourceExists || SETUP_IN_PROGRESS_STATUSES.has(connectionStatus)) {
      state = "Partial"
      primaryReason = "Cloud exists, but setup is incomplete."
      recommendedAction = "Complete billing linkage and ingestion setup."
    } else if (!hasDataSignal) {
      state = "No Data Flow"
      primaryReason = "Cloud is connected, but data flow is not active."
      recommendedAction = "Verify billing source and ingestion pipeline."
    } else {
      state = "Partial"
      primaryReason = "Cloud setup exists, but successful ingestion is not available yet."
      recommendedAction = "Trigger and verify the first successful ingestion."
    }
  } else {
    state = "Operational"
    primaryReason = "Cloud connected and billing ingestion is working."
    recommendedAction = "No action needed."
  }

  const lastSuccessfulIngestion = client.platformContext?.billing.lastIngestedAt ?? null
  const lastFileReceived = client.platformContext?.billing.lastUploadAt ?? null
  const cloudValidatedAt = client.platformContext?.cloudConnection.lastValidatedAt ?? null
  const lastActivity =
    lastSuccessfulIngestion ??
    latestRunAttemptAt ??
    lastFileReceived ??
    cloudValidatedAt ??
    client.createdAt

  const issues: ClientOperationalSummary["issues"] = []
  if (!cloudExists) {
    issues.push({
      problemArea: "Cloud",
      errorSummary: "Cloud connection not configured",
      failedRows: null,
      lastFailureTime: null,
    })
  }
  if (ATTENTION_STATUSES.has(connectionStatus)) {
    issues.push({
      problemArea: "Cloud",
      errorSummary: "Cloud connection is in an error or warning state",
      failedRows: null,
      lastFailureTime: cloudValidatedAt,
    })
  }
  if (latestRunFailed) {
    issues.push({
      problemArea: "Ingestion",
      errorSummary: client.platformContext?.billing.latestRunErrorSummary ?? "Latest ingestion run failed",
      failedRows: client.platformContext?.billing.latestRunFailedRows ?? null,
      lastFailureTime: latestRunAttemptAt,
    })
  }
  if (cloudExists && billingSourceExists && !hasDataSignal && !latestRunFailed) {
    issues.push({
      problemArea: "No Activity",
      errorSummary: "No data received or ingested recently",
      failedRows: null,
      lastFailureTime: null,
    })
  }

  return {
    state,
    primaryReason,
    recommendedAction,
    cloudStatus: buildCloudStatusLabel(client, provider),
    setupType,
    dataStatus,
    latestRun,
    latestFile: client.platformContext?.billing.latestFileName ?? null,
    cloudAccountId: client.platformContext?.cloudConnection.cloudAccountId ?? null,
    totalFiles,
    uploadedFiles: totalFilesUploaded,
    processedFiles: totalFilesProcessed,
    ingestedFiles: totalFilesIngested,
    lastActivity,
    issues: issues.slice(0, 3),
  }
}
