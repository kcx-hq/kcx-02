import { apiGet } from "@/lib/api"

export type InventoryEc2InstanceRow = {
  instanceId: string
  instanceName: string
  state: string | null
  instanceType: string | null
  subAccountKey: string | null
  subAccountName: string | null
  availabilityZone: string | null
  launchTime: string | null
  privateIpAddress: string | null
  publicIpAddress: string | null
  cpuAvg: number | null
  cpuMax: number | null
  isIdleCandidate: boolean | null
  isUnderutilizedCandidate: boolean | null
  isOverutilizedCandidate: boolean | null
  pricingType: "on_demand" | "reserved" | "savings_plan" | "spot" | "other" | null
  totalHours: number
  computeCost: number
  coveredHours: number
  uncoveredHours: number
  monthToDateCost: number
  latestDailyCost: number | null
  imageId: string | null
  tenancy: string | null
  architecture: string | null
  instanceLifecycle: string | null
  platform: string | null
  resourceKey: string | null
  cloudConnectionId: string | null
  regionKey: string | null
  regionId: string | null
  regionName: string | null
}

export type InventoryEc2InstancesPagination = {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export type InventoryEc2InstancesListResponse = {
  items: InventoryEc2InstanceRow[]
  pagination: InventoryEc2InstancesPagination
}

export type InventoryEc2InstancesListParams = {
  cloudConnectionId?: string | null
  subAccountKey?: string | null
  state?: string | null
  region?: string | null
  instanceType?: string | null
  pricingType?: "on_demand" | "reserved" | "savings_plan" | "spot" | null
  search?: string | null
  startDate?: string | null
  endDate?: string | null
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

const normalizeInstanceRow = (value: unknown): InventoryEc2InstanceRow | null => {
  if (!isRecord(value)) return null

  const instanceId = toStringOrNull(value.instanceId)
  if (!instanceId) return null

  const monthToDateCost = toNumberOrNull(value.monthToDateCost) ?? 0
  const rawPricingType = toStringOrNull(value.pricingType)
  const pricingType =
    rawPricingType === "on_demand" ||
    rawPricingType === "reserved" ||
    rawPricingType === "savings_plan" ||
    rawPricingType === "spot" ||
    rawPricingType === "other"
      ? (rawPricingType as InventoryEc2InstanceRow["pricingType"])
      : null

  return {
    instanceId,
    instanceName: toStringOrNull(value.instanceName) ?? instanceId,
    state: toStringOrNull(value.state),
    instanceType: toStringOrNull(value.instanceType),
    subAccountKey: toStringOrNull(value.subAccountKey),
    subAccountName: toStringOrNull(value.subAccountName),
    availabilityZone: toStringOrNull(value.availabilityZone),
    launchTime: toStringOrNull(value.launchTime),
    privateIpAddress: toStringOrNull(value.privateIpAddress),
    publicIpAddress: toStringOrNull(value.publicIpAddress),
    cpuAvg: toNumberOrNull(value.cpuAvg),
    cpuMax: toNumberOrNull(value.cpuMax),
    isIdleCandidate: toBooleanOrNull(value.isIdleCandidate),
    isUnderutilizedCandidate: toBooleanOrNull(value.isUnderutilizedCandidate),
    isOverutilizedCandidate: toBooleanOrNull(value.isOverutilizedCandidate),
    pricingType,
    totalHours: toNumberOrNull(value.totalHours) ?? 0,
    computeCost: toNumberOrNull(value.computeCost) ?? 0,
    coveredHours: toNumberOrNull(value.coveredHours) ?? 0,
    uncoveredHours: toNumberOrNull(value.uncoveredHours) ?? 0,
    monthToDateCost,
    latestDailyCost: toNumberOrNull(value.latestDailyCost),
    imageId: toStringOrNull(value.imageId),
    tenancy: toStringOrNull(value.tenancy),
    architecture: toStringOrNull(value.architecture),
    instanceLifecycle: toStringOrNull(value.instanceLifecycle),
    platform: toStringOrNull(value.platform),
    resourceKey: toStringOrNull(value.resourceKey),
    cloudConnectionId: toStringOrNull(value.cloudConnectionId),
    regionKey: toStringOrNull(value.regionKey),
    regionId: toStringOrNull(value.regionId),
    regionName: toStringOrNull(value.regionName),
  }
}

const normalizePagination = (
  value: unknown,
  fallbackPage: number,
  fallbackPageSize: number,
): InventoryEc2InstancesPagination => {
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
  if (Array.isArray(value.instances)) return value.instances
  if (Array.isArray(value.rows)) return value.rows

  // TODO(inventory-frontend): remove this fallback once backend response shape is fully frozen.
  if (isRecord(value.data) && Array.isArray(value.data.items)) return value.data.items
  return []
}

export async function getInventoryEc2Instances(
  params: InventoryEc2InstancesListParams = {},
): Promise<InventoryEc2InstancesListResponse> {
  const page = typeof params.page === "number" && Number.isFinite(params.page) ? Math.max(1, params.page) : 1
  const pageSize =
    typeof params.pageSize === "number" && Number.isFinite(params.pageSize)
      ? Math.min(100, Math.max(1, params.pageSize))
      : 25

  const searchParams = new URLSearchParams()
  searchParams.set("page", String(page))
  searchParams.set("pageSize", String(pageSize))

  if (params.cloudConnectionId) searchParams.set("cloudConnectionId", params.cloudConnectionId)
  if (params.subAccountKey) searchParams.set("subAccountKey", params.subAccountKey)
  if (params.state) searchParams.set("state", params.state)
  if (params.region) searchParams.set("region", params.region)
  if (params.instanceType) searchParams.set("instanceType", params.instanceType)
  if (params.pricingType) searchParams.set("pricingType", params.pricingType)
  if (params.search) searchParams.set("search", params.search)
  if (params.startDate) searchParams.set("startDate", params.startDate)
  if (params.endDate) searchParams.set("endDate", params.endDate)

  const path = `/inventory/aws/ec2/instances?${searchParams.toString()}`
  const response = await apiGet<unknown>(path)

  const rawItems = extractItemsArray(response)
  const items = rawItems
    .map((item) => normalizeInstanceRow(item))
    .filter((item): item is InventoryEc2InstanceRow => item !== null)

  const paginationSource = isRecord(response)
    ? response.pagination ?? (isRecord(response.data) ? response.data.pagination : null)
    : null

  return {
    items,
    pagination: normalizePagination(paginationSource, page, pageSize),
  }
}

