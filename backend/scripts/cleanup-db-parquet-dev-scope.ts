import { QueryTypes } from "sequelize";

import { sequelize } from "../src/models/index.js";

type Scope = {
  tenantId: string;
  cloudConnectionId: string;
  billingSourceId: number | null;
  providerId: number | null;
};

type CountRow = { count: string };

type TablePlan = {
  table: string;
  whereSql: string;
  replacements: Record<string, unknown>;
};

async function tableExists(table: string): Promise<boolean> {
  const rows = await sequelize.query<{ exists: boolean }>(
    `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = :table
    ) AS "exists"
    `,
    { replacements: { table }, type: QueryTypes.SELECT },
  );
  return Boolean(rows[0]?.exists);
}

async function getTableColumns(table: string): Promise<Set<string>> {
  const rows = await sequelize.query<{ column_name: string }>(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = :table
    `,
    { replacements: { table }, type: QueryTypes.SELECT },
  );
  return new Set(rows.map((row) => row.column_name));
}

async function resolveScope(): Promise<Scope> {
  const rows = await sequelize.query<Scope>(
    `
    SELECT
      f.tenant_id AS "tenantId",
      f.cloud_connection_id AS "cloudConnectionId",
      f.billing_source_id::bigint AS "billingSourceId",
      f.provider_id::bigint AS "providerId"
    FROM fact_db_resource_daily f
    WHERE f.cloud_connection_id IS NOT NULL
    ORDER BY f.usage_date DESC, f.created_at DESC
    LIMIT 1
    `,
    { type: QueryTypes.SELECT },
  );

  if (!rows.length) {
    throw new Error("No DB scope found in fact_db_resource_daily. Nothing to clean.");
  }

  return rows[0];
}

function buildWhereForTable(
  table: string,
  columns: Set<string>,
  scope: Scope,
  includeDbServiceFilter: boolean,
): string {
  const filters: string[] = [];
  if (columns.has("tenant_id")) filters.push("tenant_id = :tenantId::uuid");
  if (columns.has("cloud_connection_id")) filters.push("cloud_connection_id = :cloudConnectionId::uuid");
  if (columns.has("billing_source_id")) filters.push("(:billingSourceId::bigint IS NULL OR billing_source_id = :billingSourceId::bigint)");
  if (columns.has("provider_id")) filters.push("(:providerId::bigint IS NULL OR provider_id = :providerId::bigint)");
  if (table === "fact_recommendations") filters.push("category = 'DB'");

  if (includeDbServiceFilter) {
    if (columns.has("service_name")) {
      filters.push(`
        (
          lower(COALESCE(service_name, '')) LIKE '%rds%'
          OR lower(COALESCE(service_name, '')) LIKE '%aurora%'
          OR lower(COALESCE(service_name, '')) LIKE '%neptune%'
          OR lower(COALESCE(service_name, '')) LIKE '%documentdb%'
        )
      `);
    } else if (columns.has("service_key")) {
      filters.push(`
        service_key IN (
          SELECT id FROM dim_service
          WHERE lower(service_name) LIKE '%rds%'
             OR lower(service_name) LIKE '%aurora%'
             OR lower(service_name) LIKE '%neptune%'
             OR lower(service_name) LIKE '%documentdb%'
        )
      `);
    }
  }

  if (table === "fact_cost_line_items") {
    if (columns.has("service_key")) {
      filters.push(`
        service_key IN (
          SELECT id FROM dim_service
          WHERE lower(service_name) LIKE '%rds%'
             OR lower(service_name) LIKE '%aurora%'
             OR lower(service_name) LIKE '%neptune%'
             OR lower(service_name) LIKE '%documentdb%'
        )
      `);
    }
  }

  if (!filters.length) return "1=0";
  return filters.join("\nAND ");
}

function buildScopedPlans(scope: Scope, tableColumns: Map<string, Set<string>>): TablePlan[] {
  const baseReplacements: Record<string, unknown> = {
    tenantId: scope.tenantId,
    cloudConnectionId: scope.cloudConnectionId,
    billingSourceId: scope.billingSourceId,
    providerId: scope.providerId,
  };

  return [
    {
      table: "fact_recommendations",
      whereSql: buildWhereForTable("fact_recommendations", tableColumns.get("fact_recommendations") ?? new Set(), scope, false),
      replacements: baseReplacements,
    },
    {
      table: "db_utilization_daily",
      whereSql: buildWhereForTable("db_utilization_daily", tableColumns.get("db_utilization_daily") ?? new Set(), scope, false),
      replacements: baseReplacements,
    },
    {
      table: "db_resource_inventory_snapshots",
      whereSql: buildWhereForTable("db_resource_inventory_snapshots", tableColumns.get("db_resource_inventory_snapshots") ?? new Set(), scope, false),
      replacements: baseReplacements,
    },
    {
      table: "db_cost_history_daily",
      whereSql: buildWhereForTable("db_cost_history_daily", tableColumns.get("db_cost_history_daily") ?? new Set(), scope, false),
      replacements: baseReplacements,
    },
    {
      table: "fact_db_resource_daily",
      whereSql: buildWhereForTable("fact_db_resource_daily", tableColumns.get("fact_db_resource_daily") ?? new Set(), scope, false),
      replacements: baseReplacements,
    },
    {
      table: "fact_cost_line_items",
      whereSql: buildWhereForTable("fact_cost_line_items", tableColumns.get("fact_cost_line_items") ?? new Set(), scope, true),
      replacements: baseReplacements,
    },
    {
      table: "agg_cost_daily",
      whereSql: buildWhereForTable("agg_cost_daily", tableColumns.get("agg_cost_daily") ?? new Set(), scope, true),
      replacements: baseReplacements,
    },
    {
      table: "agg_cost_service_daily",
      whereSql: buildWhereForTable("agg_cost_service_daily", tableColumns.get("agg_cost_service_daily") ?? new Set(), scope, true),
      replacements: baseReplacements,
    },
    {
      table: "agg_cost_account_daily",
      whereSql: buildWhereForTable("agg_cost_account_daily", tableColumns.get("agg_cost_account_daily") ?? new Set(), scope, true),
      replacements: baseReplacements,
    },
    {
      table: "agg_cost_region_daily",
      whereSql: buildWhereForTable("agg_cost_region_daily", tableColumns.get("agg_cost_region_daily") ?? new Set(), scope, true),
      replacements: baseReplacements,
    },
  ];
}

async function countRows(plan: TablePlan): Promise<number> {
  const rows = await sequelize.query<CountRow>(
    `SELECT COUNT(*)::bigint AS "count" FROM ${plan.table} WHERE ${plan.whereSql}`,
    { replacements: plan.replacements, type: QueryTypes.SELECT },
  );
  return Number(rows[0]?.count ?? 0);
}

async function deleteRows(plan: TablePlan): Promise<number> {
  const before = await countRows(plan);
  if (before === 0) return 0;
  await sequelize.query(`DELETE FROM ${plan.table} WHERE ${plan.whereSql}`, {
    replacements: plan.replacements,
    type: QueryTypes.DELETE,
  });
  return before;
}

async function run(): Promise<void> {
  const scope = await resolveScope();
  const tableColumns = new Map<string, Set<string>>();
  const candidateTables = [
    "fact_recommendations",
    "db_utilization_daily",
    "db_resource_inventory_snapshots",
    "db_cost_history_daily",
    "fact_db_resource_daily",
    "fact_cost_line_items",
    "agg_cost_daily",
    "agg_cost_service_daily",
    "agg_cost_account_daily",
    "agg_cost_region_daily",
  ];
  const existingPlans: TablePlan[] = [];
  for (const table of candidateTables) {
    if (!(await tableExists(table))) continue;
    tableColumns.set(table, await getTableColumns(table));
  }
  const plans = buildScopedPlans(scope, tableColumns);
  for (const plan of plans) {
    if (tableColumns.has(plan.table)) existingPlans.push(plan);
  }

  const beforeCounts: Record<string, number> = {};
  for (const plan of existingPlans) {
    beforeCounts[plan.table] = await countRows(plan);
  }

  await sequelize.transaction(async () => {
    // Child/dependent tables first, then parent fact/agg tables.
    for (const table of [
      "fact_recommendations",
      "db_utilization_daily",
      "db_resource_inventory_snapshots",
      "db_cost_history_daily",
      "fact_db_resource_daily",
      "fact_cost_line_items",
      "agg_cost_service_daily",
      "agg_cost_account_daily",
      "agg_cost_region_daily",
      "agg_cost_daily",
    ]) {
      const plan = existingPlans.find((p) => p.table === table);
      if (!plan) continue;
      await deleteRows(plan);
    }
  });

  const afterCounts: Record<string, number> = {};
  for (const plan of existingPlans) {
    afterCounts[plan.table] = await countRows(plan);
  }

  const verification = {
    databaseExplorerFactRows: afterCounts.fact_db_resource_daily ?? 0,
    databaseExplorerCostRows: afterCounts.db_cost_history_daily ?? 0,
    databaseAssetsInventoryRows: afterCounts.db_resource_inventory_snapshots ?? 0,
    databaseAssetsRecommendationRows: afterCounts.fact_recommendations ?? 0,
  };

  console.log(
    JSON.stringify(
      {
        cleaned: true,
        scope,
        counts: {
          before: beforeCounts,
          after: afterCounts,
        },
        verification,
      },
      null,
      2,
    ),
  );
}

void run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
