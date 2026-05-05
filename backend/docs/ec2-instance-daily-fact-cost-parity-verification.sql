-- Verify parity between fact_ec2_instance_daily and ec2_cost_history_daily
-- for the same tenant_id + instance_id + usage_date.
--
-- Parameters to replace before running:
--   :tenant_id (uuid)
--   :start_date (date)
--   :end_date (date)

WITH history AS (
  SELECT
    d.tenant_id,
    d.instance_id,
    d.usage_date,
    SUM(COALESCE(d.billed_cost, 0))::numeric(18,6) AS history_billed_cost
  FROM ec2_cost_history_daily d
  WHERE d.tenant_id = :tenant_id::uuid
    AND d.usage_date BETWEEN :start_date::date AND :end_date::date
    AND d.instance_id IS NOT NULL
    AND NULLIF(TRIM(d.instance_id), '') IS NOT NULL
  GROUP BY d.tenant_id, d.instance_id, d.usage_date
),
fact AS (
  SELECT
    f.tenant_id,
    f.instance_id,
    f.usage_date,
    SUM(COALESCE(f.total_billed_cost, 0))::numeric(18,6) AS fact_billed_cost
  FROM fact_ec2_instance_daily f
  WHERE f.tenant_id = :tenant_id::uuid
    AND f.usage_date BETWEEN :start_date::date AND :end_date::date
    AND f.instance_id IS NOT NULL
    AND NULLIF(TRIM(f.instance_id), '') IS NOT NULL
  GROUP BY f.tenant_id, f.instance_id, f.usage_date
)
SELECT
  COALESCE(h.tenant_id, f.tenant_id) AS tenant_id,
  COALESCE(h.instance_id, f.instance_id) AS instance_id,
  COALESCE(h.usage_date, f.usage_date) AS usage_date,
  COALESCE(h.history_billed_cost, 0) AS history_billed_cost,
  COALESCE(f.fact_billed_cost, 0) AS fact_billed_cost,
  (COALESCE(f.fact_billed_cost, 0) - COALESCE(h.history_billed_cost, 0))::numeric(18,6) AS delta,
  CASE
    WHEN COALESCE(h.history_billed_cost, 0) = 0 THEN NULL
    ELSE ROUND(COALESCE(f.fact_billed_cost, 0) / NULLIF(h.history_billed_cost, 0), 4)
  END AS ratio
FROM history h
FULL OUTER JOIN fact f
  ON f.tenant_id = h.tenant_id
 AND f.instance_id = h.instance_id
 AND f.usage_date = h.usage_date
WHERE ABS(COALESCE(f.fact_billed_cost, 0) - COALESCE(h.history_billed_cost, 0)) > 0.01
ORDER BY usage_date, instance_id;

