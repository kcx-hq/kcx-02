import { ApiError, apiGet } from "@/lib/api";

export type InventoryLoadBalancerRow = {
  id: string;
  arn: string | null;
  name: string;
  type: string | null;
  scheme: string | null;
  state: string | null;
  region: string | null;
  vpcId: string | null;
  dnsName: string | null;
  createdAtAws: string | null;
  accountId: string | null;
  team: string | null;
  product: string | null;
  environment: string | null;
  totalCost: number;
  fixedCost: number;
  lcuCost: number;
  dataProcessingCost: number;
  tags: Record<string, unknown> | null;
};

export type InventoryLoadBalancersPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type InventoryLoadBalancersListResponse = {
  items: InventoryLoadBalancerRow[];
  pagination: InventoryLoadBalancersPagination;
};

export type InventoryLoadBalancerDetailTargetGroup = {
  arn: string;
  name: string | null;
  protocol: string | null;
  port: number | null;
  targetType: string | null;
  healthyTargetCount: number;
  unhealthyTargetCount: number;
};

export type InventoryLoadBalancerDetailListener = {
  arn: string;
  protocol: string | null;
  port: number | null;
  sslPolicy: string | null;
  defaultActions: unknown[] | Record<string, unknown> | null;
};

export type InventoryLoadBalancerDetailResponse = {
  id: string;
  arn: string | null;
  name: string;
  type: string | null;
  scheme: string | null;
  state: string | null;
  region: string | null;
  vpcId: string | null;
  dnsName: string | null;
  createdAtAws: string | null;
  accountId: string | null;
  cloudConnectionId: string | null;
  tags: Record<string, unknown> | null;
  targetGroups: InventoryLoadBalancerDetailTargetGroup[];
  listeners: InventoryLoadBalancerDetailListener[];
};

export type InventoryLoadBalancersListParams = {
  startDate?: string | null;
  endDate?: string | null;
  search?: string | null;
  account?: string | null;
  region?: string | null;
  type?: string | null;
  scheme?: string | null;
  state?: string | null;
  team?: string | null;
  product?: string | null;
  environment?: string | null;
  tags?: string[] | null;
  sortBy?: "name" | "type" | "scheme" | "region" | "totalCost" | "fixedCost" | "lcuCost" | "dataProcessingCost";
  sortDirection?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => typeof value === "object" && value !== null;

const toStringOrNull = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toNumber = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const toRecordOrNull = (value: unknown): Record<string, unknown> | null => (isRecord(value) ? value : null);

const normalizeRow = (value: unknown): InventoryLoadBalancerRow | null => {
  if (!isRecord(value)) return null;
  const name = toStringOrNull(value.name) ?? toStringOrNull(value.loadBalancerName) ?? toStringOrNull(value.load_balancer);
  const arn = toStringOrNull(value.arn) ?? toStringOrNull(value.loadBalancerArn);
  const id = toStringOrNull(value.id) ?? arn ?? name;
  if (!id) return null;
  return {
    id,
    arn,
    name: name ?? id,
    type: toStringOrNull(value.type),
    scheme: toStringOrNull(value.scheme),
    state: toStringOrNull(value.state),
    region: toStringOrNull(value.region),
    vpcId: toStringOrNull(value.vpcId) ?? toStringOrNull(value.vpc_id),
    dnsName: toStringOrNull(value.dnsName) ?? toStringOrNull(value.dns_name),
    createdAtAws: toStringOrNull(value.createdAtAws) ?? toStringOrNull(value.created_at_aws) ?? toStringOrNull(value.createdAt),
    accountId: toStringOrNull(value.accountId),
    team: toStringOrNull(value.team),
    product: toStringOrNull(value.product),
    environment: toStringOrNull(value.environment),
    totalCost: toNumber(value.totalCost),
    fixedCost: toNumber(value.fixedCost),
    lcuCost: toNumber(value.lcuCost),
    dataProcessingCost: toNumber(value.dataProcessingCost),
    tags: toRecordOrNull(value.tags),
  };
};

const normalizePagination = (
  value: unknown,
  fallbackPage: number,
  fallbackPageSize: number,
): InventoryLoadBalancersPagination => {
  if (!isRecord(value)) {
    return { page: fallbackPage, pageSize: fallbackPageSize, total: 0, totalPages: 0 };
  }
  const page = Math.max(1, toNumber(value.page) || fallbackPage);
  const pageSize = Math.max(1, toNumber(value.pageSize) || fallbackPageSize);
  const total = Math.max(0, toNumber(value.total));
  const totalPages = Math.max(0, toNumber(value.totalPages) || (total > 0 ? Math.ceil(total / pageSize) : 0));
  return { page, pageSize, total, totalPages };
};

const extractItems = (value: unknown): unknown[] => {
  if (!isRecord(value)) return [];
  if (Array.isArray(value.items)) return value.items;
  if (Array.isArray(value.rows)) return value.rows;
  if (Array.isArray(value.loadBalancers)) return value.loadBalancers;
  if (isRecord(value.data) && Array.isArray(value.data.items)) return value.data.items;
  return [];
};

export async function getInventoryLoadBalancers(
  params: InventoryLoadBalancersListParams = {},
): Promise<InventoryLoadBalancersListResponse> {
  const page = typeof params.page === "number" && Number.isFinite(params.page) ? Math.max(1, params.page) : 1;
  const pageSize = typeof params.pageSize === "number" && Number.isFinite(params.pageSize) ? Math.max(1, params.pageSize) : 25;
  const searchParams = new URLSearchParams();
  searchParams.set("page", String(page));
  searchParams.set("pageSize", String(pageSize));
  if (params.startDate) searchParams.set("startDate", params.startDate);
  if (params.endDate) searchParams.set("endDate", params.endDate);
  if (params.search) searchParams.set("search", params.search);
  if (params.account) searchParams.set("account", params.account);
  if (params.region) searchParams.set("region", params.region);
  if (params.type) searchParams.set("type", params.type);
  if (params.scheme) searchParams.set("scheme", params.scheme);
  if (params.state) searchParams.set("state", params.state);
  if (params.team) searchParams.set("team", params.team);
  if (params.product) searchParams.set("product", params.product);
  if (params.environment) searchParams.set("environment", params.environment);
  if (Array.isArray(params.tags) && params.tags.length > 0) searchParams.set("tags", params.tags.join(","));
  if (params.sortBy) searchParams.set("sortBy", params.sortBy);
  if (params.sortDirection) searchParams.set("sortDirection", params.sortDirection);

  try {
    const response = await apiGet<unknown>(`/inventory/aws/load-balancers?${searchParams.toString()}`);
    const items = extractItems(response).map((item) => normalizeRow(item)).filter((item): item is InventoryLoadBalancerRow => item !== null);
    const paginationSource = isRecord(response)
      ? response.pagination ?? (isRecord(response.data) ? response.data.pagination : null)
      : null;
    return {
      items,
      pagination: normalizePagination(paginationSource, page, pageSize),
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return {
        items: [],
        pagination: { page, pageSize, total: 0, totalPages: 0 },
      };
    }
    throw error;
  }
}

export async function getInventoryLoadBalancerDetail(loadBalancerId: string): Promise<InventoryLoadBalancerDetailResponse> {
  const normalizedId = loadBalancerId.trim();
  if (!normalizedId) {
    throw new Error("loadBalancerId is required");
  }
  return apiGet<InventoryLoadBalancerDetailResponse>(`/inventory/aws/load-balancers/${encodeURIComponent(normalizedId)}`);
}
