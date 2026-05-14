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
type BuildCountDiagnosticsRow = {
  ranked_rows?: string | number | null;
  deduped_rows?: string | number | null;
  classified_rows?: string | number | null;
  grouped_payload_rows?: string | number | null;
  source_history_rows?: string | number | null;
  grouped_fact_rows?: string | number | null;
  null_usage_date_rows?: string | number | null;
  null_resource_id_rows?: string | number | null;
  null_db_service_rows?: string | number | null;
  null_cost_category_rows?: string | number | null;
  scoped_rows?: string | number | null;
  unattributed_rows?: string | number | null;
  unknown_engine_rows?: string | number | null;
  null_billing_source_rows?: string | number | null;
  null_provider_rows?: string | number | null;
  null_tenant_rows?: string | number | null;
};
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
COALESCE(ds.service_name, '') = 'AmazonRDS'
`;

const DB_TEXT_CLASSIFIER_SQL = `
LOWER(CONCAT_WS(
  ' ',
  COALESCE(f.usage_type, ''),
  COALESCE(f.product_usage_type, ''),
  COALESCE(f.line_item_description, ''),
  COALESCE(f.operation, ''),
  COALESCE(f.product_family, '')
))
`;

const COST_CATEGORY_SQL = `
CASE
  WHEN LOWER(COALESCE(f.line_item_type, '')) = 'tax' THEN 'tax'
  WHEN LOWER(COALESCE(f.line_item_type, '')) = 'credit' THEN 'credit'
  WHEN LOWER(COALESCE(f.line_item_type, '')) = 'refund' THEN 'refund'
  WHEN ${DB_TEXT_CLASSIFIER_SQL} LIKE '%backup%'
    OR ${DB_TEXT_CLASSIFIER_SQL} LIKE '%snapshot%'
    THEN 'backup'
  WHEN ${DB_TEXT_CLASSIFIER_SQL} LIKE '%datatransfer%'
    OR ${DB_TEXT_CLASSIFIER_SQL} LIKE '%data transfer%'
    OR ${DB_TEXT_CLASSIFIER_SQL} LIKE '%-bytes%'
    THEN 'data_transfer'
  WHEN ${DB_TEXT_CLASSIFIER_SQL} LIKE '%storageio%'
    OR ${DB_TEXT_CLASSIFIER_SQL} LIKE '%iops%'
    OR ${DB_TEXT_CLASSIFIER_SQL} LIKE '%io request%'
    OR ${DB_TEXT_CLASSIFIER_SQL} LIKE '%io usage%'
    THEN 'io'
  WHEN (
      ${DB_TEXT_CLASSIFIER_SQL} LIKE '%storage%'
      OR ${DB_TEXT_CLASSIFIER_SQL} LIKE '%gb-month%'
      OR ${DB_TEXT_CLASSIFIER_SQL} LIKE '%bytehrs%'
      OR ${DB_TEXT_CLASSIFIER_SQL} LIKE '%gbytehrs%'
      OR ${DB_TEXT_CLASSIFIER_SQL} LIKE '%gp2-storage%'
      OR ${DB_TEXT_CLASSIFIER_SQL} LIKE '%gp3-storage%'
      OR ${DB_TEXT_CLASSIFIER_SQL} LIKE '%magnetic-storage%'
      OR ${DB_TEXT_CLASSIFIER_SQL} LIKE '%provisioned storage%'
      OR ${DB_TEXT_CLASSIFIER_SQL} LIKE '%database storage%'
    )
    AND ${DB_TEXT_CLASSIFIER_SQL} NOT LIKE '%storageio%'
    THEN 'storage'
  WHEN ${DB_TEXT_CLASSIFIER_SQL} LIKE '%instanceusage:db.%'
    OR ${DB_TEXT_CLASSIFIER_SQL} LIKE '%multi-azusage%'
    OR ${DB_TEXT_CLASSIFIER_SQL} LIKE '%multi az usage%'
    OR ${DB_TEXT_CLASSIFIER_SQL} LIKE '%serverlessv2usage%'
    OR ${DB_TEXT_CLASSIFIER_SQL} LIKE '%acu%'
    OR ${DB_TEXT_CLASSIFIER_SQL} LIKE '%vcpu%'
    OR ${DB_TEXT_CLASSIFIER_SQL} LIKE '%database instance%'
    OR ${DB_TEXT_CLASSIFIER_SQL} LIKE '%db instance%'
    THEN 'compute'
  ELSE 'other'
END
`;

const DB_ENGINE_SQL = `
CASE
  WHEN ${DB_TEXT_CLASSIFIER_SQL} LIKE '%aurora postgresql%'
    OR ${DB_TEXT_CLASSIFIER_SQL} LIKE '%aurora-postgresql%'
    OR ${DB_TEXT_CLASSIFIER_SQL} LIKE '%aurora postgres%'
    THEN 'Aurora PostgreSQL'
  WHEN ${DB_TEXT_CLASSIFIER_SQL} LIKE '%aurora mysql%'
    OR ${DB_TEXT_CLASSIFIER_SQL} LIKE '%aurora-mysql%'
    THEN 'Aurora MySQL'
  WHEN ${DB_TEXT_CLASSIFIER_SQL} LIKE '%aurora%'
    THEN 'Aurora'
  WHEN LOWER(COALESCE(f.operation, '')) LIKE '%createdbinstance:0014%'
    THEN 'PostgreSQL'
  WHEN ${DB_TEXT_CLASSIFIER_SQL} LIKE '%postgresql%'
    OR ${DB_TEXT_CLASSIFIER_SQL} LIKE '%postgres%'
    THEN 'PostgreSQL'
  WHEN ${DB_TEXT_CLASSIFIER_SQL} LIKE '%sql server%'
    OR ${DB_TEXT_CLASSIFIER_SQL} LIKE '%sqlserver%'
    THEN 'SQL Server'
  WHEN ${DB_TEXT_CLASSIFIER_SQL} LIKE '%mariadb%'
    THEN 'MariaDB'
  WHEN ${DB_TEXT_CLASSIFIER_SQL} LIKE '%mysql%'
    THEN 'MySQL'
  WHEN ${DB_TEXT_CLASSIFIER_SQL} LIKE '%oracle%'
    THEN 'Oracle'
  ELSE 'Unknown'
END
`;

const DB_SERVICE_SQL = `
'AmazonRDS'
`;

const RESOURCE_ID_SQL = `
COALESCE(
  NULLIF(dres.resource_id, ''),
  CASE
    WHEN LOWER(COALESCE(f.line_item_type, '')) IN ('tax', 'credit', 'refund') THEN 'db-scope:AmazonRDS'
    ELSE CONCAT(
      'db-unattributed:AmazonRDS|',
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

async function logDbCostHistoryBuildDiagnostics({
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
}): Promise<void> {
  const diagnosticsRows = await sequelize.query<BuildCountDiagnosticsRow>(
    `
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
),
classified AS (
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
    COALESCE(NULLIF(dba.billing_currency, ''), 'USD') AS currency_code
  FROM ranked_facts f
  LEFT JOIN dim_service ds ON ds.id = f.service_key
  LEFT JOIN dim_resource dres ON dres.id = f.resource_key
  LEFT JOIN dim_billing_account dba ON dba.id = f.billing_account_key
  LEFT JOIN billing_sources bs ON bs.id = f.billing_source_id
  WHERE f.dedupe_rank = 1
    AND ${DB_RELATED_FILTER_SQL}
),
grouped AS (
  SELECT
    usage_date,
    tenant_id,
    cloud_connection_id,
    resource_id,
    cost_category
  FROM classified
  GROUP BY usage_date, tenant_id, cloud_connection_id, resource_id, cost_category
)
SELECT
  (SELECT COUNT(*) FROM ranked_facts) AS ranked_rows,
  (SELECT COUNT(*) FROM ranked_facts WHERE dedupe_rank = 1) AS deduped_rows,
  (SELECT COUNT(*) FROM classified) AS classified_rows,
  (SELECT COUNT(*) FROM grouped) AS grouped_payload_rows,
  (SELECT COUNT(*) FROM ranked_facts WHERE effective_usage_date IS NULL) AS null_usage_date_rows,
  (SELECT COUNT(*) FROM classified WHERE resource_id IS NULL) AS null_resource_id_rows,
  (SELECT COUNT(*) FROM classified WHERE db_service IS NULL) AS null_db_service_rows,
  (SELECT COUNT(*) FROM classified WHERE cost_category IS NULL) AS null_cost_category_rows,
  (SELECT COUNT(*) FROM classified WHERE resource_id LIKE 'db-scope:%') AS scoped_rows,
  (SELECT COUNT(*) FROM classified WHERE resource_id LIKE 'db-unattributed:%') AS unattributed_rows,
  (SELECT COUNT(*) FROM classified WHERE COALESCE(db_engine, 'Unknown') = 'Unknown') AS unknown_engine_rows,
  (SELECT COUNT(*) FROM classified WHERE billing_source_id IS NULL) AS null_billing_source_rows,
  (SELECT COUNT(*) FROM classified WHERE provider_id IS NULL) AS null_provider_rows,
  (SELECT COUNT(*) FROM classified WHERE tenant_id IS NULL) AS null_tenant_rows;
`,
    {
      replacements: {
        usageDates: dates,
        ingestionRunId,
        tenantId,
        providerId,
        billingSourceId,
      },
      type: QueryTypes.SELECT,
      transaction,
    },
  );

  logger.info("DB processor v1: db_cost_history_daily_build_diagnostics", {
    tenantId,
    providerId,
    billingSourceId,
    ingestionRunId,
    affectedDateCount: dates.length,
    diagnostics: diagnosticsRows[0] ?? null,
  });
}

async function logFactDbResourceDailyBuildDiagnostics({
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
}): Promise<void> {
  const diagnosticsRows = await sequelize.query<BuildCountDiagnosticsRow>(
    `
WITH source_history AS (
  SELECT *
  FROM db_cost_history_daily d
  WHERE d.tenant_id = CAST(:tenantId AS UUID)
    AND d.provider_id = CAST(:providerId AS BIGINT)
    AND d.billing_source_id = CAST(:billingSourceId AS BIGINT)
    AND d.usage_date IN (:usageDates)
),
grouped AS (
  SELECT
    d.tenant_id,
    d.cloud_connection_id,
    d.usage_date,
    d.resource_id
  FROM source_history d
  GROUP BY d.tenant_id, d.cloud_connection_id, d.usage_date, d.resource_id
)
SELECT
  (SELECT COUNT(*) FROM source_history) AS source_history_rows,
  (SELECT COUNT(*) FROM grouped) AS grouped_fact_rows,
  (SELECT COUNT(*) FROM source_history WHERE resource_id IS NULL) AS null_resource_id_rows,
  (SELECT COUNT(*) FROM source_history WHERE db_service IS NULL) AS null_db_service_rows,
  (SELECT COUNT(*) FROM source_history WHERE cost_category IS NULL) AS null_cost_category_rows,
  (SELECT COUNT(*) FROM source_history WHERE resource_id LIKE 'db-scope:%') AS scoped_rows,
  (SELECT COUNT(*) FROM source_history WHERE resource_id LIKE 'db-unattributed:%') AS unattributed_rows,
  (SELECT COUNT(*) FROM source_history WHERE billing_source_id IS NULL) AS null_billing_source_rows,
  (SELECT COUNT(*) FROM source_history WHERE provider_id IS NULL) AS null_provider_rows,
  (SELECT COUNT(*) FROM source_history WHERE tenant_id IS NULL) AS null_tenant_rows;
`,
    {
      replacements: { tenantId, providerId, billingSourceId, usageDates: dates },
      type: QueryTypes.SELECT,
      transaction,
    },
  );

  logger.info("DB processor v1: fact_db_resource_daily_build_diagnostics", {
    tenantId,
    providerId,
    billingSourceId,
    affectedDateCount: dates.length,
    diagnostics: diagnosticsRows[0] ?? null,
  });
}

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

  await logDbCostHistoryBuildDiagnostics({
    transaction,
    dates,
    ingestionRunId,
    tenantId,
    providerId,
    billingSourceId,
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
  re.preferred_engine AS db_engine,
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
LEFT JOIN (
  SELECT
    xe.tenant_id,
    xe.cloud_connection_id,
    xe.resource_id,
    CASE
      WHEN MAX(CASE WHEN xe.db_engine = 'Aurora PostgreSQL' THEN 1 ELSE 0 END) = 1 THEN 'Aurora PostgreSQL'
      WHEN MAX(CASE WHEN xe.db_engine = 'Aurora MySQL' THEN 1 ELSE 0 END) = 1 THEN 'Aurora MySQL'
      WHEN MAX(CASE WHEN xe.db_engine = 'Aurora' THEN 1 ELSE 0 END) = 1 THEN 'Aurora'
      WHEN MAX(CASE WHEN xe.db_engine = 'PostgreSQL' THEN 1 ELSE 0 END) = 1 THEN 'PostgreSQL'
      WHEN MAX(CASE WHEN xe.db_engine = 'MySQL' THEN 1 ELSE 0 END) = 1 THEN 'MySQL'
      WHEN MAX(CASE WHEN xe.db_engine = 'MariaDB' THEN 1 ELSE 0 END) = 1 THEN 'MariaDB'
      WHEN MAX(CASE WHEN xe.db_engine = 'SQL Server' THEN 1 ELSE 0 END) = 1 THEN 'SQL Server'
      WHEN MAX(CASE WHEN xe.db_engine = 'Oracle' THEN 1 ELSE 0 END) = 1 THEN 'Oracle'
      ELSE 'Unknown'
    END AS preferred_engine
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
      f.tenant_id,
      bs.cloud_connection_id,
      ${RESOURCE_ID_SQL} AS resource_id,
      ${DB_ENGINE_SQL} AS db_engine
    FROM ranked_facts f
    LEFT JOIN dim_service ds ON ds.id = f.service_key
    LEFT JOIN dim_resource dres ON dres.id = f.resource_key
    LEFT JOIN billing_sources bs ON bs.id = f.billing_source_id
    WHERE f.dedupe_rank = 1
      AND ${DB_RELATED_FILTER_SQL}
  ) xe
  GROUP BY xe.tenant_id, xe.cloud_connection_id, xe.resource_id
) re
  ON re.tenant_id = x.tenant_id
 AND re.cloud_connection_id = x.cloud_connection_id
 AND re.resource_id = x.resource_id
GROUP BY
  x.usage_date,
  x.tenant_id,
  x.cloud_connection_id,
  x.resource_id,
  x.cost_category,
  re.preferred_engine;
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
  const actualInsertedRowsResult = await sequelize.query<CountRow>(
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
  const actualInsertedRows = Number((actualInsertedRowsResult[0]?.total as string | number | undefined) ?? 0);

  logger.info("DB processor v1: db_cost_history_daily_deleted", {
    tenantId,
    providerId,
    billingSourceId,
    affectedDateCount: dates.length,
    deletedRows,
    insertedRows,
    actualInsertedRows,
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

  await logFactDbResourceDailyBuildDiagnostics({
    transaction,
    dates,
    tenantId,
    providerId,
    billingSourceId,
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
  CASE
    WHEN MAX(CASE WHEN d.db_engine = 'Aurora PostgreSQL' THEN 1 ELSE 0 END) = 1 THEN 'Aurora PostgreSQL'
    WHEN MAX(CASE WHEN d.db_engine = 'Aurora MySQL' THEN 1 ELSE 0 END) = 1 THEN 'Aurora MySQL'
    WHEN MAX(CASE WHEN d.db_engine = 'Aurora' THEN 1 ELSE 0 END) = 1 THEN 'Aurora'
    WHEN MAX(CASE WHEN d.db_engine = 'PostgreSQL' THEN 1 ELSE 0 END) = 1 THEN 'PostgreSQL'
    WHEN MAX(CASE WHEN d.db_engine = 'MySQL' THEN 1 ELSE 0 END) = 1 THEN 'MySQL'
    WHEN MAX(CASE WHEN d.db_engine = 'MariaDB' THEN 1 ELSE 0 END) = 1 THEN 'MariaDB'
    WHEN MAX(CASE WHEN d.db_engine = 'SQL Server' THEN 1 ELSE 0 END) = 1 THEN 'SQL Server'
    WHEN MAX(CASE WHEN d.db_engine = 'Oracle' THEN 1 ELSE 0 END) = 1 THEN 'Oracle'
    ELSE 'Unknown'
  END AS db_engine,
  CASE
    WHEN d.resource_id = 'db-scope:AmazonRDS' THEN 'scoped'
    WHEN LOWER(d.resource_id) LIKE 'arn:aws:rds:%:db:%' THEN 'instance'
    WHEN LOWER(d.resource_id) LIKE 'arn:aws:rds:%:cluster:%' THEN 'cluster'
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
  const actualInsertedRowsResult = await sequelize.query<CountRow>(
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
  const actualInsertedRows = Number((actualInsertedRowsResult[0]?.total as string | number | undefined) ?? 0);

  logger.info("DB processor v1: fact_db_resource_daily_deleted", {
    tenantId,
    providerId,
    billingSourceId,
    affectedDateCount: dates.length,
    deletedRows,
    insertedRows,
    actualInsertedRows,
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
