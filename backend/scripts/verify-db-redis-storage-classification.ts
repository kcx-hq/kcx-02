import { QueryTypes } from "sequelize";

import { sequelize } from "../src/models/index.js";

type CliOptions = {
  ingestionRunId: string;
  tenantId: string;
  providerId: string;
  billingSourceId: string;
};

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  const get = (name: string): string => {
    const index = args.indexOf(name);
    const value = index >= 0 ? args[index + 1] : "";
    if (!value) {
      throw new Error(`Missing required arg ${name}`);
    }
    return value;
  };

  return {
    ingestionRunId: get("--ingestion-run-id"),
    tenantId: get("--tenant-id"),
    providerId: get("--provider-id"),
    billingSourceId: get("--billing-source-id"),
  };
};

async function main(): Promise<void> {
  const opts = parseArgs();

  const categoryTotals = await sequelize.query<
    { cost_category: string; effective_cost: string; billed_cost: string }
  >(
    `
SELECT
  d.cost_category,
  ROUND(COALESCE(SUM(d.effective_cost), 0)::numeric, 6)::text AS effective_cost,
  ROUND(COALESCE(SUM(d.billed_cost), 0)::numeric, 6)::text AS billed_cost
FROM db_cost_history_daily d
WHERE d.tenant_id = CAST(:tenantId AS UUID)
  AND d.provider_id = CAST(:providerId AS BIGINT)
  AND d.billing_source_id = CAST(:billingSourceId AS BIGINT)
  AND d.ingestion_run_id = CAST(:ingestionRunId AS BIGINT)
GROUP BY d.cost_category
ORDER BY COALESCE(SUM(d.effective_cost), 0) DESC, d.cost_category ASC;
`,
    {
      replacements: opts,
      type: QueryTypes.SELECT,
    },
  );

  const redisRowsByCategory = await sequelize.query<
    { cost_category: string; rows: string; effective_cost: string }
  >(
    `
SELECT
  d.cost_category,
  COUNT(*)::text AS rows,
  ROUND(COALESCE(SUM(d.effective_cost), 0)::numeric, 6)::text AS effective_cost
FROM db_cost_history_daily d
WHERE d.tenant_id = CAST(:tenantId AS UUID)
  AND d.provider_id = CAST(:providerId AS BIGINT)
  AND d.billing_source_id = CAST(:billingSourceId AS BIGINT)
  AND d.ingestion_run_id = CAST(:ingestionRunId AS BIGINT)
  AND (
    LOWER(COALESCE(d.db_service, '')) LIKE '%elasticache%'
    OR LOWER(COALESCE(d.db_engine, '')) LIKE '%redis%'
    OR LOWER(COALESCE(d.resource_id, '')) LIKE '%elasticache%'
  )
GROUP BY d.cost_category
ORDER BY COALESCE(SUM(d.effective_cost), 0) DESC, d.cost_category ASC;
`,
    {
      replacements: opts,
      type: QueryTypes.SELECT,
    },
  );

  const redisStorageSignalsInOther = await sequelize.query<
    { id: string; usage_type: string | null; product_usage_type: string | null; operation: string | null; line_item_description: string | null; effective_cost: string }
  >(
    `
SELECT
  f.id::text AS id,
  f.usage_type,
  f.product_usage_type,
  f.operation,
  f.line_item_description,
  ROUND(COALESCE(f.effective_cost, 0)::numeric, 6)::text AS effective_cost
FROM fact_cost_line_items f
LEFT JOIN dim_service ds ON ds.id = f.service_key
WHERE f.tenant_id = CAST(:tenantId AS UUID)
  AND f.provider_id = CAST(:providerId AS BIGINT)
  AND f.billing_source_id = CAST(:billingSourceId AS BIGINT)
  AND f.ingestion_run_id = CAST(:ingestionRunId AS BIGINT)
  AND (
    COALESCE(ds.service_name, '') = 'AmazonElastiCache'
    OR LOWER(COALESCE(ds.service_name, '')) LIKE '%elasticache%'
    OR LOWER(COALESCE(f.usage_type, '')) LIKE '%redis%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%redis%'
    OR LOWER(COALESCE(f.operation, '')) LIKE '%redis%'
    OR LOWER(COALESCE(f.line_item_description, '')) LIKE '%redis%'
  )
  AND (
    LOWER(COALESCE(f.usage_type, '')) LIKE '%cacheddata%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%cacheddata%'
    OR LOWER(COALESCE(f.line_item_description, '')) LIKE '%redis data storage%'
    OR LOWER(COALESCE(f.line_item_description, '')) LIKE '%data storage%'
  )
ORDER BY f.id DESC
LIMIT 20;
`,
    {
      replacements: opts,
      type: QueryTypes.SELECT,
    },
  );

  const topCostCategoryByEffective = await sequelize.query<
    { cost_category: string; total_cost: string }
  >(
    `
SELECT
  d.cost_category,
  ROUND(COALESCE(SUM(d.effective_cost), 0)::numeric, 6)::text AS total_cost
FROM db_cost_history_daily d
WHERE d.tenant_id = CAST(:tenantId AS UUID)
  AND d.provider_id = CAST(:providerId AS BIGINT)
  AND d.billing_source_id = CAST(:billingSourceId AS BIGINT)
  AND d.ingestion_run_id = CAST(:ingestionRunId AS BIGINT)
GROUP BY d.cost_category
ORDER BY COALESCE(SUM(d.effective_cost), 0) DESC
LIMIT 1;
`,
    {
      replacements: opts,
      type: QueryTypes.SELECT,
    },
  );

  console.info("verify-db-redis-storage-classification: category totals", categoryTotals);
  console.info("verify-db-redis-storage-classification: redis rows by category", redisRowsByCategory);
  console.info(
    "verify-db-redis-storage-classification: redis storage signal source samples (should map to storage after rebuild)",
    redisStorageSignalsInOther,
  );
  const topCostCategoryByBilled = await sequelize.query<
    { cost_category: string; total_cost: string }
  >(
    `
SELECT
  d.cost_category,
  ROUND(COALESCE(SUM(d.billed_cost), 0)::numeric, 6)::text AS total_cost
FROM db_cost_history_daily d
WHERE d.tenant_id = CAST(:tenantId AS UUID)
  AND d.provider_id = CAST(:providerId AS BIGINT)
  AND d.billing_source_id = CAST(:billingSourceId AS BIGINT)
  AND d.ingestion_run_id = CAST(:ingestionRunId AS BIGINT)
GROUP BY d.cost_category
ORDER BY COALESCE(SUM(d.billed_cost), 0) DESC
LIMIT 1;
`,
    {
      replacements: opts,
      type: QueryTypes.SELECT,
    },
  );

  console.info(
    "verify-db-redis-storage-classification: top cost category by effective_cost",
    topCostCategoryByEffective[0] ?? null,
  );
  console.info(
    "verify-db-redis-storage-classification: top cost category by billed_cost",
    topCostCategoryByBilled[0] ?? null,
  );
}

main()
  .catch((error) => {
    console.error(
      "verify-db-redis-storage-classification failed:",
      error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
