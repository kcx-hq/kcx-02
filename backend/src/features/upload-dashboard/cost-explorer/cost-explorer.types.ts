import type { DashboardScope } from "../dashboard.types.js";

export type CostExplorerGranularity = "hourly" | "daily" | "monthly";
export type CostExplorerBaseGroupBy = "none" | "service" | "service-category" | "resource" | "region" | "account";
export type CostExplorerTagGroupBy = `tag:${string}`;
export type CostExplorerGroupBy = CostExplorerBaseGroupBy | CostExplorerTagGroupBy;
export type CostExplorerMetric = "billed" | "effective" | "list";
export type CostExplorerCompareKey = "previous-month" | "budget" | "forecast";

export type CostExplorerFilters = {
  granularity: CostExplorerGranularity;
  groupBy: CostExplorerGroupBy;
  metric: CostExplorerMetric;
  compareKey: CostExplorerCompareKey | null;
  tagKey: string | null;
  tagValue: string | null;
  groupValues: string[];
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
    tagKey: string | null;
    tagValue: string | null;
    groupValues: string[];
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

export type CostExplorerTagGroupKeyOption = {
  key: string;
  normalizedKey: string;
  count: number;
};

export type CostExplorerTagValueOption = {
  key: string;
  normalizedValue: string;
  count: number;
};

export type CostExplorerGroupValueOption = {
  key: string;
  label: string;
  count: number;
};

export type CostExplorerGroupOptionsResponse = {
  baseOptions: Array<{ key: CostExplorerBaseGroupBy; label: string }>;
  tagKeyOptions: CostExplorerTagGroupKeyOption[];
  tagValueOptions: CostExplorerTagValueOption[];
  groupValueOptions: CostExplorerGroupValueOption[];
};
