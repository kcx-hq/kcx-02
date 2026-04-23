import { apiGet } from "@/lib/api"

export type InventoryEc2SnapshotSignal = "Orphaned" | "Old" | "Normal"

export type InventoryEc2SnapshotRow = {
  snapshotId: string
  sourceVolumeId: string | null
  sourceVolumeName: string | null
  sourceInstanceId: string | null
  sourceInstanceName: string | null
  state: string | null
  storageTier: string | null
  encrypted: boolean | null
  kmsKeyId: string | null
  progress: string | null
  startTime: string | null
  ageDays: number | null
  likelyOrphaned: boolean
  signal: InventoryEc2SnapshotSignal
  cost: number | null
  currencyCode: string | null
  regionKey: string | null
  subAccountKey: string | null
  tags: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
}

export type InventoryEc2SnapshotsSummary = {
  snapshotsInView: number
  likelyOrphanedCount: number
  oldSnapshotsCount: number
  totalSnapshotCost: number | null
}

export type InventoryEc2SnapshotsPagination = {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export type InventoryEc2SnapshotsListResponse = {
  items: InventoryEc2SnapshotRow[]
  summary: InventoryEc2SnapshotsSummary
  pagination: InventoryEc2SnapshotsPagination
}

export type InventoryEc2SnapshotsListParams = {
  cloudConnectionId?: string | null
  regionKey?: string | null
  state?: string | null
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

const toBooleanOrNull = (value: unknown): boolean | null => {
  return typeof value === "boolean" ? value : null
}

const toObjectOrNull = (value: unknown): Record<string, unknown> | null => {
  if (!isRecord(value)) return null
  return value
}

const toSignal = (value: unknown): InventoryEc2SnapshotSignal => {
  const normalized = toStringOrNull(value)
  if (normalized === "Orphaned" || normalized === "Old" || normalized === "Normal") {
    return normalized
  }
  return "Normal"
}

const normalizeSnapshotRow = (value: unknown): InventoryEc2SnapshotRow | null => {
  if (!isRecord(value)) return null

  const snapshotId = toStringOrNull(value.snapshotId)
  if (!snapshotId) return null

  const signal = toSignal(value.signal)

  return {
    snapshotId,
    sourceVolumeId: toStringOrNull(value.sourceVolumeId),
    sourceVolumeName: toStringOrNull(value.sourceVolumeName),
    sourceInstanceId: toStringOrNull(value.sourceInstanceId),
    sourceInstanceName: toStringOrNull(value.sourceInstanceName),
    state: toStringOrNull(value.state),
    storageTier: toStringOrNull(value.storageTier),
    encrypted: toBooleanOrNull(value.encrypted),
    kmsKeyId: toStringOrNull(value.kmsKeyId),
    progress: toStringOrNull(value.progress),
    startTime: toStringOrNull(value.startTime),
    ageDays: toNumberOrNull(value.ageDays),
    likelyOrphaned: toBooleanOrNull(value.likelyOrphaned) ?? signal === "Orphaned",
    signal,
    cost: toNumberOrNull(value.cost),
    currencyCode: toStringOrNull(value.currencyCode),
    regionKey: toStringOrNull(value.regionKey),
    subAccountKey: toStringOrNull(value.subAccountKey),
    tags: toObjectOrNull(value.tags),
    metadata: toObjectOrNull(value.metadata),
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
      snapshotsInView: 0,
      likelyOrphanedCount: 0,
      oldSnapshotsCount: 0,
      totalSnapshotCost: null,
    }
  }

  return {
    snapshotsInView: toNumberOrNull(value.snapshotsInView) ?? 0,
    likelyOrphanedCount: toNumberOrNull(value.likelyOrphanedCount) ?? 0,
    oldSnapshotsCount: toNumberOrNull(value.oldSnapshotsCount) ?? 0,
    totalSnapshotCost: toNumberOrNull(value.totalSnapshotCost),
  }
}

const extractItemsArray = (value: unknown): unknown[] => {
  if (!isRecord(value)) return []
  if (Array.isArray(value.items)) return value.items
  if (Array.isArray(value.snapshots)) return value.snapshots
  if (Array.isArray(value.rows)) return value.rows

  // TODO(inventory-frontend): remove this fallback once backend response shape is fully frozen.
  if (isRecord(value.data) && Array.isArray(value.data.items)) return value.data.items
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
  if (params.state) searchParams.set("state", params.state)
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
    items,
    pagination: normalizePagination(paginationSource, page, pageSize),
    summary: normalizeSummary(summarySource),
  }
}
