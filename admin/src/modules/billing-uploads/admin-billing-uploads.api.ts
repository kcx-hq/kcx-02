import { apiFetch } from "@/lib/api"

export type BillingUploadNormalizedStatus = "queued" | "processing" | "completed" | "warning" | "failed"

export type BillingUploadsListQuery = {
  page: number
  limit: number
  search?: string
  status?: BillingUploadNormalizedStatus
  sourceType?: string
  dateFrom?: string
  dateTo?: string
}

export type BillingUploadsListRow = {
  runId: number
  client: {
    id: string
    name: string
  }
  source: {
    type: string
    label: string
  }
  file: {
    name: string
    format: string
  }
  status: {
    raw: string
    normalized: BillingUploadNormalizedStatus
    label: string
  }
  progress: {
    percent: number
  }
  startedAt: string | null
  finishedAt: string | null
  hasErrors: boolean
}

export type BillingUploadsListResponse = {
  data: BillingUploadsListRow[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  filters: {
    status: string | null
    sourceType: string | null
    clientId: string | null
    search: string | null
  }
  sort: {
    sortBy: string
    sortOrder: "asc" | "desc"
  }
}

export type BillingUploadDetailsResponse = {
  runOverview: {
    runId: number
    status: {
      raw: string
      normalized: BillingUploadNormalizedStatus
      label: string
    }
    currentStep: string | null
    progressPercent: number
    statusMessage: string | null
    startedAt: string | null
    finishedAt: string | null
    createdAt: string
    updatedAt: string
    lastHeartbeatAt: string | null
  }
  client: {
    id: string
    name: string
  }
  sourceContext: {
    billingSourceId: number
    sourceName: string
    sourceType: string
    setupMode: string
    isTemporary: boolean
    sourceStatus: string
    cloudProvider: {
      id: number
      code: string
      name: string
    }
    cloudConnectionId: string | null
  }
  fileContext: {
    rawBillingFileId: number
    originalFileName: string
    originalFilePath: string | null
    fileFormat: string
    fileSizeBytes: number | null
    checksum: string | null
    uploadedAt: string
    uploadedBy: {
      id: string
      fullName: string
      email: string
    } | null
  }
  rawStorageContext: {
    bucket: string
    key: string
    status: string
    persistedToRawStorage: boolean
  }
  processingMetrics: {
    rowsRead: number
    rowsLoaded: number
    rowsFailed: number
    totalRowsEstimated: number | null
  }
  failureDetails: {
    errorMessage: string | null
    rowErrorCount: number
    sampleRowErrors: Array<{
      id: number
      rowNumber: number | null
      errorCode: string | null
      errorMessage: string
      createdAt: string
    }>
  }
  relatedFiles: Array<{
    rawBillingFileId: number
    fileRole: string
    processingOrder: number
    originalFileName: string
    fileFormat: string
    status: string
  }>
}

const toQueryString = (query: BillingUploadsListQuery): string => {
  const params = new URLSearchParams()
  params.set("page", String(query.page))
  params.set("limit", String(query.limit))
  if (query.search) params.set("search", query.search)
  if (query.status) params.set("status", query.status)
  if (query.sourceType) params.set("sourceType", query.sourceType)
  if (query.dateFrom) params.set("dateFrom", query.dateFrom)
  if (query.dateTo) params.set("dateTo", query.dateTo)
  return params.toString()
}

export async function fetchAdminBillingUploads(
  token: string,
  query: BillingUploadsListQuery
): Promise<BillingUploadsListResponse> {
  return apiFetch<BillingUploadsListResponse>(`/admin/billing-uploads?${toQueryString(query)}`, { method: "GET", token })
}

export async function fetchAdminBillingUploadByRunId(
  token: string,
  runId: number
): Promise<BillingUploadDetailsResponse> {
  return apiFetch<BillingUploadDetailsResponse>(`/admin/billing-uploads/${runId}`, { method: "GET", token })
}
