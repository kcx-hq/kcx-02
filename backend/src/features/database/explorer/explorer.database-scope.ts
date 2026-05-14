import type { ExplorerDatabaseScope, ExplorerQueryParams } from "./explorer.types.js";
import { EXPLORER_DATABASE_SCOPES } from "./explorer.types.js";

export { EXPLORER_DATABASE_SCOPES };

export const isExplorerDatabaseScope = (value: string): value is ExplorerDatabaseScope =>
  (EXPLORER_DATABASE_SCOPES as readonly string[]).includes(value);

/** Maps each non-`all` scope to db_service values used in fact / cost tables. */
export const DATABASE_SCOPE_TO_DB_SERVICES: Record<Exclude<ExplorerDatabaseScope, "all">, readonly string[]> = {
  relational: ["AmazonRDS", "Aurora", "Amazon RDS", "Amazon Aurora", "AmazonRelationalDatabaseService"],
  relational_rds: ["AmazonRDS", "Amazon RDS", "AmazonRelationalDatabaseService"],
  relational_aurora: ["Aurora", "Amazon Aurora"],
  key_value: ["DynamoDB", "Amazon DynamoDB", "AmazonDynamoDB"],
  key_value_dynamodb: ["DynamoDB", "Amazon DynamoDB", "AmazonDynamoDB"],
  in_memory: ["ElastiCache", "MemoryDB", "Amazon ElastiCache", "Amazon MemoryDB", "AmazonElastiCache", "AmazonMemoryDB"],
  in_memory_elasticache: ["ElastiCache", "Amazon ElastiCache", "AmazonElastiCache"],
  in_memory_memorydb: ["MemoryDB", "Amazon MemoryDB", "AmazonMemoryDB"],
  document: ["DocumentDB", "Amazon DocumentDB", "AmazonDocDB"],
  graph: ["Neptune", "Amazon Neptune"],
  wide_column: ["Keyspaces", "Amazon Keyspaces", "AmazonKeyspaces"],
  time_series: ["Timestream", "Amazon Timestream", "AmazonTimestream"],
};

const compactKey = (value: string): string => value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

const leafScopeForService = (dbService: string): Exclude<ExplorerDatabaseScope, "all"> | null => {
  const c = compactKey(dbService);
  if (!c) return null;

  if (c === "amazonrds") return "relational_rds";
  if (c === "aurora" || c === "amazonaurora") return "relational_aurora";
  if (c === "dynamodb" || c === "amazondynamodb") return "key_value_dynamodb";
  if (c === "elasticache" || c === "amazonelasticache") return "in_memory_elasticache";
  if (c === "memorydb" || c === "amazonmemorydb") return "in_memory_memorydb";
  if (c === "documentdb" || c === "amazondocumentdb" || c === "amazondocdb") return "document";
  if (c === "neptune" || c === "amazonneptune") return "graph";
  if (c === "keyspaces" || c === "amazonkeyspaces") return "wide_column";
  if (c === "timestream" || c === "amazontimestream") return "time_series";

  return null;
};

/** Distinct db_service values → scope slugs that have at least one matching row. Always includes `all`. */
export const servicesToAvailableDatabaseScopes = (dbServices: readonly string[]): ExplorerDatabaseScope[] => {
  const out = new Set<ExplorerDatabaseScope>(["all"]);
  const leaves = new Set<Exclude<ExplorerDatabaseScope, "all">>();

  for (const raw of dbServices) {
    const leaf = leafScopeForService(raw);
    if (leaf) leaves.add(leaf);
  }

  for (const leaf of leaves) {
    out.add(leaf);
  }

  if (leaves.has("relational_rds") || leaves.has("relational_aurora")) {
    out.add("relational");
  }
  if (leaves.has("key_value_dynamodb")) {
    out.add("key_value");
  }
  if (leaves.has("in_memory_elasticache") || leaves.has("in_memory_memorydb")) {
    out.add("in_memory");
  }

  const order = EXPLORER_DATABASE_SCOPES;
  return [...out].sort((a, b) => order.indexOf(a) - order.indexOf(b));
};

/** Legacy `database_type` query param → `database_scope` (parent tiers only). */
export const legacyDatabaseTypeToScope = (legacy: string): ExplorerDatabaseScope | undefined => {
  const key = legacy.trim().toLowerCase();
  const map: Record<string, ExplorerDatabaseScope> = {
    relational: "relational",
    key_value: "key_value",
    in_memory: "in_memory",
    document: "document",
    graph: "graph",
    wide_column: "wide_column",
    time_series: "time_series",
  };
  return map[key];
};

export const scopeToDbServices = (scope: ExplorerDatabaseScope | undefined): string[] | null => {
  if (!scope || scope === "all") return null;
  return [...DATABASE_SCOPE_TO_DB_SERVICES[scope]];
};

/** Tenant + date window (+ optional connection/region) without database scope — for discovering available scopes. */
export const buildScopeDiscoveryFilters = (
  params: Pick<ExplorerQueryParams, "tenantId" | "startDate" | "endDate" | "cloudConnectionId" | "regionKey">,
): string => {
  const filters = [
    "tenant_id = CAST(:tenantId AS uuid)",
    "usage_date BETWEEN CAST(:startDate AS date) AND CAST(:endDate AS date)",
  ];

  if (params.cloudConnectionId) {
    filters.push("cloud_connection_id = CAST(:cloudConnectionId AS uuid)");
  }

  if (params.regionKey) {
    filters.push("region_key = CAST(:regionKey AS bigint)");
  }

  return filters.join("\n    AND ");
};

/** Adds `scopeDbServices` for Sequelize `IN (:scopeDbServices)` when a non-`all` scope is active. */
export const buildExplorerScopeReplacements = <T extends ExplorerQueryParams>(params: T): T & { scopeDbServices?: string[] } => {
  const services = scopeToDbServices(params.databaseScope);
  if (!services) {
    return params;
  }

  return {
    ...params,
    scopeDbServices: services,
  };
};
