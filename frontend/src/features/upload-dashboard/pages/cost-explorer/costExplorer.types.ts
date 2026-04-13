export type DatePreset = "last-7d" | "last-30d" | "mtd" | "qtd" | "ytd" | "custom";
export type Granularity = "hourly" | "daily" | "monthly";
export type GroupBy = "none" | "service" | "service-category" | "resource" | "region" | "account";
export type CompareKey = "previous-month" | "budget" | "forecast";
export type Metric = "billed" | "effective" | "list";
export type SeriesKind = "primary" | "group" | "comparison";

export type TimeLabel = {
  short: string;
  long: string;
};

export type ChartSeries = {
  name: string;
  values: number[];
  kind: SeriesKind;
  compareKey?: CompareKey;
};

export type CostExplorerChipKey = "granularity" | "group" | "compare" | "metric";

export type CostExplorerChip = {
  key: CostExplorerChipKey;
  label: string;
  value: string;
};

export const DATE_PRESETS: Array<{ key: DatePreset; label: string }> = [
  { key: "last-7d", label: "Last 7d" },
  { key: "last-30d", label: "Last 30d" },
  { key: "mtd", label: "MTD" },
  { key: "qtd", label: "QTD" },
  { key: "ytd", label: "YTD" },
  { key: "custom", label: "Custom" },
];

export const GROUP_BY_OPTIONS: Array<{ key: GroupBy; label: string }> = [
  { key: "none", label: "None" },
  { key: "service", label: "Service" },
  { key: "service-category", label: "Service Category" },
  { key: "resource", label: "Resource" },
  { key: "region", label: "Region" },
  { key: "account", label: "Account" },
];

export const COMPARE_OPTIONS: Array<{ key: CompareKey; label: string }> = [
  { key: "previous-month", label: "Previous Month" },
  { key: "budget", label: "Budget" },
  { key: "forecast", label: "Forecast" },
];

export const METRIC_OPTIONS: Array<{ key: Metric; label: string }> = [
  { key: "billed", label: "Billed Cost" },
  { key: "effective", label: "Effective Cost" },
  { key: "list", label: "List Cost" },
];
