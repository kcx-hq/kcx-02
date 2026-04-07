import { QueryTypes } from "sequelize";

import { sequelize } from "../../../models/index.js";

type UpsertCostAggregationsForRunParams = {
  ingestionRunId: string | number;
  tenantId: string;
  providerId: string | number;
  billingSourceId?: string | number | null;
  uploadedBy?: string | null;
};

const UPSERT_HOURLY_SQL = `
INSERT INTO agg_cost_hourly (
  hour_start,
  usage_date,
  billing_period_start_date,
  tenant_id,
  billing_source_id,
  ingestion_run_id,
  provider_id,
  uploaded_by,
  service_key,
  sub_account_key,
  region_key,
  billed_cost,
  effective_cost,
  list_cost,
  usage_quantity,
  currency_code,
  created_at,
  updated_at
)
SELECT
  DATE_TRUNC('hour', COALESCE(f.usage_start_time, f.usage_end_time)) AS hour_start,
  DATE(COALESCE(f.usage_start_time, f.usage_end_time)) AS usage_date,
  COALESCE(
    dd_start.full_date,
    dd_usage.full_date,
    DATE(COALESCE(f.usage_start_time, f.usage_end_time))
  ) AS billing_period_start_date,
  CAST(:tenantId AS UUID) AS tenant_id,
  CAST(:billingSourceId AS BIGINT) AS billing_source_id,
  CAST(:ingestionRunId AS BIGINT) AS ingestion_run_id,
  CAST(:providerId AS BIGINT) AS provider_id,
  CAST(:uploadedBy AS UUID) AS uploaded_by,
  COALESCE(f.service_key, 0)::BIGINT AS service_key,
  COALESCE(f.sub_account_key, 0)::BIGINT AS sub_account_key,
  COALESCE(f.region_key, 0)::BIGINT AS region_key,
  COALESCE(SUM(f.billed_cost), 0)::DECIMAL(18,4) AS billed_cost,
  COALESCE(SUM(f.effective_cost), 0)::DECIMAL(18,4) AS effective_cost,
  COALESCE(SUM(f.list_cost), 0)::DECIMAL(18,4) AS list_cost,
  COALESCE(SUM(f.consumed_quantity), 0)::DECIMAL(18,4) AS usage_quantity,
  COALESCE(NULLIF(dba.billing_currency, ''), 'USD') AS currency_code,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM fact_cost_line_items f
LEFT JOIN dim_date dd_start
  ON dd_start.id = f.billing_period_start_date_key
LEFT JOIN dim_date dd_usage
  ON dd_usage.id = f.usage_date_key
LEFT JOIN dim_billing_account dba
  ON dba.id = f.billing_account_key
WHERE f.ingestion_run_id = CAST(:ingestionRunId AS BIGINT)
  AND COALESCE(f.usage_start_time, f.usage_end_time) IS NOT NULL
GROUP BY
  1, 2, 3, 9, 10, 11, 16
ON CONFLICT (
  tenant_id,
  hour_start,
  service_key,
  sub_account_key,
  region_key,
  currency_code
)
DO UPDATE SET
  billed_cost = agg_cost_hourly.billed_cost + EXCLUDED.billed_cost,
  effective_cost = agg_cost_hourly.effective_cost + EXCLUDED.effective_cost,
  list_cost = agg_cost_hourly.list_cost + EXCLUDED.list_cost,
  usage_quantity = agg_cost_hourly.usage_quantity + EXCLUDED.usage_quantity,
  billing_source_id = EXCLUDED.billing_source_id,
  ingestion_run_id = EXCLUDED.ingestion_run_id,
  provider_id = EXCLUDED.provider_id,
  uploaded_by = EXCLUDED.uploaded_by,
  updated_at = CURRENT_TIMESTAMP;
`;

const UPSERT_DAILY_SQL = `
INSERT INTO agg_cost_daily (
  usage_date,
  billing_period_start_date,
  tenant_id,
  billing_source_id,
  ingestion_run_id,
  provider_id,
  uploaded_by,
  service_key,
  sub_account_key,
  region_key,
  billed_cost,
  effective_cost,
  list_cost,
  usage_quantity,
  currency_code,
  created_at,
  updated_at
)
SELECT
  COALESCE(
    dd_usage.full_date,
    DATE(COALESCE(f.usage_start_time, f.usage_end_time))
  ) AS usage_date,
  COALESCE(
    dd_start.full_date,
    dd_usage.full_date,
    DATE(COALESCE(f.usage_start_time, f.usage_end_time))
  ) AS billing_period_start_date,
  CAST(:tenantId AS UUID) AS tenant_id,
  CAST(:billingSourceId AS BIGINT) AS billing_source_id,
  CAST(:ingestionRunId AS BIGINT) AS ingestion_run_id,
  CAST(:providerId AS BIGINT) AS provider_id,
  CAST(:uploadedBy AS UUID) AS uploaded_by,
  COALESCE(f.service_key, 0)::BIGINT AS service_key,
  COALESCE(f.sub_account_key, 0)::BIGINT AS sub_account_key,
  COALESCE(f.region_key, 0)::BIGINT AS region_key,
  COALESCE(SUM(f.billed_cost), 0)::DECIMAL(18,4) AS billed_cost,
  COALESCE(SUM(f.effective_cost), 0)::DECIMAL(18,4) AS effective_cost,
  COALESCE(SUM(f.list_cost), 0)::DECIMAL(18,4) AS list_cost,
  COALESCE(SUM(f.consumed_quantity), 0)::DECIMAL(18,4) AS usage_quantity,
  COALESCE(NULLIF(dba.billing_currency, ''), 'USD') AS currency_code,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM fact_cost_line_items f
LEFT JOIN dim_date dd_start
  ON dd_start.id = f.billing_period_start_date_key
LEFT JOIN dim_date dd_usage
  ON dd_usage.id = f.usage_date_key
LEFT JOIN dim_billing_account dba
  ON dba.id = f.billing_account_key
WHERE f.ingestion_run_id = CAST(:ingestionRunId AS BIGINT)
  AND COALESCE(
    dd_usage.full_date,
    DATE(COALESCE(f.usage_start_time, f.usage_end_time))
  ) IS NOT NULL
GROUP BY
  1, 2, 8, 9, 10, 15
ON CONFLICT (
  tenant_id,
  usage_date,
  service_key,
  sub_account_key,
  region_key,
  currency_code
)
DO UPDATE SET
  billed_cost = agg_cost_daily.billed_cost + EXCLUDED.billed_cost,
  effective_cost = agg_cost_daily.effective_cost + EXCLUDED.effective_cost,
  list_cost = agg_cost_daily.list_cost + EXCLUDED.list_cost,
  usage_quantity = agg_cost_daily.usage_quantity + EXCLUDED.usage_quantity,
  billing_source_id = EXCLUDED.billing_source_id,
  ingestion_run_id = EXCLUDED.ingestion_run_id,
  provider_id = EXCLUDED.provider_id,
  uploaded_by = EXCLUDED.uploaded_by,
  updated_at = CURRENT_TIMESTAMP;
`;

const UPSERT_MONTHLY_SQL = `
INSERT INTO agg_cost_monthly (
  month_start,
  tenant_id,
  billing_source_id,
  ingestion_run_id,
  provider_id,
  uploaded_by,
  service_key,
  sub_account_key,
  region_key,
  billed_cost,
  effective_cost,
  list_cost,
  usage_quantity,
  currency_code,
  created_at,
  updated_at
)
SELECT
  DATE_TRUNC(
    'month',
    COALESCE(
      dd_usage.full_date,
      DATE(COALESCE(f.usage_start_time, f.usage_end_time))
    )
  )::DATE AS month_start,
  CAST(:tenantId AS UUID) AS tenant_id,
  CAST(:billingSourceId AS BIGINT) AS billing_source_id,
  CAST(:ingestionRunId AS BIGINT) AS ingestion_run_id,
  CAST(:providerId AS BIGINT) AS provider_id,
  CAST(:uploadedBy AS UUID) AS uploaded_by,
  COALESCE(f.service_key, 0)::BIGINT AS service_key,
  COALESCE(f.sub_account_key, 0)::BIGINT AS sub_account_key,
  COALESCE(f.region_key, 0)::BIGINT AS region_key,
  COALESCE(SUM(f.billed_cost), 0)::DECIMAL(18,4) AS billed_cost,
  COALESCE(SUM(f.effective_cost), 0)::DECIMAL(18,4) AS effective_cost,
  COALESCE(SUM(f.list_cost), 0)::DECIMAL(18,4) AS list_cost,
  COALESCE(SUM(f.consumed_quantity), 0)::DECIMAL(18,4) AS usage_quantity,
  COALESCE(NULLIF(dba.billing_currency, ''), 'USD') AS currency_code,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM fact_cost_line_items f
LEFT JOIN dim_date dd_usage
  ON dd_usage.id = f.usage_date_key
LEFT JOIN dim_billing_account dba
  ON dba.id = f.billing_account_key
WHERE f.ingestion_run_id = CAST(:ingestionRunId AS BIGINT)
  AND COALESCE(
    dd_usage.full_date,
    DATE(COALESCE(f.usage_start_time, f.usage_end_time))
  ) IS NOT NULL
GROUP BY
  1, 7, 8, 9, 14
ON CONFLICT (
  tenant_id,
  month_start,
  service_key,
  sub_account_key,
  region_key,
  currency_code
)
DO UPDATE SET
  billed_cost = agg_cost_monthly.billed_cost + EXCLUDED.billed_cost,
  effective_cost = agg_cost_monthly.effective_cost + EXCLUDED.effective_cost,
  list_cost = agg_cost_monthly.list_cost + EXCLUDED.list_cost,
  usage_quantity = agg_cost_monthly.usage_quantity + EXCLUDED.usage_quantity,
  billing_source_id = EXCLUDED.billing_source_id,
  ingestion_run_id = EXCLUDED.ingestion_run_id,
  provider_id = EXCLUDED.provider_id,
  uploaded_by = EXCLUDED.uploaded_by,
  updated_at = CURRENT_TIMESTAMP;
`;

async function upsertCostAggregationsForRun({
  ingestionRunId,
  tenantId,
  providerId,
  billingSourceId,
  uploadedBy,
}: UpsertCostAggregationsForRunParams): Promise<void> {
  const replacements = {
    ingestionRunId: String(ingestionRunId),
    tenantId,
    providerId: String(providerId),
    billingSourceId: billingSourceId === null || billingSourceId === undefined ? null : String(billingSourceId),
    uploadedBy: uploadedBy ?? null,
  };

  await sequelize.query(UPSERT_HOURLY_SQL, {
    replacements,
    type: QueryTypes.INSERT,
  });

  await sequelize.query(UPSERT_DAILY_SQL, {
    replacements,
    type: QueryTypes.INSERT,
  });

  await sequelize.query(UPSERT_MONTHLY_SQL, {
    replacements,
    type: QueryTypes.INSERT,
  });
}

export { upsertCostAggregationsForRun };
