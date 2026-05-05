import { apiGet } from "@/lib/api"

export type InventoryEc2SnapshotSignal = "old" | "orphaned" | "normal" | null
export type InventoryEc2SnapshotStatus = "old" | "orphaned" | "normal" | null

export type InventoryEc2SnapshotRow = {
  snapshotId: string
  sourceVolumeId: string | null
  sourceInstanceId: string | null
  accountId: string
  accountName: string | null
  region: string
  state: string
  storageTier: string
  ageDays: number | null
  status: InventoryEc2SnapshotStatus
  statusLabel: string | null
  signals: Array<Exclude<InventoryEc2SnapshotStatus, null | "normal">>
  volumeStatus: "missing" | "deleted" | "unavailable" | "available" | null
  signal: InventoryEc2SnapshotSignal
  cost: number | null
  recommendation: string | null
  estimatedSavings: number | null
}

export type InventoryEc2SnapshotsSummary = {
  totalSnapshotCost: number | null
  totalSnapshots: number
  oldSnapshots: number
  potentialSavings: number | null
}

export type InventoryEc2SnapshotsPagination = {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export type InventoryEc2SnapshotsListResponse = {
  rows: InventoryEc2SnapshotRow[]
  summary: InventoryEc2SnapshotsSummary
  pagination: InventoryEc2SnapshotsPagination
}

export type InventoryEc2SnapshotsListParams = {
  cloudConnectionId?: string | null
  regionKey?: string | null
  volumeId?: string | null
  state?: string | null
  status?: Exclude<InventoryEc2SnapshotStatus, null> | null
  storageTier?: string | null
  encrypted?: boolean | null
  search?: string | null
  page?: number
  pageSize?: number
}

type UnknownRecord = Record<string, unknown>

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null

const toStringOrNull = (value: unknown): string | null => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const toNumberOrNull = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const toSignal = (value: unknown): InventoryEc2SnapshotSignal => {
  const normalized = toStringOrNull(value)
  if (normalized === "old" || normalized === "orphaned" || normalized === "normal") {
    return normalized
  }
  return null
}

const toSignals = (
  value: unknown,
): Array<Exclude<InventoryEc2SnapshotStatus, null | "normal">> => {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().toLowerCase())
    .filter(
      (item): item is Exclude<InventoryEc2SnapshotStatus, null | "normal"> =>
        item === "old" || item === "orphaned",
    )
}

const toVolumeStatus = (
  value: unknown,
): InventoryEc2SnapshotRow["volumeStatus"] => {
  const normalized = toStringOrNull(value)?.toLowerCase()
  if (
    normalized === "missing" ||
    normalized === "deleted" ||
    normalized === "unavailable" ||
    normalized === "available"
  ) {
    return normalized
  }
  return null
}

const normalizeSnapshotRow = (value: unknown): InventoryEc2SnapshotRow | null => {
  if (!isRecord(value)) return null

  const snapshotId = toStringOrNull(value.snapshotId)
  if (!snapshotId) return null

  const signal = toSignal(value.signal)
  const status = toSignal(value.status)

  return {
    snapshotId,
    sourceVolumeId: toStringOrNull(value.sourceVolumeId),
    sourceInstanceId: toStringOrNull(value.sourceInstanceId),
    accountId: toStringOrNull(value.accountId) ?? "",
    accountName: toStringOrNull(value.accountName),
    region: toStringOrNull(value.region) ?? "",
    state: toStringOrNull(value.state) ?? "",
    storageTier: toStringOrNull(value.storageTier) ?? "",
    ageDays: toNumberOrNull(value.ageDays),
    status,
    statusLabel: toStringOrNull(value.statusLabel),
    signals: toSignals(value.signals),
    volumeStatus: toVolumeStatus(value.volumeStatus),
    signal,
    cost: toNumberOrNull(value.cost),
    recommendation: toStringOrNull(value.recommendation),
    estimatedSavings: toNumberOrNull(value.estimatedSavings),
  }
}

const normalizePagination = (
  value: unknown,
  fallbackPage: number,
  fallbackPageSize: number,
): InventoryEc2SnapshotsPagination => {
  if (!isRecord(value)) {
    return {
      page: fallbackPage,
      pageSize: fallbackPageSize,
      total: 0,
      totalPages: 0,
    }
  }

  const page = toNumberOrNull(value.page) ?? fallbackPage
  const pageSize = toNumberOrNull(value.pageSize) ?? fallbackPageSize
  const total = toNumberOrNull(value.total) ?? 0
  const totalPages = toNumberOrNull(value.totalPages) ?? (total > 0 ? Math.ceil(total / pageSize) : 0)

  return {
    page,
    pageSize,
    total,
    totalPages,
  }
}

const normalizeSummary = (value: unknown): InventoryEc2SnapshotsSummary => {
  if (!isRecord(value)) {
    return {
      totalSnapshotCost: null,
      totalSnapshots: 0,
      oldSnapshots: 0,
      potentialSavings: null,
    }
  }

  return {
    totalSnapshotCost: toNumberOrNull(value.totalSnapshotCost),
    totalSnapshots: toNumberOrNull(value.totalSnapshots) ?? 0,
    oldSnapshots: toNumberOrNull(value.oldSnapshots) ?? 0,
    potentialSavings: toNumberOrNull(value.potentialSavings),
  }
}

const extractItemsArray = (value: unknown): unknown[] => {
  if (!isRecord(value)) return []
  if (Array.isArray(value.items)) return value.items
  if (Array.isArray(value.snapshots)) return value.snapshots
  if (Array.isArray(value.rows)) return value.rows

  // TODO(inventory-frontend): remove this fallback once backend response shape is fully frozen.
  if (isRecord(value.data) && Array.isArray(value.data.items)) return value.data.items
  if (isRecord(value.data) && Array.isArray(value.data.rows)) return value.data.rows
  return []
}

export async function getInventoryEc2Snapshots(
  params: InventoryEc2SnapshotsListParams = {},
): Promise<InventoryEc2SnapshotsListResponse> {
  const page = typeof params.page === "number" && Number.isFinite(params.page) ? Math.max(1, params.page) : 1
  const pageSize =
    typeof params.pageSize === "number" && Number.isFinite(params.pageSize)
      ? Math.min(100, Math.max(1, params.pageSize))
      : 25

  const searchParams = new URLSearchParams()
  searchParams.set("page", String(page))
  searchParams.set("pageSize", String(pageSize))

  if (params.cloudConnectionId) searchParams.set("cloudConnectionId", params.cloudConnectionId)
  if (params.regionKey) searchParams.set("regionKey", params.regionKey)
  if (params.volumeId) searchParams.set("volumeId", params.volumeId)
  if (params.state) searchParams.set("state", params.state)
  if (params.status) searchParams.set("status", params.status)
  if (params.storageTier) searchParams.set("storageTier", params.storageTier)
  if (typeof params.encrypted === "boolean") searchParams.set("encrypted", String(params.encrypted))
  if (params.search) searchParams.set("search", params.search)

  const path = `/inventory/aws/ec2/snapshots?${searchParams.toString()}`
  const response = await apiGet<unknown>(path)

  const rawItems = extractItemsArray(response)
  const items = rawItems
    .map((item) => normalizeSnapshotRow(item))
    .filter((item): item is InventoryEc2SnapshotRow => item !== null)

  const responseRecord = isRecord(response) ? response : null
  const responseDataRecord = responseRecord && isRecord(responseRecord.data) ? responseRecord.data : null
  const paginationSource = responseRecord?.pagination ?? responseDataRecord?.pagination ?? null
  const summarySource = responseRecord?.summary ?? responseDataRecord?.summary ?? null

  return {
    rows: items,
    pagination: normalizePagination(paginationSource, page, pageSize),
    summary: normalizeSummary(summarySource),
  }
}
