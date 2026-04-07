import type { DashboardScope } from "../dashboard.types.js";

export type CostExplorerGranularity = "hourly" | "daily" | "monthly";
export type CostExplorerGroupBy = "none" | "service" | "service-category" | "resource" | "region" | "account";
export type CostExplorerMetric = "billed" | "effective" | "list";
export type CostExplorerCompareKey = "previous-month" | "budget" | "forecast";

export type CostExplorerFilters = {
  granularity: CostExplorerGranularity;
  groupBy: CostExplorerGroupBy;
  metric: CostExplorerMetric;
  compareKey: CostExplorerCompareKey | null;
};

export type CostExplorerEffectiveFilters = CostExplorerFilters & {
  effectiveGranularity: CostExplorerGranularity;
  from: string;
  to: string;
};

export type CostExplorerChartLabel = {
  bucketStart: string;
  short: string;
  long: string;
};

export type CostExplorerSeriesKind = "primary" | "group" | "comparison";

export type CostExplorerSeries = {
  name: string;
  kind: CostExplorerSeriesKind;
  compareKey?: CostExplorerCompareKey;
  values: number[];
};

export type CostExplorerBreakdownRow = {
  key: number | string | null;
  name: string;
  cost: number;
  changePct: number;
  relatedServices?: string[];
  relatedResourceTypes?: string[];
};

export type CostExplorerResponse = {
  section: "cost-explorer";
  title: "Cost Explorer";
  message: string;
  filtersApplied: {
    from: string;
    to: string;
    granularity: CostExplorerGranularity;
    effectiveGranularity: CostExplorerGranularity;
    groupBy: CostExplorerGroupBy;
    metric: CostExplorerMetric;
    compareKey: CostExplorerCompareKey | null;
    scopeType: DashboardScope["scopeType"];
  };
  kpis: {
    periodSpend: number;
    previousPeriodSpend: number;
    trendPct: number;
    topService: string;
  };
  chart: {
    labels: CostExplorerChartLabel[];
    series: CostExplorerSeries[];
  };
  breakdowns: {
    service: CostExplorerBreakdownRow[];
    serviceCategory: CostExplorerBreakdownRow[];
    resource: CostExplorerBreakdownRow[];
    account: CostExplorerBreakdownRow[];
    region: CostExplorerBreakdownRow[];
  };
};
