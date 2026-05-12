-- DB Processor v1 validation checklist
-- 1) Confirm the ingestion run has DB-related source rows
SELECT
  f.ingestion_run_id,
  COUNT(*) AS db_source_rows
FROM fact_cost_line_items f
LEFT JOIN dim_service ds ON ds.id = f.service_key
WHERE f.ingestion_run_id = :ingestion_run_id
  AND (
    LOWER(COALESCE(ds.service_name, '')) LIKE '%amazonrds%'
    OR LOWER(COALESCE(ds.service_name, '')) LIKE '%amazon rds%'
    OR LOWER(COALESCE(ds.service_name, '')) LIKE '%rds%'
    OR LOWER(COALESCE(ds.service_name, '')) LIKE '%aurora%'
    OR LOWER(COALESCE(f.usage_type, '')) LIKE '%rds%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%rds%'
    OR LOWER(COALESCE(f.usage_type, '')) LIKE '%aurora%'
    OR LOWER(COALESCE(f.product_usage_type, '')) LIKE '%aurora%'
  )
GROUP BY f.ingestion_run_id;

-- 2) Confirm db_cost_history_daily rows exist for same run/scope
SELECT
  d.ingestion_run_id,
  d.tenant_id,
  d.billing_source_id,
  COUNT(*) AS history_rows,
  MIN(d.usage_date) AS min_usage_date,
  MAX(d.usage_date) AS max_usage_date
FROM db_cost_history_daily d
WHERE d.ingestion_run_id = :ingestion_run_id
GROUP BY d.ingestion_run_id, d.tenant_id, d.billing_source_id;

-- 3) Confirm fact_db_resource_daily rows exist for same scope/date window
SELECT
  f.tenant_id,
  f.billing_source_id,
  COUNT(*) AS fact_rows,
  MIN(f.usage_date) AS min_usage_date,
  MAX(f.usage_date) AS max_usage_date,
  COALESCE(SUM(f.total_effective_cost), 0) AS total_effective_cost
FROM fact_db_resource_daily f
WHERE f.tenant_id = :tenant_id
  AND f.billing_source_id = :billing_source_id
  AND f.usage_date BETWEEN :start_date AND :end_date
GROUP BY f.tenant_id, f.billing_source_id;

-- 4) Quick sample rows for explorer sanity
SELECT
  usage_date,
  db_service,
  db_engine,
  resource_id,
  compute_cost,
  storage_cost,
  io_cost,
  backup_cost,
  total_effective_cost
FROM fact_db_resource_daily
WHERE tenant_id = :tenant_id
  AND billing_source_id = :billing_source_id
  AND usage_date BETWEEN :start_date AND :end_date
ORDER BY usage_date DESC, total_effective_cost DESC
LIMIT 25;
