import { QueryTypes, Transaction } from "sequelize";

import { sequelize } from "../../../models/index.js";
import { logger } from "../../../utils/logger.js";

type SyncDbCostHistoryForIngestionRunParams = {
  ingestionRunId: string | number;
  tenantId: string;
  providerId: string | number;
  billingSourceId: string | number;
};

type DateRow = { usage_date: string };
type CountRow = { total: string | number };
type SampleFactRow = {
  service: string | null;
  product: string | null;
  usage_type: string | null;
  line_item_type: string | null;
  resource_id: string | null;
};

type DbSyncErrorLike = {
  name?: string;
  message?: string;
  errors?: unknown;
  fields?: unknown;
  parent?: unknown;
  original?: unknown;
  sql?: unknown;
  parameters?: unknown;
};

const EFFECTIVE_USAGE_DATE_SQL = `
COALESCE(
  dd_usage.full_date,
  DATE(COALESCE(f.usage_start_time, f.usage_end_time))
)
`;

const DB_RELATED_FILTER_SQL = `
(
  COALESCE(ds.service_name, '') IN (
    'AmazonRDS',
    'AmazonElastiCache',
    'AmazonDynamoDB',
    'AmazonDocDB',
    'AmazonNeptune',
    'AmazonKeyspaces',
    'AmazonTimestream',
    'AmazonMemoryDB'
  )
  OR LOWER(COALESCE(f.usage_type, '')) LIKE '%aurora%'
  OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%aurora%'
  OR LOWER(COALESCE(f.usage_type, '')) LIKE '%instanceusage:db.%'
  OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%instanceusage:db.%'
  OR LOWER(COALESCE(f.usage_type, '')) LIKE '%cacheddata:redis%'
  OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%cacheddata:redis%'
)
`;

const COST_CATEGORY_SQL = `
CASE
  WHEN LOWER(COALESCE(f.line_item_type, '')) = 'tax' THEN 'tax'
  WHEN LOWER(COALESCE(f.line_item_type, '')) = 'credit' THEN 'credit'
  WHEN LOWER(COALESCE(f.line_item_type, '')) = 'refund' THEN 'refund'
  -- Redis/ElastiCache storage guardrail (regression-safe):
  -- CachedData and Redis data-storage line items are storage semantics, not compute/other.
  -- Keep this branch above generic compute/io/other fallbacks so ingestion cannot drift.
  WHEN (
    COALESCE(ds.service_name, '') IN ('AmazonElastiCache')
    OR LOWER(COALESCE(ds.service_name, '')) LIKE '%elasticache%'
    OR LOWER(COALESCE(f.usage_type, '')) LIKE '%elasticache%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%elasticache%'
    OR LOWER(COALESCE(f.operation, '')) LIKE '%elasticache%'
    OR LOWER(COALESCE(f.line_item_description, '')) LIKE '%elasticache%'
    OR LOWER(COALESCE(f.usage_type, '')) LIKE '%redis%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%redis%'
    OR LOWER(COALESCE(f.operation, '')) LIKE '%redis%'
    OR LOWER(COALESCE(f.line_item_description, '')) LIKE '%redis%'
  ) AND (
    LOWER(COALESCE(f.usage_type, '')) LIKE '%cacheddata%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%cacheddata%'
    OR LOWER(COALESCE(f.line_item_description, '')) LIKE '%redis data storage%'
    OR LOWER(COALESCE(f.line_item_description, '')) LIKE '%data storage%'
  ) THEN 'storage'
  WHEN (
    COALESCE(ds.service_name, '') IN ('AmazonElastiCache', 'AmazonMemoryDB')
    OR LOWER(COALESCE(f.usage_type, '')) LIKE '%elasticache%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%elasticache%'
    OR LOWER(COALESCE(f.usage_type, '')) LIKE '%memorydb%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%memorydb%'
    OR LOWER(COALESCE(f.usage_type, '')) LIKE '%cacheddata:%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%cacheddata:%'
    OR LOWER(COALESCE(f.usage_type, '')) LIKE '%redis%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%redis%'
    OR LOWER(COALESCE(f.line_item_description, '')) LIKE '%redis%'
  ) AND (
    LOWER(COALESCE(f.usage_type, '')) LIKE '%storage%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%storage%'
    OR LOWER(COALESCE(f.usage_type, '')) LIKE '%bytehr%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%bytehr%'
    OR LOWER(COALESCE(f.usage_type, '')) LIKE '%byte-hr%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%byte-hr%'
    OR LOWER(COALESCE(f.usage_type, '')) LIKE '%bytesusedforcache%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%bytesusedforcache%'
    OR LOWER(COALESCE(f.line_item_description, '')) LIKE '%gb-hour%'
    OR LOWER(COALESCE(f.line_item_description, '')) LIKE '%data storage%'
  ) AND (
    LOWER(COALESCE(f.usage_type, '')) NOT LIKE '%nodeusage%'
    AND LOWER(COALESCE(f.product_usage_type, '')) NOT LIKE '%nodeusage%'
    AND LOWER(COALESCE(f.usage_type, '')) NOT LIKE '%ecpuusage%'
    AND LOWER(COALESCE(f.product_usage_type, '')) NOT LIKE '%ecpuusage%'
    AND LOWER(COALESCE(f.usage_type, '')) NOT LIKE '%request%'
    AND LOWER(COALESCE(f.product_usage_type, '')) NOT LIKE '%request%'
    AND LOWER(COALESCE(f.usage_type, '')) NOT LIKE '%io%'
    AND LOWER(COALESCE(f.product_usage_type, '')) NOT LIKE '%io%'
    AND LOWER(COALESCE(f.usage_type, '')) NOT LIKE '%storageio%'
    AND LOWER(COALESCE(f.product_usage_type, '')) NOT LIKE '%storageio%'
    AND LOWER(COALESCE(f.usage_type, '')) NOT LIKE '%snapshot%'
    AND LOWER(COALESCE(f.product_usage_type, '')) NOT LIKE '%snapshot%'
    AND LOWER(COALESCE(f.usage_type, '')) NOT LIKE '%backup%'
    AND LOWER(COALESCE(f.product_usage_type, '')) NOT LIKE '%backup%'
  ) THEN 'storage'
  WHEN (
    COALESCE(ds.service_name, '') IN ('AmazonElastiCache', 'AmazonMemoryDB')
    OR LOWER(COALESCE(f.usage_type, '')) LIKE '%cacheddata:%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%cacheddata:%'
  ) AND (
    LOWER(COALESCE(f.usage_type, '')) LIKE '%nodeusage%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%nodeusage%'
    OR LOWER(COALESCE(f.usage_type, '')) LIKE '%ecpuusage%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%ecpuusage%'
  ) AND (
    LOWER(COALESCE(f.usage_type, '')) NOT LIKE '%storage%'
    AND LOWER(COALESCE(f.product_usage_type, '')) NOT LIKE '%storage%'
    AND LOWER(COALESCE(f.line_item_description, '')) NOT LIKE '%storage%'
    AND LOWER(COALESCE(f.line_item_description, '')) NOT LIKE '%gb-hour%'
    AND LOWER(COALESCE(f.line_item_description, '')) NOT LIKE '%redis data storage%'
  ) THEN 'compute'
  WHEN LOWER(COALESCE(f.usage_type, '')) LIKE '%instanceusage:db.%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%instanceusage:db.%'
    OR LOWER(COALESCE(f.usage_type, '')) LIKE '%aurora:serverlessv2usage%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%aurora:serverlessv2usage%'
    THEN 'compute'
  WHEN (
    COALESCE(ds.service_name, '') IN ('AmazonElastiCache', 'AmazonMemoryDB')
    OR LOWER(COALESCE(f.usage_type, '')) LIKE '%cacheddata:%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%cacheddata:%'
  ) AND (
    LOWER(COALESCE(f.usage_type, '')) LIKE '%cacheddata%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%cacheddata%'
    OR LOWER(COALESCE(f.usage_type, '')) LIKE '%bytesusedforcache%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%bytesusedforcache%'
    OR LOWER(COALESCE(f.usage_type, '')) LIKE '%storageusage%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%storageusage%'
    OR LOWER(COALESCE(f.line_item_description, '')) LIKE '%gb-hour%'
    OR LOWER(COALESCE(f.line_item_description, '')) LIKE '%redis data storage%'
    OR LOWER(COALESCE(f.operation, '')) LIKE '%createserverlesscache%'
  ) AND (
    LOWER(COALESCE(f.usage_type, '')) NOT LIKE '%nodeusage%'
    AND LOWER(COALESCE(f.product_usage_type, '')) NOT LIKE '%nodeusage%'
    AND LOWER(COALESCE(f.usage_type, '')) NOT LIKE '%ecpuusage%'
    AND LOWER(COALESCE(f.product_usage_type, '')) NOT LIKE '%ecpuusage%'
    AND LOWER(COALESCE(f.usage_type, '')) NOT LIKE '%request%'
    AND LOWER(COALESCE(f.product_usage_type, '')) NOT LIKE '%request%'
    AND LOWER(COALESCE(f.usage_type, '')) NOT LIKE '%io%'
    AND LOWER(COALESCE(f.product_usage_type, '')) NOT LIKE '%io%'
  ) THEN 'storage'
  WHEN LOWER(COALESCE(f.usage_type, '')) LIKE '%rds:gp2-storage%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%rds:gp2-storage%'
    OR LOWER(COALESCE(f.usage_type, '')) LIKE '%aurora:storageusage%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%aurora:storageusage%'
    OR (
      LOWER(COALESCE(f.usage_type, '')) LIKE '%storage%'
      OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%storage%'
    )
    AND LOWER(COALESCE(f.usage_type, '')) NOT LIKE '%storageio%'
    AND LOWER(COALESCE(f.product_usage_type, '')) NOT LIKE '%storageio%'
    THEN 'storage'
  WHEN (
    COALESCE(ds.service_name, '') IN ('AmazonElastiCache', 'AmazonMemoryDB')
    OR LOWER(COALESCE(f.usage_type, '')) LIKE '%cacheddata:%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%cacheddata:%'
  ) AND (
    LOWER(COALESCE(f.usage_type, '')) LIKE '%request%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%request%'
    OR LOWER(COALESCE(f.usage_type, '')) LIKE '%io%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%io%'
  ) THEN 'io'
  WHEN LOWER(COALESCE(f.usage_type, '')) LIKE '%aurora:storageiousage%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%aurora:storageiousage%'
    OR LOWER(COALESCE(f.usage_type, '')) LIKE '%storageio%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%storageio%'
    THEN 'io'
  WHEN LOWER(COALESCE(f.usage_type, '')) LIKE '%datatransfer-in-bytes%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%datatransfer-in-bytes%'
    OR LOWER(COALESCE(f.usage_type, '')) LIKE '%datatransfer-out-bytes%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%datatransfer-out-bytes%'
    THEN 'data_transfer'
  WHEN LOWER(COALESCE(f.usage_type, '')) LIKE '%backup%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%backup%'
    OR LOWER(COALESCE(f.usage_type, '')) LIKE '%snapshot%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%snapshot%'
    THEN 'backup'
  ELSE 'other'
END
`;

const DB_ENGINE_SQL = `
CASE
  WHEN COALESCE(ds.service_name, '') = 'AmazonDynamoDB' THEN 'DynamoDB'
  WHEN COALESCE(ds.service_name, '') = 'AmazonElastiCache' THEN 'Redis'
  WHEN LOWER(COALESCE(f.usage_type, '')) LIKE '%aurora%' OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%aurora%' THEN 'Aurora PostgreSQL'
  WHEN LOWER(COALESCE(f.usage_type, '')) LIKE '%cacheddata:redis%' OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%cacheddata:redis%' THEN 'Redis'
  WHEN LOWER(COALESCE(f.line_item_description, '')) LIKE '%running mysql%'
    OR LOWER(COALESCE(f.line_item_description, '')) LIKE '%aurora mysql%'
    OR LOWER(COALESCE(f.operation, '')) LIKE '%mysql%'
    OR LOWER(COALESCE(f.usage_type, '')) LIKE '%mysql%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%mysql%' THEN 'RDS MySQL'
  WHEN LOWER(COALESCE(f.line_item_description, '')) LIKE '%running mariadb%'
    OR LOWER(COALESCE(f.operation, '')) LIKE '%mariadb%'
    OR LOWER(COALESCE(f.usage_type, '')) LIKE '%mariadb%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%mariadb%' THEN 'RDS MariaDB'
  WHEN LOWER(COALESCE(f.line_item_description, '')) LIKE '%running postgresql%'
    OR LOWER(COALESCE(f.line_item_description, '')) LIKE '%running postgres%'
    OR LOWER(COALESCE(f.operation, '')) LIKE '%postgres%'
    OR LOWER(COALESCE(f.usage_type, '')) LIKE '%postgres%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%postgres%' THEN 'RDS PostgreSQL'
  WHEN LOWER(COALESCE(f.line_item_description, '')) LIKE '%running oracle%'
    OR LOWER(COALESCE(f.operation, '')) LIKE '%oracle%'
    OR LOWER(COALESCE(f.usage_type, '')) LIKE '%oracle%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%oracle%' THEN 'RDS Oracle'
  WHEN LOWER(COALESCE(f.line_item_description, '')) LIKE '%running sql server%'
    OR LOWER(COALESCE(f.line_item_description, '')) LIKE '%sqlserver%'
    OR LOWER(COALESCE(f.operation, '')) LIKE '%sqlserver%'
    OR LOWER(COALESCE(f.usage_type, '')) LIKE '%sqlserver%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%sqlserver%' THEN 'RDS SQL Server'
  WHEN LOWER(COALESCE(f.usage_type, '')) LIKE '%instanceusage:db.%' OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%instanceusage:db.%' THEN 'RDS MySQL'
  ELSE 'Unknown'
END
`;

const DB_SERVICE_SQL = `
CASE
  WHEN COALESCE(ds.service_name, '') IN (
    'AmazonRDS',
    'AmazonElastiCache',
    'AmazonDynamoDB',
    'AmazonDocDB',
    'AmazonNeptune',
    'AmazonKeyspaces',
    'AmazonTimestream',
    'AmazonMemoryDB'
  ) THEN ds.service_name
  WHEN LOWER(COALESCE(f.usage_type, '')) LIKE '%cacheddata:redis%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%cacheddata:redis%' THEN 'AmazonElastiCache'
  WHEN LOWER(COALESCE(f.usage_type, '')) LIKE '%aurora%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%aurora%'
    OR LOWER(COALESCE(f.usage_type, '')) LIKE '%instanceusage:db.%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%instanceusage:db.%' THEN 'AmazonRDS'
  ELSE 'Unknown'
END
`;

const RESOURCE_ID_SQL = `
COALESCE(
  NULLIF(dres.resource_id, ''),
  CASE
    WHEN LOWER(COALESCE(f.line_item_type, '')) IN ('tax', 'credit', 'refund') THEN CONCAT('db-scope:', ${DB_SERVICE_SQL})
    ELSE CONCAT(
      'db-unattributed:',
      ${DB_SERVICE_SQL},
      '|',
      COALESCE(f.effective_usage_date, DATE(COALESCE(f.usage_start_time, f.usage_end_time)))::text,
      '|',
      ${COST_CATEGORY_SQL}
    )
  END
)
`;

const toSerializable = (value: unknown): unknown => {
  if (value == null) return value;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  if (typeof value === "object") {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return String(value);
    }
  }
  return value;
};

const buildDbSyncErrorDetails = (error: unknown) => {
  const err = (error ?? {}) as DbSyncErrorLike;
  return {
    name: err?.name ?? null,
    message: err?.message ?? null,
    errors: toSerializable(err?.errors),
    fields: toSerializable(err?.fields),
    parent: toSerializable(err?.parent),
    original: toSerializable(err?.original),
    sql: typeof err?.sql === "string" ? err.sql : null,
    parameters: toSerializable(err?.parameters),
  };
};

async function logDbHistoryInsertDiagnostics({
  ingestionRunId,
  tenantId,
  providerId,
  billingSourceId,
}: {
  ingestionRunId: string;
  tenantId: string;
  providerId: string;
  billingSourceId: string;
}): Promise<void> {
  const rows = await sequelize.query(
    `
SELECT
  f.id,
  ${EFFECTIVE_USAGE_DATE_SQL} AS usage_date,
  ${RESOURCE_ID_SQL} AS resource_id,
  ${DB_SERVICE_SQL} AS db_service,
  ${COST_CATEGORY_SQL} AS cost_category,
  f.billed_cost,
  f.effective_cost,
  f.list_cost,
  f.ingestion_run_id,
  bs.cloud_connection_id
FROM fact_cost_line_items f
LEFT JOIN dim_date dd_usage ON dd_usage.id = f.usage_date_key
LEFT JOIN dim_service ds ON ds.id = f.service_key
LEFT JOIN dim_resource dres ON dres.id = f.resource_key
LEFT JOIN billing_sources bs ON bs.id = f.billing_source_id
WHERE f.tenant_id = CAST(:tenantId AS UUID)
  AND f.provider_id = CAST(:providerId AS BIGINT)
  AND f.billing_source_id = CAST(:billingSourceId AS BIGINT)
  AND f.ingestion_run_id = CAST(:ingestionRunId AS BIGINT)
  AND ${DB_RELATED_FILTER_SQL}
  AND (
    ${EFFECTIVE_USAGE_DATE_SQL} IS NULL
    OR ${RESOURCE_ID_SQL} IS NULL
    OR ${DB_SERVICE_SQL} IS NULL
    OR ${COST_CATEGORY_SQL} IS NULL
    OR ${COST_CATEGORY_SQL} NOT IN ('compute', 'storage', 'io', 'backup', 'data_transfer', 'tax', 'credit', 'refund', 'other')
    OR f.billed_cost IS NULL
    OR f.effective_cost IS NULL
    OR f.list_cost IS NULL
  )
ORDER BY f.id DESC
LIMIT 5;
`,
    {
      replacements: { ingestionRunId, tenantId, providerId, billingSourceId },
      type: QueryTypes.SELECT,
    },
  );

  logger.error("DB processor v1: db_cost_history_daily_insert_validation_candidates", {
    tenantId,
    providerId,
    billingSourceId,
    ingestionRunId,
    count: Array.isArray(rows) ? rows.length : 0,
    sample: Array.isArray(rows) ? rows.slice(0, 1) : [],
  });
}

async function detectDbRowsForRun({
  ingestionRunId,
  tenantId,
  providerId,
  billingSourceId,
}: {
  ingestionRunId: string;
  tenantId: string;
  providerId: string;
  billingSourceId: string;
}): Promise<{ dates: string[]; sourceRows: number }> {
  const sampleRows = await sequelize.query<SampleFactRow>(
    `
SELECT
  NULLIF(ds.service_name, '') AS service,
  NULLIF(f.product_usage_type, '') AS product,
  NULLIF(f.usage_type, '') AS usage_type,
  NULLIF(f.line_item_type, '') AS line_item_type,
  NULLIF(dres.resource_id, '') AS resource_id
FROM fact_cost_line_items f
LEFT JOIN dim_service ds ON ds.id = f.service_key
LEFT JOIN dim_resource dres ON dres.id = f.resource_key
WHERE f.ingestion_run_id = CAST(:ingestionRunId AS BIGINT)
  AND f.tenant_id = CAST(:tenantId AS UUID)
  AND f.provider_id = CAST(:providerId AS BIGINT)
  AND f.billing_source_id = CAST(:billingSourceId AS BIGINT)
ORDER BY f.id DESC
LIMIT 5;
`,
    {
      replacements: { ingestionRunId, tenantId, providerId, billingSourceId },
      type: QueryTypes.SELECT,
    },
  );

  const beforeFilterCountRows = await sequelize.query<CountRow>(
    `
SELECT COUNT(*)::text AS total
FROM fact_cost_line_items f
WHERE f.ingestion_run_id = CAST(:ingestionRunId AS BIGINT)
  AND f.tenant_id = CAST(:tenantId AS UUID)
  AND f.provider_id = CAST(:providerId AS BIGINT)
  AND f.billing_source_id = CAST(:billingSourceId AS BIGINT);
`,
    {
      replacements: { ingestionRunId, tenantId, providerId, billingSourceId },
      type: QueryTypes.SELECT,
    },
  );

  const dates = await sequelize.query<DateRow>(
    `
SELECT DISTINCT ${EFFECTIVE_USAGE_DATE_SQL} AS usage_date
FROM fact_cost_line_items f
LEFT JOIN dim_date dd_usage ON dd_usage.id = f.usage_date_key
LEFT JOIN dim_service ds ON ds.id = f.service_key
WHERE f.ingestion_run_id = CAST(:ingestionRunId AS BIGINT)
  AND f.tenant_id = CAST(:tenantId AS UUID)
  AND f.provider_id = CAST(:providerId AS BIGINT)
  AND f.billing_source_id = CAST(:billingSourceId AS BIGINT)
  AND ${EFFECTIVE_USAGE_DATE_SQL} IS NOT NULL
  AND ${DB_RELATED_FILTER_SQL}
ORDER BY usage_date ASC;
`,
    {
      replacements: { ingestionRunId, tenantId, providerId, billingSourceId },
      type: QueryTypes.SELECT,
    },
  );

  const countRows = await sequelize.query<CountRow>(
    `
SELECT COUNT(*)::text AS total
FROM fact_cost_line_items f
LEFT JOIN dim_service ds ON ds.id = f.service_key
LEFT JOIN dim_date dd_usage ON dd_usage.id = f.usage_date_key
WHERE f.ingestion_run_id = CAST(:ingestionRunId AS BIGINT)
  AND f.tenant_id = CAST(:tenantId AS UUID)
  AND f.provider_id = CAST(:providerId AS BIGINT)
  AND f.billing_source_id = CAST(:billingSourceId AS BIGINT)
  AND ${DB_RELATED_FILTER_SQL};
`,
    {
      replacements: { ingestionRunId, tenantId, providerId, billingSourceId },
      type: QueryTypes.SELECT,
    },
  );

  const sourceRows = Number((countRows[0]?.total as string | number | undefined) ?? 0);
  const rowsBeforeFilter = Number((beforeFilterCountRows[0]?.total as string | number | undefined) ?? 0);

  logger.info(`[DB_PROCESSOR_FETCH]
rows_fetched=${rowsBeforeFilter}
sample_rows=${JSON.stringify(sampleRows.slice(0, 5))}`);

  logger.info(`[DB_PROCESSOR_BEFORE_FILTER]
count=${rowsBeforeFilter}`);

  logger.info(`[DB_PROCESSOR_AFTER_FILTER]
count=${sourceRows}`);

  return {
    dates: dates.map((row) => String(row.usage_date).slice(0, 10)),
    sourceRows,
  };
}

async function rebuildDbCostHistoryDaily({
  transaction,
  dates,
  ingestionRunId,
  tenantId,
  providerId,
  billingSourceId,
}: {
  transaction: Transaction;
  dates: string[];
  ingestionRunId: string;
  tenantId: string;
  providerId: string;
  billingSourceId: string;
}): Promise<number> {
  if (dates.length === 0) return 0;

  const deleteCountRows = await sequelize.query<CountRow>(
    `
SELECT COUNT(*)::text AS total
FROM db_cost_history_daily
WHERE tenant_id = CAST(:tenantId AS UUID)
  AND provider_id = CAST(:providerId AS BIGINT)
  AND billing_source_id = CAST(:billingSourceId AS BIGINT)
  AND usage_date IN (:usageDates);
`,
    {
      replacements: { tenantId, providerId, billingSourceId, usageDates: dates },
      type: QueryTypes.SELECT,
      transaction,
    },
  );
  const deletedRows = Number((deleteCountRows[0]?.total as string | number | undefined) ?? 0);
  logger.info("DB processor v1: db_cost_history_daily_delete_count_ready", {
    tenantId,
    providerId,
    billingSourceId,
    affectedDateCount: dates.length,
    deletedRows,
  });

  await sequelize.query(
    `
DELETE FROM db_cost_history_daily
WHERE tenant_id = CAST(:tenantId AS UUID)
  AND provider_id = CAST(:providerId AS BIGINT)
  AND billing_source_id = CAST(:billingSourceId AS BIGINT)
  AND usage_date IN (:usageDates);
`,
    {
      replacements: { tenantId, providerId, billingSourceId, usageDates: dates },
      type: QueryTypes.DELETE,
      transaction,
    },
  );
  logger.info("DB processor v1: db_cost_history_daily_delete_done", {
    tenantId,
    providerId,
    billingSourceId,
    affectedDateCount: dates.length,
  });

  const [result] = await sequelize.query(
    `
INSERT INTO db_cost_history_daily (
  usage_date,
  month_start,
  tenant_id,
  cloud_connection_id,
  billing_source_id,
  provider_id,
  service_key,
  region_key,
  sub_account_key,
  resource_key,
  resource_id,
  db_service,
  db_engine,
  cost_category,
  billed_cost,
  effective_cost,
  list_cost,
  usage_quantity,
  currency_code,
  ingestion_run_id,
  created_at,
  updated_at
)
SELECT
  x.usage_date,
  DATE_TRUNC('month', x.usage_date)::DATE AS month_start,
  x.tenant_id,
  x.cloud_connection_id,
  MIN(x.billing_source_id) AS billing_source_id,
  MIN(x.provider_id) AS provider_id,
  MIN(x.service_key) AS service_key,
  MIN(x.region_key) AS region_key,
  MIN(x.sub_account_key) AS sub_account_key,
  MIN(x.resource_key) AS resource_key,
  x.resource_id,
  MIN(x.db_service) AS db_service,
  COALESCE(MIN(NULLIF(x.db_engine, 'Unknown')), 'Unknown') AS db_engine,
  x.cost_category,
  COALESCE(SUM(x.billed_cost), 0)::DECIMAL(18,6) AS billed_cost,
  COALESCE(SUM(x.effective_cost), 0)::DECIMAL(18,6) AS effective_cost,
  COALESCE(SUM(x.list_cost), 0)::DECIMAL(18,6) AS list_cost,
  COALESCE(SUM(x.usage_quantity), 0)::DECIMAL(18,6) AS usage_quantity,
  COALESCE(MIN(NULLIF(x.currency_code, '')), 'USD') AS currency_code,
  MIN(x.ingestion_run_id) AS ingestion_run_id,
  NOW(),
  NOW()
FROM (
  WITH ranked_facts AS (
    SELECT
      f.*,
      ${EFFECTIVE_USAGE_DATE_SQL} AS effective_usage_date,
      ROW_NUMBER() OVER (
        PARTITION BY
          f.tenant_id,
          f.provider_id,
          f.billing_source_id,
          ${EFFECTIVE_USAGE_DATE_SQL},
          COALESCE(f.service_key, -1),
          COALESCE(f.sub_account_key, -1),
          COALESCE(f.region_key, -1),
          COALESCE(f.resource_key, -1),
          COALESCE(f.billing_account_key, -1),
          COALESCE(f.usage_type, ''),
          COALESCE(f.product_usage_type, ''),
          COALESCE(f.operation, ''),
          COALESCE(f.line_item_type, ''),
          COALESCE(f.billed_cost, 0),
          COALESCE(f.effective_cost, 0),
          COALESCE(f.list_cost, 0),
          COALESCE(f.consumed_quantity, 0),
          COALESCE(f.usage_start_time, f.usage_end_time)
        ORDER BY
          f.ingestion_run_id DESC NULLS LAST,
          f.id DESC
      ) AS dedupe_rank
    FROM fact_cost_line_items f
    LEFT JOIN dim_date dd_usage ON dd_usage.id = f.usage_date_key
    WHERE f.tenant_id = CAST(:tenantId AS UUID)
      AND f.provider_id = CAST(:providerId AS BIGINT)
      AND f.billing_source_id = CAST(:billingSourceId AS BIGINT)
      AND f.ingestion_run_id = CAST(:ingestionRunId AS BIGINT)
      AND ${EFFECTIVE_USAGE_DATE_SQL} IN (:usageDates)
  )
  SELECT
    f.effective_usage_date AS usage_date,
    f.tenant_id,
    bs.cloud_connection_id,
    f.billing_source_id,
    f.provider_id,
    f.service_key,
    f.region_key,
    f.sub_account_key,
    f.resource_key,
    ${RESOURCE_ID_SQL} AS resource_id,
    ${DB_SERVICE_SQL} AS db_service,
    ${DB_ENGINE_SQL} AS db_engine,
    CASE
      WHEN ${COST_CATEGORY_SQL} IN (
        'compute',
        'storage',
        'io',
        'backup',
        'data_transfer',
        'tax',
        'credit',
        'refund',
        'other'
      ) THEN ${COST_CATEGORY_SQL}
      ELSE 'other'
    END AS cost_category,
    COALESCE(f.billed_cost, 0) AS billed_cost,
    COALESCE(f.effective_cost, 0) AS effective_cost,
    COALESCE(f.list_cost, 0) AS list_cost,
    COALESCE(f.consumed_quantity, 0) AS usage_quantity,
    COALESCE(NULLIF(dba.billing_currency, ''), 'USD') AS currency_code,
    CAST(:ingestionRunId AS BIGINT) AS ingestion_run_id
  FROM ranked_facts f
  LEFT JOIN dim_service ds ON ds.id = f.service_key
  LEFT JOIN dim_resource dres ON dres.id = f.resource_key
  LEFT JOIN dim_region dr ON dr.id = f.region_key
  LEFT JOIN dim_billing_account dba ON dba.id = f.billing_account_key
  LEFT JOIN billing_sources bs ON bs.id = f.billing_source_id
  WHERE f.dedupe_rank = 1
    AND ${DB_RELATED_FILTER_SQL}
) x
GROUP BY
  x.usage_date,
  x.tenant_id,
  x.cloud_connection_id,
  x.resource_id,
  x.cost_category;
`,
    {
      replacements: {
        usageDates: dates,
        ingestionRunId,
        tenantId,
        providerId,
        billingSourceId,
      },
      type: QueryTypes.INSERT,
      transaction,
    },
  );
  logger.info("DB processor v1: db_cost_history_daily_insert_done", {
    tenantId,
    providerId,
    billingSourceId,
    affectedDateCount: dates.length,
  });

  const insertedRows = (result as { rowCount?: number } | undefined)?.rowCount ?? 0;

  logger.info("DB processor v1: db_cost_history_daily_deleted", {
    tenantId,
    providerId,
    billingSourceId,
    affectedDateCount: dates.length,
    deletedRows,
  });

  return insertedRows;
}

async function rebuildFactDbResourceDaily({
  transaction,
  dates,
  tenantId,
  providerId,
  billingSourceId,
}: {
  transaction: Transaction;
  dates: string[];
  tenantId: string;
  providerId: string;
  billingSourceId: string;
}): Promise<number> {
  if (dates.length === 0) return 0;

  const deleteCountRows = await sequelize.query<CountRow>(
    `
SELECT COUNT(*)::text AS total
FROM fact_db_resource_daily
WHERE tenant_id = CAST(:tenantId AS UUID)
  AND provider_id = CAST(:providerId AS BIGINT)
  AND billing_source_id = CAST(:billingSourceId AS BIGINT)
  AND usage_date IN (:usageDates);
`,
    {
      replacements: { tenantId, providerId, billingSourceId, usageDates: dates },
      type: QueryTypes.SELECT,
      transaction,
    },
  );
  const deletedRows = Number((deleteCountRows[0]?.total as string | number | undefined) ?? 0);
  logger.info("DB processor v1: fact_db_resource_daily_delete_count_ready", {
    tenantId,
    providerId,
    billingSourceId,
    affectedDateCount: dates.length,
    deletedRows,
  });

  await sequelize.query(
    `
DELETE FROM fact_db_resource_daily
WHERE tenant_id = CAST(:tenantId AS UUID)
  AND provider_id = CAST(:providerId AS BIGINT)
  AND billing_source_id = CAST(:billingSourceId AS BIGINT)
  AND usage_date IN (:usageDates);
`,
    {
      replacements: { tenantId, providerId, billingSourceId, usageDates: dates },
      type: QueryTypes.DELETE,
      transaction,
    },
  );
  logger.info("DB processor v1: fact_db_resource_daily_delete_done", {
    tenantId,
    providerId,
    billingSourceId,
    affectedDateCount: dates.length,
  });

  const [result] = await sequelize.query(
    `
INSERT INTO fact_db_resource_daily (
  tenant_id,
  cloud_connection_id,
  billing_source_id,
  provider_id,
  usage_date,
  resource_id,
  resource_arn,
  resource_name,
  db_service,
  db_engine,
  resource_type,
  resource_key,
  region_key,
  sub_account_key,
  compute_cost,
  storage_cost,
  io_cost,
  backup_cost,
  data_transfer_cost,
  tax_cost,
  credit_amount,
  refund_amount,
  total_billed_cost,
  total_effective_cost,
  total_list_cost,
  currency_code,
  created_at,
  updated_at
)
SELECT
  d.tenant_id,
  d.cloud_connection_id,
  MIN(d.billing_source_id) AS billing_source_id,
  MIN(d.provider_id) AS provider_id,
  d.usage_date,
  d.resource_id,
  CASE
    WHEN d.resource_id LIKE 'arn:%' THEN d.resource_id
    ELSE NULL
  END AS resource_arn,
  MAX(COALESCE(NULLIF(dr.resource_name, ''), d.resource_id)) AS resource_name,
  MAX(d.db_service) AS db_service,
  COALESCE(MIN(NULLIF(d.db_engine, 'Unknown')), 'Unknown') AS db_engine,
  CASE
    WHEN d.resource_id LIKE 'db-scope:%' THEN 'scoped'
    WHEN LOWER(d.resource_id) LIKE 'arn:aws:rds:%:db:%' THEN 'instance'
    WHEN LOWER(d.resource_id) LIKE 'arn:aws:rds:%:cluster:%' THEN 'cluster'
    WHEN LOWER(d.resource_id) LIKE 'arn:aws:elasticache:%' THEN 'cache'
    ELSE MAX(dr.resource_type)
  END AS resource_type,
  MAX(d.resource_key) AS resource_key,
  MAX(d.region_key) AS region_key,
  MAX(d.sub_account_key) AS sub_account_key,
  COALESCE(SUM(CASE WHEN d.cost_category = 'compute' THEN d.effective_cost ELSE 0 END), 0)::DECIMAL(18,6) AS compute_cost,
  COALESCE(SUM(CASE WHEN d.cost_category = 'storage' THEN d.effective_cost ELSE 0 END), 0)::DECIMAL(18,6) AS storage_cost,
  COALESCE(SUM(CASE WHEN d.cost_category = 'io' THEN d.effective_cost ELSE 0 END), 0)::DECIMAL(18,6) AS io_cost,
  COALESCE(SUM(CASE WHEN d.cost_category = 'backup' THEN d.effective_cost ELSE 0 END), 0)::DECIMAL(18,6) AS backup_cost,
  COALESCE(SUM(CASE WHEN d.cost_category = 'data_transfer' THEN d.effective_cost ELSE 0 END), 0)::DECIMAL(18,6) AS data_transfer_cost,
  COALESCE(SUM(CASE WHEN d.cost_category = 'tax' THEN d.effective_cost ELSE 0 END), 0)::DECIMAL(18,6) AS tax_cost,
  COALESCE(SUM(CASE WHEN d.cost_category = 'credit' THEN d.effective_cost ELSE 0 END), 0)::DECIMAL(18,6) AS credit_amount,
  COALESCE(SUM(CASE WHEN d.cost_category = 'refund' THEN d.effective_cost ELSE 0 END), 0)::DECIMAL(18,6) AS refund_amount,
  COALESCE(SUM(d.billed_cost), 0)::DECIMAL(18,6) AS total_billed_cost,
  COALESCE(SUM(d.effective_cost), 0)::DECIMAL(18,6) AS total_effective_cost,
  COALESCE(SUM(d.list_cost), 0)::DECIMAL(18,6) AS total_list_cost,
  MAX(d.currency_code) AS currency_code,
  NOW(),
  NOW()
FROM db_cost_history_daily d
LEFT JOIN dim_resource dr ON dr.id = d.resource_key
WHERE d.tenant_id = CAST(:tenantId AS UUID)
  AND d.provider_id = CAST(:providerId AS BIGINT)
  AND d.billing_source_id = CAST(:billingSourceId AS BIGINT)
  AND d.usage_date IN (:usageDates)
GROUP BY
  d.tenant_id,
  d.cloud_connection_id,
  d.usage_date,
  d.resource_id;
`,
    {
      replacements: { tenantId, providerId, billingSourceId, usageDates: dates },
      type: QueryTypes.INSERT,
      transaction,
    },
  );
  logger.info("DB processor v1: fact_db_resource_daily_insert_done", {
    tenantId,
    providerId,
    billingSourceId,
    affectedDateCount: dates.length,
  });

  const insertedRows = (result as { rowCount?: number } | undefined)?.rowCount ?? 0;

  logger.info("DB processor v1: fact_db_resource_daily_deleted", {
    tenantId,
    providerId,
    billingSourceId,
    affectedDateCount: dates.length,
    deletedRows,
  });

  return insertedRows;
}

async function syncDbCostHistoryForIngestionRun({
  ingestionRunId,
  tenantId,
  providerId,
  billingSourceId,
}: SyncDbCostHistoryForIngestionRunParams): Promise<{
  skipped: boolean;
  sourceRows: number;
  affectedDates: string[];
  historyRowsWritten: number;
  factRowsWritten: number;
}> {
  const normalized = {
    ingestionRunId: String(ingestionRunId),
    tenantId: String(tenantId),
    providerId: String(providerId),
    billingSourceId: String(billingSourceId),
  };

  logger.info(`[DB_PROCESSOR_START]
runId=${normalized.ingestionRunId}
tenantId=${normalized.tenantId}
providerId=${normalized.providerId}
billingSourceId=${normalized.billingSourceId}`);

  logger.info("DB processor v1: start", normalized);

  const detected = await detectDbRowsForRun(normalized);

  if (detected.dates.length === 0 || detected.sourceRows === 0) {
    logger.info(`[DB_PROCESSOR_SKIPPED]
reason=skipped_no_db_rows`);

    logger.info("DB processor v1: skipped_no_db_rows", {
      ...normalized,
      sourceRows: detected.sourceRows,
    });

    return {
      skipped: true,
      sourceRows: detected.sourceRows,
      affectedDates: [],
      historyRowsWritten: 0,
      factRowsWritten: 0,
    };
  }

  logger.info("DB processor v1: rows_found", {
    ...normalized,
    sourceRows: detected.sourceRows,
    affectedDateCount: detected.dates.length,
    affectedDateStart: detected.dates[0] ?? null,
    affectedDateEnd: detected.dates[detected.dates.length - 1] ?? null,
  });

  let historyRowsWritten = 0;
  let factRowsWritten = 0;

  logger.info(`[DB_PROCESSOR_INSERT_PREP]
count=${detected.sourceRows}`);

  try {
    await sequelize.transaction(async (transaction) => {
      historyRowsWritten = await rebuildDbCostHistoryDaily({
        transaction,
        dates: detected.dates,
        ingestionRunId: normalized.ingestionRunId,
        tenantId: normalized.tenantId,
        providerId: normalized.providerId,
        billingSourceId: normalized.billingSourceId,
      });

      logger.info("DB processor v1: db_cost_history_daily_written", {
        ...normalized,
        historyRowsWritten,
      });

      factRowsWritten = await rebuildFactDbResourceDaily({
        transaction,
        dates: detected.dates,
        tenantId: normalized.tenantId,
        providerId: normalized.providerId,
        billingSourceId: normalized.billingSourceId,
      });

      logger.info("DB processor v1: fact_db_resource_daily_written", {
        ...normalized,
        factRowsWritten,
      });
    });
  } catch (error) {
    logger.error("DB processor v1: sync_failed", {
      ...normalized,
      ...buildDbSyncErrorDetails(error),
    });
    await logDbHistoryInsertDiagnostics(normalized);
    throw error;
  }
  
  logger.info("DB processor v1: done", {
    ...normalized,
    historyRowsWritten,
    factRowsWritten,
  });

  logger.info(`[DB_PROCESSOR_INSERT_DONE]
count=${historyRowsWritten}`);

  return {
    skipped: false,
    sourceRows: detected.sourceRows,
    affectedDates: detected.dates,
    historyRowsWritten,
    factRowsWritten,
  };
}

export { syncDbCostHistoryForIngestionRun };
