import type { DashboardScope } from "../../dashboard/dashboard.types.js";

export const LOAD_BALANCER_EXPLORER_METRICS = ["cost", "load_balancers", "usage"] as const;
export type LoadBalancerExplorerMetric = (typeof LOAD_BALANCER_EXPLORER_METRICS)[number];

export const LOAD_BALANCER_EXPLORER_GRANULARITIES = ["hourly", "daily", "monthly"] as const;
export type LoadBalancerExplorerGranularity = (typeof LOAD_BALANCER_EXPLORER_GRANULARITIES)[number];

export const LOAD_BALANCER_EXPLORER_GROUP_BY = [
  "cost_type",
  "none",
  "account",
  "region",
  "type",
  "scheme",
  "state",
  "team",
  "product",
  "environment",
  "tag",
  "load_balancer",
] as const;
export type LoadBalancerExplorerGroupBy = (typeof LOAD_BALANCER_EXPLORER_GROUP_BY)[number];

export type LoadBalancerExplorerTagFilter = {
  key: string;
  value: string;
};

export type LoadBalancerExplorerFilters = {
  cloudConnectionId: string | null;
  loadBalancerArn: string | null;
  accountId: string | null;
  regions: string[];
  types: string[];
  schemes: string[];
  states: string[];
  teams: string[];
  products: string[];
  environments: string[];
  tags: LoadBalancerExplorerTagFilter[];
};

export type LoadBalancerExplorerInput = {
  scope: DashboardScope;
  startDate: string;
  endDate: string;
  metric: LoadBalancerExplorerMetric;
  granularity: LoadBalancerExplorerGranularity;
  groupBy: LoadBalancerExplorerGroupBy;
  tagKey: string | null;
  filters: LoadBalancerExplorerFilters;
  groupValues: string[];
};

export type LoadBalancerExplorerSummary = {
  totalCost: number;
  fixedCost?: number;
  lcuCost?: number;
  dataProcessingCost?: number;
  previousCost: number;
  trendPercent: number;
  loadBalancerCount: number;
  totalLoadBalancers?: number;
  albCount?: number;
  nlbCount?: number;
  activeLoadBalancerCount: number;
  internetFacingCount: number;
  internalCount: number;
  totalProcessedBytesGb: number;
  avgDailyCost: number;
  requestCount?: number;
  processedGB?: number;
  activeConnections?: number;
  newConnections?: number;
  healthyHosts?: number;
  unhealthyHosts?: number;
  errorCount?: number;
};

export type LoadBalancerExplorerGraphPoint = {
  date: string;
  value: number;
  group?: string;
  loadBalancerCount?: number;
  requestCount?: number;
  processedGB?: number;
  activeConnections?: number;
  newConnections?: number;
  healthyHosts?: number;
  unhealthyHosts?: number;
  errorCount?: number;
};

export type LoadBalancerExplorerGraphSeries = {
  key: string;
  label: string;
  data: LoadBalancerExplorerGraphPoint[];
};

export type LoadBalancerExplorerGraph = {
  type: "bar" | "stacked_bar" | "line" | "area" | "stacked_area";
  xKey: "date";
  series: LoadBalancerExplorerGraphSeries[];
};

export type LoadBalancerExplorerTableColumn = {
  key: string;
  label: string;
};

export type LoadBalancerExplorerTableRow = {
  id: string;
  [key: string]: string | number | null;
};

export type LoadBalancerExplorerTable = {
  columns: LoadBalancerExplorerTableColumn[];
  rows: LoadBalancerExplorerTableRow[];
};

export type LoadBalancerExplorerResponse = {
  summary: LoadBalancerExplorerSummary;
  graph: LoadBalancerExplorerGraph;
  table: LoadBalancerExplorerTable;
};

export type LoadBalancerExplorerCostDailyRow = {
  usageDate: string;
  cloudConnectionId: string | null;
  accountId: string;
  region: string;
  loadBalancerArn: string;
  totalCost: number;
  fixedCost: number;
  lcuCost: number;
  dataProcessingCost: number;
  processedBytesGb: number;
  usageQuantity: number;
  lineItemCount: number;
  currencyCode: string;
};

export type LoadBalancerExplorerInventoryRow = {
  cloudConnectionId: string | null;
  accountId: string;
  region: string;
  arn: string;
  name: string;
  type: string;
  scheme: string;
  state: string;
  team: string;
  product: string;
  environment: string;
  tagsJson: Record<string, unknown> | null;
};
