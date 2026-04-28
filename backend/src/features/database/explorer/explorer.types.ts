export const EXPLORER_METRICS = ["cost", "usage"] as const;
export const EXPLORER_GROUP_BY = ["db_service", "db_engine", "region"] as const;

export type ExplorerMetric = (typeof EXPLORER_METRICS)[number];
export type ExplorerGroupBy = (typeof EXPLORER_GROUP_BY)[number];

export type ExplorerQueryParams = {
  tenantId: string;
  startDate: string;
  endDate: string;
  cloudConnectionId?: string;
  regionKey?: string;
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

export type ExplorerResponse = {
  filters: ExplorerQueryParams;
  cards: ExplorerCards;
  trend: ExplorerTrendItem[];
  table: ExplorerTableRow[];
};
