import type { QueryInterface } from "sequelize";

const migration = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
DO $$
BEGIN
  -- Ensure the incorrect duplicate row never survives if it mirrors region_id.
  UPDATE dim_region
  SET availability_zone = NULL
  WHERE availability_zone IS NOT NULL
    AND region_id IS NOT NULL
    AND LOWER(BTRIM(availability_zone)) = LOWER(BTRIM(region_id));

  -- Explicit backfill requested: re-point region_key 189 -> 188.
  UPDATE fact_cost_line_items
  SET region_key = 188
  WHERE region_key = 189;

  UPDATE agg_cost_hourly
  SET region_key = 188
  WHERE region_key = 189;

  UPDATE agg_cost_daily
  SET region_key = 188
  WHERE region_key = 189;

  UPDATE agg_cost_monthly
  SET region_key = 188
  WHERE region_key = 189;

  -- Remove the bad dim_region row after re-pointing references.
  DELETE FROM dim_region
  WHERE id = 189;

  -- Full rebuild of aggregates from fact_cost_line_items after backfill.
  TRUNCATE TABLE agg_cost_hourly, agg_cost_daily, agg_cost_monthly;

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
    f.tenant_id,
    f.billing_source_id,
    MAX(f.ingestion_run_id) AS ingestion_run_id,
    f.provider_id,
    NULL::uuid AS uploaded_by,
    COALESCE(f.service_key, 0)::bigint AS service_key,
    COALESCE(f.sub_account_key, 0)::bigint AS sub_account_key,
    f.region_key,
    COALESCE(SUM(f.billed_cost), 0)::numeric(38,18) AS billed_cost,
    COALESCE(SUM(f.effective_cost), 0)::numeric(38,18) AS effective_cost,
    COALESCE(SUM(f.list_cost), 0)::numeric(38,18) AS list_cost,
    COALESCE(SUM(f.consumed_quantity), 0)::numeric(38,18) AS usage_quantity,
    COALESCE(NULLIF(dba.billing_currency, ''), 'USD') AS currency_code,
    NOW(),
    NOW()
  FROM fact_cost_line_items f
  LEFT JOIN dim_date dd_start ON dd_start.id = f.billing_period_start_date_key
  LEFT JOIN dim_date dd_usage ON dd_usage.id = f.usage_date_key
  LEFT JOIN dim_billing_account dba ON dba.id = f.billing_account_key
  WHERE COALESCE(f.usage_start_time, f.usage_end_time) IS NOT NULL
  GROUP BY
    1, 2, 3, 4, 5, 7, 9, 10, 11, 16;

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
    f.tenant_id,
    f.billing_source_id,
    MAX(f.ingestion_run_id) AS ingestion_run_id,
    f.provider_id,
    NULL::uuid AS uploaded_by,
    COALESCE(f.service_key, 0)::bigint AS service_key,
    COALESCE(f.sub_account_key, 0)::bigint AS sub_account_key,
    f.region_key,
    COALESCE(SUM(f.billed_cost), 0)::numeric(38,18) AS billed_cost,
    COALESCE(SUM(f.effective_cost), 0)::numeric(38,18) AS effective_cost,
    COALESCE(SUM(f.list_cost), 0)::numeric(38,18) AS list_cost,
    COALESCE(SUM(f.consumed_quantity), 0)::numeric(38,18) AS usage_quantity,
    COALESCE(NULLIF(dba.billing_currency, ''), 'USD') AS currency_code,
    NOW(),
    NOW()
  FROM fact_cost_line_items f
  LEFT JOIN dim_date dd_start ON dd_start.id = f.billing_period_start_date_key
  LEFT JOIN dim_date dd_usage ON dd_usage.id = f.usage_date_key
  LEFT JOIN dim_billing_account dba ON dba.id = f.billing_account_key
  WHERE COALESCE(
    dd_usage.full_date,
    DATE(COALESCE(f.usage_start_time, f.usage_end_time))
  ) IS NOT NULL
  GROUP BY
    1, 2, 3, 4, 6, 8, 9, 10, 15;

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
    )::date AS month_start,
    f.tenant_id,
    f.billing_source_id,
    MAX(f.ingestion_run_id) AS ingestion_run_id,
    f.provider_id,
    NULL::uuid AS uploaded_by,
    COALESCE(f.service_key, 0)::bigint AS service_key,
    COALESCE(f.sub_account_key, 0)::bigint AS sub_account_key,
    f.region_key,
    COALESCE(SUM(f.billed_cost), 0)::numeric(38,18) AS billed_cost,
    COALESCE(SUM(f.effective_cost), 0)::numeric(38,18) AS effective_cost,
    COALESCE(SUM(f.list_cost), 0)::numeric(38,18) AS list_cost,
    COALESCE(SUM(f.consumed_quantity), 0)::numeric(38,18) AS usage_quantity,
    COALESCE(NULLIF(dba.billing_currency, ''), 'USD') AS currency_code,
    NOW(),
    NOW()
  FROM fact_cost_line_items f
  LEFT JOIN dim_date dd_usage ON dd_usage.id = f.usage_date_key
  LEFT JOIN dim_billing_account dba ON dba.id = f.billing_account_key
  WHERE COALESCE(
    dd_usage.full_date,
    DATE(COALESCE(f.usage_start_time, f.usage_end_time))
  ) IS NOT NULL
  GROUP BY
    1, 2, 3, 5, 7, 8, 9, 14;

  -- Validation: duplicate provider_id + region_id must not exist.
  IF EXISTS (
    SELECT 1
    FROM dim_region
    WHERE region_id IS NOT NULL
    GROUP BY provider_id, region_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'dim_region still has duplicate provider_id + region_id rows';
  END IF;
END $$;
`);
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
-- No reliable down migration for data backfill + aggregate rebuild.
SELECT 1;
`);
  },
};

export default migration;

