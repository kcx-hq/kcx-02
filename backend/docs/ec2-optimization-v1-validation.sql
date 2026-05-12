-- EC2 Optimization V1 validation checks (rules-based, dynamic, no materialized optimization table)
-- Replace the named parameters before execution:
-- :tenant_id, :date_from, :date_to, :cloud_connection_id, :billing_source_id, :region_key, :sub_account_key

WITH aggregated AS (
  SELECT
    fed.instance_id,
    COALESCE(NULLIF(TRIM(MAX(COALESCE(fed.instance_name, ''))), ''), fed.instance_id) AS instance_name,
    COALESCE(NULLIF(TRIM(MAX(COALESCE(fed.instance_type, ''))), ''), NULL) AS instance_type,
    MAX(fed.cloud_connection_id)::text AS cloud_connection_id,
    MAX(fed.billing_source_id)::bigint AS billing_source_id,
    MAX(fed.region_key)::bigint AS region_key,
    MAX(fed.sub_account_key)::bigint AS sub_account_key,
    MAX(fed.availability_zone) AS availability_zone,
    MAX(fed.state) AS state,
    BOOL_OR(COALESCE(fed.is_running, FALSE)) AS is_running,
    LOWER(
      COALESCE(
        NULLIF(TRIM(MAX(COALESCE(fed.reservation_type, ''))), ''),
        NULLIF(TRIM(MAX(COALESCE(fed.pricing_model, ''))), ''),
        CASE WHEN BOOL_OR(COALESCE(fed.is_spot, FALSE)) THEN 'spot' ELSE 'on_demand' END
      )
    ) AS reservation_type,
    AVG(fed.cpu_avg::double precision) FILTER (WHERE fed.cpu_avg IS NOT NULL) AS avg_cpu,
    MAX(fed.cpu_max::double precision) FILTER (WHERE fed.cpu_max IS NOT NULL) AS peak_cpu,
    AVG((COALESCE(fed.network_in_bytes, 0) + COALESCE(fed.network_out_bytes, 0))::double precision) AS avg_daily_network_bytes,
    SUM(COALESCE(fed.total_hours, 0))::double precision AS running_hours,
    COUNT(DISTINCT CASE WHEN COALESCE(fed.total_hours, 0) > 0 THEN fed.usage_date END)::int AS running_day_count,
    SUM(COALESCE(fed.compute_cost, 0))::double precision AS compute_cost,
    SUM(COALESCE(fed.total_effective_cost, 0))::double precision AS total_effective_cost,
    SUM(COALESCE(fed.total_billed_cost, 0))::double precision AS total_billed_cost,
    BOOL_OR(LOWER(COALESCE(fed.reservation_type, fed.pricing_model, 'on_demand')) IN ('reserved', 'savings_plan'))
      AS has_reserved_or_savings_plan_coverage
  FROM fact_ec2_instance_daily fed
  WHERE fed.tenant_id = :tenant_id::uuid
    AND fed.usage_date >= :date_from::date
    AND fed.usage_date < (:date_to::date + INTERVAL '1 day')
    AND (:cloud_connection_id::uuid IS NULL OR fed.cloud_connection_id = :cloud_connection_id::uuid)
    AND (:billing_source_id::bigint IS NULL OR fed.billing_source_id = :billing_source_id::bigint)
    AND (:region_key::bigint IS NULL OR fed.region_key = :region_key::bigint)
    AND (:sub_account_key::bigint IS NULL OR fed.sub_account_key = :sub_account_key::bigint)
  GROUP BY fed.instance_id
),
classified AS (
  SELECT
    a.*,
    CASE
      WHEN a.running_hours >= 24
        AND a.total_effective_cost >= 1
        AND a.avg_cpu IS NOT NULL
        AND a.avg_cpu < 5
        AND a.avg_daily_network_bytes < (100 * 1024 * 1024)
        THEN 'idle'
      WHEN a.running_hours >= 24
        AND a.total_effective_cost >= 1
        AND a.avg_cpu IS NOT NULL
        AND a.avg_cpu BETWEEN 5 AND 20
        AND a.avg_daily_network_bytes < (1024 * 1024 * 1024)
        THEN 'underutilized'
      WHEN a.running_hours >= 24
        AND a.total_effective_cost >= 1
        AND a.avg_cpu IS NOT NULL
        AND a.avg_cpu > 75
        THEN 'overutilized'
      WHEN a.running_hours >= 24
        AND a.compute_cost >= 1
        AND a.reservation_type = 'on_demand'
        AND a.running_day_count >= 2
        AND a.has_reserved_or_savings_plan_coverage = FALSE
        THEN 'uncovered_on_demand'
      ELSE NULL
    END AS optimization_type
  FROM aggregated a
),
high_cost AS (
  SELECT
    c.instance_id,
    ROW_NUMBER() OVER (ORDER BY c.total_effective_cost DESC, c.instance_id ASC) AS cost_rank
  FROM classified c
  WHERE c.running_hours >= 24
    AND c.total_effective_cost >= 1
)

-- 1) idle instances result set
SELECT * FROM classified WHERE optimization_type = 'idle' ORDER BY total_effective_cost DESC;

-- 2) underutilized instances result set
SELECT * FROM classified WHERE optimization_type = 'underutilized' ORDER BY total_effective_cost DESC;

-- 3) overutilized instances result set
SELECT * FROM classified WHERE optimization_type = 'overutilized' ORDER BY total_effective_cost DESC;

-- 4) uncovered on-demand instances result set
SELECT * FROM classified WHERE optimization_type = 'uncovered_on_demand' ORDER BY total_effective_cost DESC;

-- 5) high-cost result set (top 10 by total effective cost)
SELECT c.*
FROM classified c
JOIN high_cost h ON h.instance_id = c.instance_id
WHERE h.cost_rank <= 10
ORDER BY h.cost_rank ASC;

-- 6) no overlap errors between Idle / Underutilized / Overutilized
SELECT
  COUNT(*) FILTER (
    WHERE running_hours >= 24 AND total_effective_cost >= 1 AND avg_cpu IS NOT NULL
      AND avg_cpu < 5
      AND avg_cpu BETWEEN 5 AND 20
  ) AS idle_and_underutilized_overlap,
  COUNT(*) FILTER (
    WHERE running_hours >= 24 AND total_effective_cost >= 1 AND avg_cpu IS NOT NULL
      AND avg_cpu < 5
      AND avg_cpu > 75
  ) AS idle_and_overutilized_overlap,
  COUNT(*) FILTER (
    WHERE running_hours >= 24 AND total_effective_cost >= 1 AND avg_cpu IS NOT NULL
      AND avg_cpu BETWEEN 5 AND 20
      AND avg_cpu > 75
  ) AS underutilized_and_overutilized_overlap
FROM classified;

-- 7) summary totals match list totals
SELECT
  COUNT(*) FILTER (WHERE optimization_type = 'idle') AS idle_count,
  COUNT(*) FILTER (WHERE optimization_type = 'underutilized') AS underutilized_count,
  COUNT(*) FILTER (WHERE optimization_type = 'overutilized') AS overutilized_count,
  COUNT(*) FILTER (WHERE optimization_type = 'uncovered_on_demand') AS uncovered_count,
  COUNT(*) FILTER (WHERE instance_id IN (SELECT instance_id FROM high_cost WHERE cost_rank <= 10)) AS high_cost_count,
  SUM(
    CASE optimization_type
      WHEN 'idle' THEN compute_cost
      WHEN 'underutilized' THEN compute_cost * 0.3
      WHEN 'uncovered_on_demand' THEN compute_cost * 0.2
      ELSE 0
    END
  )::double precision AS estimated_savings_total
FROM classified;

-- 8) sample rows with reason + estimated savings
SELECT
  c.instance_id,
  c.instance_name,
  c.optimization_type,
  CASE
    WHEN c.optimization_type = 'idle'
      THEN 'Running with very low CPU and low network activity while still incurring cost'
    WHEN c.optimization_type = 'underutilized'
      THEN 'Running with consistently low CPU usage relative to cost'
    WHEN c.optimization_type = 'overutilized'
      THEN 'Running with sustained high CPU usage and potential performance pressure'
    WHEN c.optimization_type = 'uncovered_on_demand'
      THEN 'Running on on-demand pricing with recurring usage and potential commitment savings opportunity'
    WHEN c.instance_id IN (SELECT instance_id FROM high_cost WHERE cost_rank <= 10)
      THEN 'Among the highest cost contributors in the selected period'
    ELSE NULL
  END AS reason,
  CASE
    WHEN c.optimization_type = 'idle' THEN c.compute_cost
    WHEN c.optimization_type = 'underutilized' THEN c.compute_cost * 0.3
    WHEN c.optimization_type = 'uncovered_on_demand' THEN c.compute_cost * 0.2
    ELSE 0
  END::double precision AS estimated_savings
FROM classified c
WHERE c.optimization_type IS NOT NULL
   OR c.instance_id IN (SELECT instance_id FROM high_cost WHERE cost_rank <= 10)
ORDER BY c.total_effective_cost DESC
LIMIT 25;
