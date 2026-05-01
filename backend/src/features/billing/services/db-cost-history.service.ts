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

const EFFECTIVE_USAGE_DATE_SQL = `
COALESCE(
  dd_usage.full_date,
  DATE(COALESCE(f.usage_start_time, f.usage_end_time))
)
`;

const DB_RELATED_FILTER_SQL = `
(
  LOWER(COALESCE(ds.service_name, '')) LIKE '%amazonrds%'
  OR LOWER(COALESCE(ds.service_name, '')) LIKE '%amazon rds%'
  OR LOWER(COALESCE(ds.service_name, '')) LIKE '%rds%'
  OR LOWER(COALESCE(ds.service_name, '')) LIKE '%aurora%'
  OR LOWER(COALESCE(f.usage_type, '')) LIKE '%rds%'
  OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%rds%'
  OR LOWER(COALESCE(f.usage_type, '')) LIKE '%aurora%'
  OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%aurora%'
  OR LOWER(COALESCE(f.usage_type, '')) LIKE '%instanceusage:db.%'
  OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%instanceusage:db.%'
  OR LOWER(COALESCE(f.usage_type, '')) LIKE '%storage%'
  OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%storage%'
  OR LOWER(COALESCE(f.usage_type, '')) LIKE '%storageio%'
  OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%storageio%'
  OR LOWER(COALESCE(f.usage_type, '')) LIKE '%backup%'
  OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%backup%'
)
`;

const COST_CATEGORY_SQL = `
CASE
  WHEN LOWER(COALESCE(f.usage_type, '')) LIKE '%instanceusage%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%instanceusage%'
    OR LOWER(COALESCE(f.usage_type, '')) LIKE '%aurora:serverlessv2usage%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%aurora:serverlessv2usage%'
    THEN 'compute'
  WHEN (
      LOWER(COALESCE(f.usage_type, '')) LIKE '%storage%'
      OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%storage%'
    )
    AND LOWER(COALESCE(f.usage_type, '')) NOT LIKE '%storageio%'
    AND LOWER(COALESCE(f.product_usage_type, '')) NOT LIKE '%storageio%'
    THEN 'storage'
  WHEN LOWER(COALESCE(f.usage_type, '')) LIKE '%storageio%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%storageio%'
    OR LOWER(COALESCE(f.usage_type, '')) LIKE '%io%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%io%'
    THEN 'io'
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
  WHEN LOWER(COALESCE(f.usage_type, '')) LIKE '%aurora%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%aurora%'
    OR LOWER(COALESCE(ds.service_name, '')) LIKE '%aurora%'
    OR LOWER(COALESCE(dres.resource_id, '')) LIKE '%aurora%'
    OR LOWER(COALESCE(dres.resource_name, '')) LIKE '%aurora%'
    THEN 'Aurora'
  WHEN LOWER(COALESCE(ds.service_name, '')) LIKE '%amazonrds%'
    OR LOWER(COALESCE(ds.service_name, '')) LIKE '%amazon rds%'
    OR LOWER(COALESCE(ds.service_name, '')) LIKE '%rds%'
    OR LOWER(COALESCE(f.usage_type, '')) LIKE '%rds%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%rds%'
    THEN 'RDS'
  ELSE 'Unknown'
END
`;

const DB_SERVICE_SQL = `
CASE
  WHEN ${DB_ENGINE_SQL} = 'Aurora' THEN 'Aurora'
  ELSE 'AmazonRDS'
END
`;

const RESOURCE_ID_SQL = `
COALESCE(
  NULLIF(dres.resource_id, ''),
  NULLIF(dres.resource_name, ''),
  CONCAT(
    'db-scope:',
    COALESCE(NULLIF(ds.service_name, ''), 'unknown-service'),
    '|',
    COALESCE(NULLIF(dr.region_id, ''), NULLIF(f.from_region_code, ''), 'unknown-region'),
    '|',
    ${DB_ENGINE_SQL},
    '|',
    COALESCE(f.effective_usage_date, DATE(COALESCE(f.usage_start_time, f.usage_end_time)))::text
  )
)
`;

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
  x.billing_source_id,
  x.provider_id,
  x.service_key,
  x.region_key,
  x.sub_account_key,
  x.resource_key,
  x.resource_id,
  x.db_service,
  x.db_engine,
  x.cost_category,
  COALESCE(SUM(x.billed_cost), 0)::DECIMAL(18,6) AS billed_cost,
  COALESCE(SUM(x.effective_cost), 0)::DECIMAL(18,6) AS effective_cost,
  COALESCE(SUM(x.list_cost), 0)::DECIMAL(18,6) AS list_cost,
  COALESCE(SUM(x.usage_quantity), 0)::DECIMAL(18,6) AS usage_quantity,
  x.currency_code,
  CAST(:ingestionRunId AS BIGINT),
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
    ${COST_CATEGORY_SQL} AS cost_category,
    COALESCE(f.billed_cost, 0) AS billed_cost,
    COALESCE(f.effective_cost, 0) AS effective_cost,
    COALESCE(f.list_cost, 0) AS list_cost,
    COALESCE(f.consumed_quantity, 0) AS usage_quantity,
    COALESCE(NULLIF(dba.billing_currency, ''), 'USD') AS currency_code
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
  x.billing_source_id,
  x.provider_id,
  x.service_key,
  x.region_key,
  x.sub_account_key,
  x.resource_key,
  x.resource_id,
  x.db_service,
  x.db_engine,
  x.cost_category,
  x.currency_code;
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
  d.billing_source_id,
  d.provider_id,
  d.usage_date,
  d.resource_id,
  CASE
    WHEN d.resource_id LIKE 'arn:%' THEN d.resource_id
    ELSE NULL
  END AS resource_arn,
  MAX(COALESCE(NULLIF(dr.resource_name, ''), d.resource_id)) AS resource_name,
  MAX(d.db_service) AS db_service,
  MAX(d.db_engine) AS db_engine,
  MAX(dr.resource_type) AS resource_type,
  MAX(d.resource_key) AS resource_key,
  MAX(d.region_key) AS region_key,
  MAX(d.sub_account_key) AS sub_account_key,
  COALESCE(SUM(CASE WHEN d.cost_category = 'compute' THEN d.effective_cost ELSE 0 END), 0)::DECIMAL(18,6) AS compute_cost,
  COALESCE(SUM(CASE WHEN d.cost_category = 'storage' THEN d.effective_cost ELSE 0 END), 0)::DECIMAL(18,6) AS storage_cost,
  COALESCE(SUM(CASE WHEN d.cost_category = 'io' THEN d.effective_cost ELSE 0 END), 0)::DECIMAL(18,6) AS io_cost,
  COALESCE(SUM(CASE WHEN d.cost_category = 'backup' THEN d.effective_cost ELSE 0 END), 0)::DECIMAL(18,6) AS backup_cost,
  0::DECIMAL(18,6) AS data_transfer_cost,
  0::DECIMAL(18,6) AS tax_cost,
  0::DECIMAL(18,6) AS credit_amount,
  0::DECIMAL(18,6) AS refund_amount,
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
  d.billing_source_id,
  d.provider_id,
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
