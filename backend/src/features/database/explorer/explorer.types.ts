export const EXPLORER_METRICS = ["cost", "usage"] as const;

/** Canonical scope slugs accepted on `database_scope` query param. */
export const EXPLORER_DATABASE_SCOPES = [
  "all",
  "relational",
  "relational_rds",
  "relational_aurora",
  "key_value",
  "key_value_dynamodb",
  "in_memory",
  "in_memory_elasticache",
  "in_memory_memorydb",
  "document",
  "graph",
  "wide_column",
  "time_series",
] as const;

export type ExplorerDatabaseScope = (typeof EXPLORER_DATABASE_SCOPES)[number];

export const EXPLORER_GROUP_BY = [
  "db_service",
  "db_engine",
  "region",
  "resource_type",
  "instance_class",
  "cluster",
  "cost_category",
] as const;

export type ExplorerMetric = (typeof EXPLORER_METRICS)[number];
export type ExplorerGroupBy = (typeof EXPLORER_GROUP_BY)[number];

export type ExplorerQueryParams = {
  tenantId: string;
  startDate: string;
  endDate: string;
  cloudConnectionId?: string;
  regionKey?: string;
  /** Filters fact rows to a database taxonomy bucket (independent from `groupBy`). */
  databaseScope?: ExplorerDatabaseScope;
  dbService?: string;
  dbEngine?: string;
  metric: ExplorerMetric;
  groupBy: ExplorerGroupBy;
};

export type ExplorerCards = {
  totalCost: number;
  costTrendPct: number | null;
  activeResources: number;
  dataFootprintGb: number;
  avgLoad: number | null;
  connections: number | null;
};

export type ExplorerCostTrendItem = {
  date: string;
  compute: number;
  storage: number;
  io: number;
  backup: number;
  total: number;
};

export type ExplorerUsageTrendItem = {
  date: string;
  load: number | null;
  connections: number | null;
};

export type ExplorerTrendItem = ExplorerCostTrendItem | ExplorerUsageTrendItem;

export type ExplorerTrendGroupedPoint = {
  date: string;
  value: number;
};

export type ExplorerTrendGroupedSeries = {
  key: string;
  label: string;
  data: ExplorerTrendGroupedPoint[];
  total?: number;
};

export type ExplorerTrendGrouped = {
  metric: ExplorerMetric;
  groupBy: ExplorerGroupBy;
  chartType: "stacked_bar" | "line";
  xKey: "date";
  usageMetric?: "load_avg";
  series: ExplorerTrendGroupedSeries[];
};

export type ExplorerTableRow = {
  group: string;
  totalCost: number;
  computeCost: number;
  storageCost: number;
  ioCost: number;
  backupCost: number;
  resourceCount: number;
  avgLoad: number | null;
  connections: number | null;
};

export type ExplorerFilterOptions = {
  dbServices: string[];
  dbEngines: string[];
  /** Scopes that have ≥1 fact row in the requested window (plus always `all`). */
  availableDatabaseScopes: ExplorerDatabaseScope[];
};

export type ExplorerResponse = {
  filters: ExplorerQueryParams;
  filterOptions: ExplorerFilterOptions;
  cards: ExplorerCards;
  trend: ExplorerTrendItem[];
  trendGrouped?: ExplorerTrendGrouped;
  table: ExplorerTableRow[];
};
