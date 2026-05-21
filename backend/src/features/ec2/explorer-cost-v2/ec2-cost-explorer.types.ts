import type { DashboardScope } from "../../dashboard/dashboard.types.js";

export const EC2_COST_EXPLORER_GRANULARITIES = ["daily", "weekly", "monthly"] as const;
export type Ec2CostExplorerGranularity = (typeof EC2_COST_EXPLORER_GRANULARITIES)[number];

export const EC2_COST_EXPLORER_COST_BASIS = [
  "gross_cost",
  "net_cost",
  "effective_cost",
  "amortized_cost",
] as const;
export type Ec2CostExplorerCostBasis = (typeof EC2_COST_EXPLORER_COST_BASIS)[number];

export const EC2_COST_EXPLORER_GROUP_BY = [
  "none",
  "account",
  "region",
  "instance_type",
  "cost_type",
  "reservation_type",
  "tag",
] as const;
export type Ec2CostExplorerGroupBy = (typeof EC2_COST_EXPLORER_GROUP_BY)[number];

export const EC2_COST_EXPLORER_COMPARE = ["none", "previous_period"] as const;
export type Ec2CostExplorerCompare = (typeof EC2_COST_EXPLORER_COMPARE)[number];

export type Ec2CostExplorerTagFilter = {
  key: string;
  value: string;
};

export type Ec2CostExplorerFilters = {
  accountIds: string[];
  regions: string[];
  instanceTypes: string[];
  reservationTypes: string[];
  costTypes: string[];
  tags: Ec2CostExplorerTagFilter[];
};

export type Ec2CostExplorerInput = {
  scope: DashboardScope;
  startDate: string;
  endDate: string;
  granularity: Ec2CostExplorerGranularity;
  costBasis: Ec2CostExplorerCostBasis;
  groupBy: Ec2CostExplorerGroupBy;
  tagKey: string | null;
  compare: Ec2CostExplorerCompare;
  filters: Ec2CostExplorerFilters;
};

export type CostTypeKey = "compute" | "ebs" | "snapshot" | "data_transfer" | "eip" | "other";

export type Ec2CostExplorerRawRow = {
  date: string;
  category: string;
  chargeCategory: string;
  lineItemType: string;
  pricingModel: string;
  account: string;
  region: string;
  instanceType: string;
  reservationType: string;
  instanceId: string | null;
  attachedInstanceId: string | null;
  tagsJson: Record<string, unknown> | null;
  grossCost: number;
  rawBilledCost: number;
  positiveBilledCost: number;
  netCost: number;
  effectiveCost: number;
  amortizedCost: number;
  credits: number;
  billedCostSum: number;
  listCostSum: number;
  creditRowCount: number;
  creditBilledSum: number;
};

export type Ec2CostExplorerChartSeries = {
  groupKey: string;
  groupLabel: string;
  points: Array<{ date: string; value: number }>;
};

export type Ec2CostExplorerTableRow = {
  groupKey: string;
  groupLabel: string;
  grossCost: number;
  netCost: number;
  effectiveCost: number;
  computeCost: number;
  ebsCost: number;
  snapshotCost: number;
  dataTransferCost: number;
  eipCost: number;
  otherCost: number;
  instanceCount: number;
  percentOfTotal: number;
  mainCostDriver: "Compute" | "EBS" | "Snapshot" | "Data Transfer" | "EIP" | "Other";
};

export type Ec2CostExplorerResponse = {
  kpis: {
    grossCost: number;
    credits: number;
    netCost: number;
    computeCost: number;
    instanceCount: number;
  };
  chart: {
    granularity: Ec2CostExplorerGranularity;
    xAxis: "date";
    yAxis: string;
    series: Ec2CostExplorerChartSeries[];
  };
  table: {
    rows: Ec2CostExplorerTableRow[];
  };
  meta: {
    costBasis: Ec2CostExplorerCostBasis;
    groupBy: Ec2CostExplorerGroupBy;
    granularity: Ec2CostExplorerGranularity;
    currency: string;
    normalized: true;
    debug?: {
      positiveBilledSum: number;
      negativeBilledSum: number;
      creditRowsCount: number;
      rawBilledSum: number;
    };
  };
};
