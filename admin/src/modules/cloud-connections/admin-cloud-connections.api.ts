import { apiFetch } from "@/lib/api"

export type AdminCloudIntegrationMode = "manual" | "automatic"
export type AdminCloudIntegrationStatus =
  | "draft"
  | "connecting"
  | "awaiting_validation"
  | "active"
  | "active_with_warnings"
  | "failed"
  | "suspended"

export type AdminCloudConnectionsListQuery = {
  page: number
  limit: number
  search?: string
  provider?: string
  mode?: AdminCloudIntegrationMode
  status?: AdminCloudIntegrationStatus
  billingSourceLinked?: "true" | "false"
  dateFrom?: string
  dateTo?: string
  sortBy?:
    | "displayName"
    | "status"
    | "mode"
    | "cloudAccountId"
    | "lastValidatedAt"
    | "connectedAt"
    | "createdAt"
    | "updatedAt"
  sortOrder?: "asc" | "desc"
}

export type AdminCloudConnectionListItem = {
  id: string
  displayName: string
  tenant: {
    id: string
    name: string
    slug: string
  }
  provider: {
    id: number
    code: string
    name: string
  }
  mode: AdminCloudIntegrationMode
  status: AdminCloudIntegrationStatus
  statusMessage: string | null
  errorMessage: string | null
  cloudAccountId: string | null
  payerAccountId: string | null
  detailRecordType: string
  detailRecordId: string
  billingSource: {
    linked: boolean
    id: number | null
    sourceType: string | null
    setupMode: string | null
    status: string | null
  }
  timestamps: {
    connectedAt: string | null
    lastValidatedAt: string | null
    lastSuccessAt: string | null
    lastCheckedAt: string | null
    createdAt: string
    updatedAt: string
  }
  latestIngestion: {
    hasData: boolean
    lastFileReceivedAt: string | null
    lastIngestedAt: string | null
    latestRunId: number | null
    latestRunStatus: string | null
  }
}

export type AdminCloudConnectionsListResponse = {
  data: AdminCloudConnectionListItem[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  summary: {
    total: number
    draft: number
    connecting: number
    awaitingValidation: number
    active: number
    activeWithWarnings: number
    failed: number
    suspended: number
    billingSourceMissing: number
  }
}

export type AutomaticConnectionDetail = {
  kind: "automatic"
  id: string
  connectionName: string
  accountType: string
  region: string | null
  externalId: string | null
  callbackToken: string | null
  stackName: string | null
  stackId: string | null
  roleArn: string | null
  cloudAccountId: string | null
  payerAccountId: string | null
  export: {
    name: string | null
    bucket: string | null
    prefix: string | null
    region: string | null
    arn: string | null
  }
  connectedAt: string | null
  lastValidatedAt: string | null
  errorMessage: string | null
  createdAt: string
  updatedAt: string
}

export type ManualConnectionDetail = {
  kind: "manual"
  id: string
  connectionName: string
  awsAccountId: string
  roleArn: string
  externalId: string
  bucketName: string
  prefix: string | null
  reportName: string | null
  validationStatus: string
  assumeRoleSuccess: boolean
  status: string
  lastValidatedAt: string | null
  errorMessage: string | null
  createdAt: string
  updatedAt: string
}

export type AdminCloudConnectionDetailData = {
  integration: {
    id: string
    displayName: string
    mode: AdminCloudIntegrationMode
    status: AdminCloudIntegrationStatus
    statusMessage: string | null
    errorMessage: string | null
    cloudAccountId: string | null
    payerAccountId: string | null
    detailRecordType: string
    detailRecordId: string
    detailRecordMissing: boolean
    timestamps: {
      connectedAt: string | null
      lastValidatedAt: string | null
      lastSuccessAt: string | null
      lastCheckedAt: string | null
      createdAt: string
      updatedAt: string
    }
  }
  tenant: {
    id: string
    name: string
    slug: string
  }
  provider: {
    id: number
    code: string
    name: string
  }
  connectionDetail: AutomaticConnectionDetail | ManualConnectionDetail | null
  billingSource: {
    linked: boolean
    id: number | null
    sourceName: string | null
    sourceType: string | null
    setupMode: string | null
    format: string | null
    schemaType: string | null
    bucketName: string | null
    pathPrefix: string | null
    filePattern: string | null
    cadence: string | null
    status: string | null
    isTemporary: boolean | null
    lastValidatedAt: string | null
    lastFileReceivedAt: string | null
    lastIngestedAt: string | null
    createdAt: string | null
    updatedAt: string | null
  }
  latestIngestion: {
    hasData: boolean
    latestRun: {
      id: number
      status: string
      currentStep: string | null
      progressPercent: number
      statusMessage: string | null
      rowsRead: number
      rowsLoaded: number
      rowsFailed: number
      startedAt: string | null
      finishedAt: string | null
      createdAt: string
      updatedAt: string
    } | null
    latestRawFile: {
      id: number
      originalFileName: string
      fileFormat: string
      status: string
      rawStorageBucket: string
      rawStorageKey: string
      createdAt: string
    } | null
  }
}

type DetailApiPayload = AdminCloudConnectionDetailData | { data: AdminCloudConnectionDetailData }

const toQueryString = (query: AdminCloudConnectionsListQuery): string => {
  const params = new URLSearchParams()
  params.set("page", String(query.page))
  params.set("limit", String(query.limit))
  if (query.search) params.set("search", query.search)
  if (query.provider) params.set("provider", query.provider)
  if (query.mode) params.set("mode", query.mode)
  if (query.status) params.set("status", query.status)
  if (query.billingSourceLinked) params.set("billingSourceLinked", query.billingSourceLinked)
  if (query.dateFrom) params.set("dateFrom", query.dateFrom)
  if (query.dateTo) params.set("dateTo", query.dateTo)
  if (query.sortBy) params.set("sortBy", query.sortBy)
  if (query.sortOrder) params.set("sortOrder", query.sortOrder)
  return params.toString()
}

export async function fetchAdminCloudConnections(
  token: string,
  query: AdminCloudConnectionsListQuery
): Promise<AdminCloudConnectionsListResponse> {
  return apiFetch<AdminCloudConnectionsListResponse>(`/admin/cloud-connections?${toQueryString(query)}`, {
    method: "GET",
    token,
  })
}

export async function fetchAdminCloudConnectionByIntegrationId(
  token: string,
  integrationId: string
): Promise<AdminCloudConnectionDetailData> {
  const payload = await apiFetch<DetailApiPayload>(`/admin/cloud-connections/${integrationId}`, {
    method: "GET",
    token,
  })

  if (payload && typeof payload === "object" && "integration" in payload) {
    return payload as AdminCloudConnectionDetailData
  }

  return payload.data
}
