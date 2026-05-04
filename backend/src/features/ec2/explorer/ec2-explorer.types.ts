import type { DashboardScope } from "../../dashboard/dashboard.types.js";

export const EC2_EXPLORER_METRICS = ["cost", "usage", "instances", "volumes", "data_transfer"] as const;
export type Ec2ExplorerMetric = (typeof EC2_EXPLORER_METRICS)[number];

export const EC2_EXPLORER_GRANULARITIES = ["hourly", "daily", "monthly"] as const;
export type Ec2ExplorerGranularity = (typeof EC2_EXPLORER_GRANULARITIES)[number];

export const EC2_EXPLORER_GROUP_BY = [
  "none",
  "region",
  "account",
  "availability_zone",
  "instance_type",
  "reservation_type",
  "cost_category",
  "usage_type",
  "operation",
  "instance_state",
  "recommendation",
  "volume",
  "volume_type",
  "attachment_state",
  "instance",
  "storage_tier",
  "iops_tier",
  "size_bucket",
  "lifecycle_state",
  "transfer_type",
  "source_region",
  "destination_region",
  "tag",
] as const;
export type Ec2ExplorerGroupBy = (typeof EC2_EXPLORER_GROUP_BY)[number];

export const EC2_COST_BASIS = [
  "billed_cost",
  "effective_cost",
  "amortized_cost",
  "net_amortized_cost",
  "net_unblended_cost",
] as const;
export type Ec2CostBasis = (typeof EC2_COST_BASIS)[number];

export const EC2_USAGE_TYPES = ["cpu", "network", "disk"] as const;
export type Ec2UsageType = (typeof EC2_USAGE_TYPES)[number];

export const EC2_USAGE_AGGREGATIONS = ["avg", "max", "p95"] as const;
export type Ec2UsageAggregation = (typeof EC2_USAGE_AGGREGATIONS)[number];

export const EC2_INSTANCE_CONDITIONS = [
  "all",
  "idle",
  "underutilized",
  "overutilized",
  "uncovered",
] as const;
export type Ec2InstanceCondition = (typeof EC2_INSTANCE_CONDITIONS)[number];

export type Ec2ExplorerTagFilter = {
  key: string;
  value: string;
};

export type Ec2ExplorerFilters = {
  regions: string[];
  tags: Ec2ExplorerTagFilter[];
};

export type Ec2ExplorerInput = {
  scope: DashboardScope;
  startDate: string;
  endDate: string;
  metric: Ec2ExplorerMetric;
  granularity: Ec2ExplorerGranularity;
  volumeView: "storage" | "storage_hours" | "cost" | "count";
  groupBy: Ec2ExplorerGroupBy;
  tagKey: string | null;
  filters: Ec2ExplorerFilters;
  costBasis: Ec2CostBasis;
  usageType: Ec2UsageType;
  aggregation: Ec2UsageAggregation;
  condition: Ec2InstanceCondition;
  groupValues: string[];
  minCost: number | null;
  maxCost: number | null;
  minCpu: number | null;
  maxCpu: number | null;
  minNetwork: number | null;
  maxNetwork: number | null;
  states: string[];
  instanceTypes: string[];
  teams: string[];
  products: string[];
  environments: string[];
  accounts: string[];
  volumeTypes: string[];
  volumeAttachment: "all" | "attached" | "unattached";
  volumeStatuses: string[];
  debugDataTransfer: boolean;
};

export type Ec2ExplorerSummary = {
  totalCost: number;
  previousCost: number;
  trendPercent: number;
  instanceCount: number;
  volumeCount: number;
  attachedInstanceCount: number;
  unattachedVolumeCount: number;
  storageGb: number;
  storageGbHours: number;
  avgCpu: number;
  totalNetworkGb: number;
};

export type Ec2ExplorerGraphPoint = {
  date: string;
  value: number;
  cost?: number;
  total_cost?: number;
  data_transfer_cost?: number;
  usage_gb?: number;
  billed_usage_gb?: number;
  total_usage_gb?: number;
  percent_share?: number;
};

export type Ec2ExplorerGraphSeries = {
  key: string;
  label: string;
  data: Ec2ExplorerGraphPoint[];
};

export type Ec2ExplorerGraph = {
  type: "bar" | "stacked_bar" | "line" | "area" | "stacked_area";
  xKey: "date";
  series: Ec2ExplorerGraphSeries[];
};

export type Ec2ExplorerTableColumn = {
  key: string;
  label: string;
};

export type Ec2ExplorerTableRow = {
  id: string;
  [key: string]: string | number | null;
};

export type Ec2ExplorerTable = {
  columns: Ec2ExplorerTableColumn[];
  rows: Ec2ExplorerTableRow[];
};

export type Ec2ExplorerResponse = {
  summary: Ec2ExplorerSummary;
  graph: Ec2ExplorerGraph;
  table: Ec2ExplorerTable;
  dataTransferDebug?: {
    totalUnknownCost: number;
    totalUnknownUsageGb: number;
    unknownResourceCount: number;
    unmappedResourceCount: number;
    unmappedResourceCost: number;
    unmappedResourceUsageGb: number;
    unknown_resource_count: number;
    unmapped_resource_cost: number;
    unmapped_resource_usage_gb: number;
    topUnknownContributors: Array<{
      usageType: string;
      operation: string;
      productFamily: string;
      lineItemDescription: string;
      lineItemType: string;
      serviceCode: string;
      productCode: string;
      region: string;
      usageAmount: number;
      usageUnit: string;
      cost: number;
      resourceId: string;
      normalizedResourceId: string;
      dateBucket: string;
      likelyDemoData: boolean;
    }>;
    topUnknownRows: Array<{
      usageType: string;
      operation: string;
      productFamily: string;
      lineItemDescription: string;
      lineItemType: string;
      serviceCode: string;
      productCode: string;
      region: string;
      usageAmount: number;
      usageUnit: string;
      cost: number;
      resourceId: string;
      normalizedResourceId: string;
      dateBucket: string;
      likelyDemoData: boolean;
    }>;
  };
};

export const EC2_NETWORK_BREAKDOWN_TYPES = [
  "Internet Data Transfer",
  "Inter-Region Data Transfer",
  "Inter-AZ Data Transfer",
  "NAT Gateway",
  "Elastic IP",
  "Load Balancer",
  "Other Network",
] as const;
export type Ec2NetworkBreakdownType = (typeof EC2_NETWORK_BREAKDOWN_TYPES)[number];

export type Ec2NetworkBreakdownCategory = {
  type: Ec2NetworkBreakdownType;
  cost: number;
  percent: number;
  usageQuantity: number;
  resourceCount: number;
};

export type Ec2NetworkBreakdownResponse = {
  totalNetworkCost: number;
  totalNetworkUsageGb: number | null;
  categories: Ec2NetworkBreakdownCategory[];
  note: string | null;
};

export type Ec2ExplorerFactRow = {
  date: string;
  instanceId: string;
  instanceName: string;
  instanceType: string;
  region: string;
  account: string;
  state: string;
  computeCost: number;
  ebsCost: number;
  dataTransferCost: number;
  totalEffectiveCost: number;
  totalBilledCost: number;
  totalAmortizedCost: number | null;
  cpuAvg: number;
  cpuMax: number;
  diskUsedPercentAvg: number;
  diskUsedPercentMax: number;
  networkInBytes: number;
  networkOutBytes: number;
  isIdleCandidate: boolean;
  isUnderutilizedCandidate: boolean;
  isOverutilizedCandidate: boolean;
  reservationType: string;
  team: string;
  product: string;
  environment: string;
  tagsJson: Record<string, unknown> | null;
};

export type Ec2ExplorerAdditionalDailyCosts = {
  date: string;
  instanceId: string;
  snapshotCost: number;
  natGatewayCost: number;
  eipCost: number;
  loadBalancerCost: number;
};

export type Ec2ExplorerVolumeRow = {
  date: string;
  volumeId: string;
  volumeName: string;
  volumeType: string;
  region: string;
  account: string;
  state: string;
  attachedInstanceId: string | null;
  attachedInstanceName: string | null;
  isAttached: boolean;
  sizeGb: number;
  storageCost: number;
  ioCost: number;
  throughputCost: number;
  totalCost: number;
  team: string;
  product: string;
  environment: string;
  tagsJson: Record<string, unknown> | null;
};
