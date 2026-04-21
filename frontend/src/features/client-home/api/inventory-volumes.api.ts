import { apiGet } from "@/lib/api"

export type InventoryEc2VolumeRow = {
  volumeId: string
  volumeName: string
  volumeType: string | null
  sizeGb: number | null
  iops: number | null
  throughput: number | null
  state: string | null
  availabilityZone: string | null
  isAttached: boolean | null
  attachedInstanceId: string | null
  attachedInstanceName: string | null
  attachedInstanceState: string | null
  attachedInstanceType: string | null
  cloudConnectionId: string | null
  regionKey: string | null
  regionId: string | null
  regionName: string | null
  resourceKey: string | null
  subAccountKey: string | null
  discoveredAt: string | null
  tags: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
}

export type InventoryEc2VolumesPagination = {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export type InventoryEc2VolumesListResponse = {
  items: InventoryEc2VolumeRow[]
  pagination: InventoryEc2VolumesPagination
}

export type InventoryEc2VolumesListParams = {
  cloudConnectionId?: string | null
  state?: string | null
  volumeType?: string | null
  isAttached?: boolean | null
  region?: string | null
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

const normalizeVolumeRow = (value: unknown): InventoryEc2VolumeRow | null => {
  if (!isRecord(value)) return null

  const volumeId = toStringOrNull(value.volumeId)
  if (!volumeId) return null

  return {
    volumeId,
    volumeName: toStringOrNull(value.volumeName) ?? volumeId,
    volumeType: toStringOrNull(value.volumeType),
    sizeGb: toNumberOrNull(value.sizeGb),
    iops: toNumberOrNull(value.iops),
    throughput: toNumberOrNull(value.throughput),
    state: toStringOrNull(value.state),
    availabilityZone: toStringOrNull(value.availabilityZone),
    isAttached: toBooleanOrNull(value.isAttached),
    attachedInstanceId: toStringOrNull(value.attachedInstanceId),
    attachedInstanceName: toStringOrNull(value.attachedInstanceName),
    attachedInstanceState: toStringOrNull(value.attachedInstanceState),
    attachedInstanceType: toStringOrNull(value.attachedInstanceType),
    cloudConnectionId: toStringOrNull(value.cloudConnectionId),
    regionKey: toStringOrNull(value.regionKey),
    regionId: toStringOrNull(value.regionId),
    regionName: toStringOrNull(value.regionName),
    resourceKey: toStringOrNull(value.resourceKey),
    subAccountKey: toStringOrNull(value.subAccountKey),
    discoveredAt: toStringOrNull(value.discoveredAt),
    tags: toObjectOrNull(value.tags),
    metadata: toObjectOrNull(value.metadata),
  }
}

const normalizePagination = (
  value: unknown,
  fallbackPage: number,
  fallbackPageSize: number,
): InventoryEc2VolumesPagination => {
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

const extractItemsArray = (value: unknown): unknown[] => {
  if (!isRecord(value)) return []
  if (Array.isArray(value.items)) return value.items
  if (Array.isArray(value.volumes)) return value.volumes
  if (Array.isArray(value.rows)) return value.rows

  // TODO(inventory-frontend): remove this fallback once backend response shape is fully frozen.
  if (isRecord(value.data) && Array.isArray(value.data.items)) return value.data.items
  return []
}

export async function getInventoryEc2Volumes(
  params: InventoryEc2VolumesListParams = {},
): Promise<InventoryEc2VolumesListResponse> {
  const page = typeof params.page === "number" && Number.isFinite(params.page) ? Math.max(1, params.page) : 1
  const pageSize =
    typeof params.pageSize === "number" && Number.isFinite(params.pageSize)
      ? Math.min(100, Math.max(1, params.pageSize))
      : 25

  const searchParams = new URLSearchParams()
  searchParams.set("page", String(page))
  searchParams.set("pageSize", String(pageSize))

  if (params.cloudConnectionId) searchParams.set("cloudConnectionId", params.cloudConnectionId)
  if (params.state) searchParams.set("state", params.state)
  if (params.volumeType) searchParams.set("volumeType", params.volumeType)
  if (typeof params.isAttached === "boolean") searchParams.set("isAttached", String(params.isAttached))
  if (params.region) searchParams.set("region", params.region)
  if (params.search) searchParams.set("search", params.search)

  const path = `/inventory/aws/ec2/volumes?${searchParams.toString()}`
  const response = await apiGet<unknown>(path)

  const rawItems = extractItemsArray(response)
  const items = rawItems
    .map((item) => normalizeVolumeRow(item))
    .filter((item): item is InventoryEc2VolumeRow => item !== null)

  const paginationSource = isRecord(response)
    ? response.pagination ?? (isRecord(response.data) ? response.data.pagination : null)
    : null

  return {
    items,
    pagination: normalizePagination(paginationSource, page, pageSize),
  }
}

