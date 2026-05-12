import type { DatabaseExplorerScopeValue } from "../../api/dashboardTypes";
import { DATABASE_EXPLORER_SCOPES } from "../../api/dashboardTypes";

export { DATABASE_EXPLORER_SCOPES };

const formatDbServiceLabel = (service: string): string => {
  switch (service) {
    case "AmazonRDS":
      return "Amazon RDS";
    case "Aurora":
      return "Amazon Aurora";
    case "DynamoDB":
      return "Amazon DynamoDB";
    case "ElastiCache":
      return "Amazon ElastiCache";
    case "MemoryDB":
      return "Amazon MemoryDB";
    case "DocumentDB":
      return "Amazon DocumentDB";
    case "Neptune":
      return "Amazon Neptune";
    case "Keyspaces":
      return "Amazon Keyspaces";
    case "Timestream":
      return "Amazon Timestream";
    default:
      return service;
  }
};

const SCOPE_PRIMARY_LABEL: Record<DatabaseExplorerScopeValue, string> = {
  all: "All Databases",
  relational: "Relational",
  relational_rds: "Amazon RDS",
  relational_aurora: "Amazon Aurora",
  key_value: "Key-value",
  key_value_dynamodb: "DynamoDB",
  in_memory: "In-memory",
  in_memory_elasticache: "Amazon ElastiCache",
  in_memory_memorydb: "Amazon MemoryDB",
  document: "Document",
  graph: "Graph",
  wide_column: "Wide column",
  time_series: "Time series",
};

export const formatDatabaseScopePrimaryLabel = (scope: DatabaseExplorerScopeValue): string => SCOPE_PRIMARY_LABEL[scope];

const PORTFOLIO_CATEGORY_SCOPES = new Set<DatabaseExplorerScopeValue>(["relational", "key_value", "in_memory"]);

/** When `dbService` is empty, use these for toolbar (scope primary alone is too generic). */
const TOOLBAR_LEAF_SERVICE_FALLBACK: Partial<Record<DatabaseExplorerScopeValue, string>> = {
  document: "Amazon DocumentDB",
  graph: "Amazon Neptune",
  wide_column: "Amazon Keyspaces",
  time_series: "Amazon Timestream",
};

/**
 * Compact summary for toolbar/chips: avoids repeating scope + service + engine with slashes.
 * Prefer `Service • Engine` (or category + engine on portfolio scopes with an engine).
 */
export const formatDatabaseScopeChip = (
  databaseScope: DatabaseExplorerScopeValue,
  dbService: string,
  dbEngine: string,
): string => {
  const engine = dbEngine.trim();
  if (databaseScope === "all") {
    return "All Databases";
  }

  const primary = formatDatabaseScopePrimaryLabel(databaseScope);

  if (PORTFOLIO_CATEGORY_SCOPES.has(databaseScope)) {
    return engine ? `${primary} • ${engine}` : primary;
  }

  const svcRaw = dbService.trim();
  const fromService = svcRaw ? formatDbServiceLabel(svcRaw) : "";
  const fromFallback = TOOLBAR_LEAF_SERVICE_FALLBACK[databaseScope];
  let servicePart = fromService || fromFallback || primary;

  if (fromService && fromFallback) {
    const a = fromService.toLowerCase();
    const b = fromFallback.toLowerCase();
    if (a === b) servicePart = fromFallback;
    else if (a.includes(b) || b.includes(a)) servicePart = fromFallback.length <= fromService.length ? fromFallback : fromService;
    else servicePart = fromService;
  } else if (fromService) {
    const a = fromService.toLowerCase();
    const b = primary.toLowerCase();
    if (a === b) servicePart = primary;
    else if (a.includes(b) || b.includes(a)) servicePart = primary.length <= fromService.length ? primary : fromService;
    else servicePart = fromService;
  }

  if (!engine) {
    return servicePart;
  }
  return `${servicePart} • ${engine}`;
};

export const isDatabaseScopeAvailable = (
  scope: DatabaseExplorerScopeValue,
  available: readonly DatabaseExplorerScopeValue[],
): boolean => {
  const set = new Set(available);
  if (set.has(scope)) return true;
  if (scope === "relational_rds" || scope === "relational_aurora") return set.has("relational");
  if (scope === "key_value_dynamodb") return set.has("key_value");
  if (scope === "in_memory_elasticache" || scope === "in_memory_memorydb") return set.has("in_memory");
  return false;
};

/** UI rows: parent rows are selectable filters; `depth` used for indentation only. */
export type DatabaseScopeUiRow = {
  value: DatabaseExplorerScopeValue;
  label: string;
  depth: 0 | 1;
};

export const DATABASE_SCOPE_UI_ROWS: DatabaseScopeUiRow[] = [
  { value: "all", label: SCOPE_PRIMARY_LABEL.all, depth: 0 },
  { value: "relational", label: SCOPE_PRIMARY_LABEL.relational, depth: 0 },
  { value: "relational_rds", label: SCOPE_PRIMARY_LABEL.relational_rds, depth: 1 },
  { value: "relational_aurora", label: SCOPE_PRIMARY_LABEL.relational_aurora, depth: 1 },
  { value: "key_value", label: SCOPE_PRIMARY_LABEL.key_value, depth: 0 },
  { value: "key_value_dynamodb", label: SCOPE_PRIMARY_LABEL.key_value_dynamodb, depth: 1 },
  { value: "in_memory", label: SCOPE_PRIMARY_LABEL.in_memory, depth: 0 },
  { value: "in_memory_elasticache", label: SCOPE_PRIMARY_LABEL.in_memory_elasticache, depth: 1 },
  { value: "in_memory_memorydb", label: SCOPE_PRIMARY_LABEL.in_memory_memorydb, depth: 1 },
  { value: "document", label: SCOPE_PRIMARY_LABEL.document, depth: 0 },
  { value: "graph", label: SCOPE_PRIMARY_LABEL.graph, depth: 0 },
  { value: "wide_column", label: SCOPE_PRIMARY_LABEL.wide_column, depth: 0 },
  { value: "time_series", label: SCOPE_PRIMARY_LABEL.time_series, depth: 0 },
];

/** Hierarchical navigator: category → services (same scope values as flat list). */
export type DatabaseScopeNavSection = {
  categoryTitle: string;
  /** Selecting the category row applies this scope (all services in the category). */
  portfolioScope?: DatabaseExplorerScopeValue;
  services: Array<{ scope: DatabaseExplorerScopeValue; label: string }>;
};

export const DATABASE_SCOPE_NAV_SECTIONS: readonly DatabaseScopeNavSection[] = [
  {
    categoryTitle: "Relational",
    portfolioScope: "relational",
    services: [
      { scope: "relational_rds", label: "Amazon RDS" },
      { scope: "relational_aurora", label: "Amazon Aurora" },
    ],
  },
  {
    categoryTitle: "Key-value",
    portfolioScope: "key_value",
    services: [{ scope: "key_value_dynamodb", label: "Amazon DynamoDB" }],
  },
  {
    categoryTitle: "In-memory",
    portfolioScope: "in_memory",
    services: [
      { scope: "in_memory_elasticache", label: "Amazon ElastiCache" },
      { scope: "in_memory_memorydb", label: "Amazon MemoryDB" },
    ],
  },
  {
    categoryTitle: "Document",
    services: [{ scope: "document", label: "Amazon DocumentDB" }],
  },
  {
    categoryTitle: "Graph",
    services: [{ scope: "graph", label: "Amazon Neptune" }],
  },
  {
    categoryTitle: "Wide column",
    services: [{ scope: "wide_column", label: "Amazon Keyspaces" }],
  },
  {
    categoryTitle: "Time series",
    services: [{ scope: "time_series", label: "Amazon Timestream" }],
  },
];

export const isKnownDatabaseScope = (value: string): value is DatabaseExplorerScopeValue =>
  (DATABASE_EXPLORER_SCOPES as readonly string[]).includes(value);
