-- EC2 join ambiguity verification
-- Use with :tenant_id, :start_date, :end_date, optional :cloud_connection_id, :billing_source_id

-- 1) Volume inventory -> fact_ebs_volume_daily should not fan out across connections.
SELECT
  inv.tenant_id,
  inv.volume_id,
  inv.cloud_connection_id,
  COUNT(DISTINCT fvd.cloud_connection_id) AS matched_fact_connections
FROM ec2_volume_inventory_snapshots inv
LEFT JOIN fact_ebs_volume_daily fvd
  ON fvd.tenant_id = inv.tenant_id
 AND fvd.volume_id = inv.volume_id
 AND fvd.usage_date BETWEEN CAST(:start_date AS date) AND CAST(:end_date AS date)
WHERE inv.tenant_id = CAST(:tenant_id AS uuid)
  AND inv.is_current = TRUE
  AND inv.deleted_at IS NULL
  AND (CAST(:cloud_connection_id AS uuid) IS NULL OR inv.cloud_connection_id = CAST(:cloud_connection_id AS uuid))
GROUP BY inv.tenant_id, inv.volume_id, inv.cloud_connection_id
HAVING COUNT(DISTINCT fvd.cloud_connection_id) > 1;

-- 2) Snapshot cost joins should resolve within connection/billing scope.
WITH snapshot_cost AS (
  SELECT
    f.cloud_connection_id,
    f.billing_source_id,
    dr.resource_id AS snapshot_id,
    SUM(COALESCE(f.effective_cost, f.billed_cost, 0)) AS total_cost
  FROM fact_cost_line_items f
  INNER JOIN dim_resource dr
    ON dr.id = f.resource_key
   AND dr.tenant_id = f.tenant_id
  WHERE f.tenant_id = CAST(:tenant_id AS uuid)
    AND f.usage_start_time >= CAST(:start_date AS date)
    AND f.usage_start_time < (CAST(:end_date AS date) + INTERVAL '1 day')
    AND LOWER(COALESCE(dr.resource_type, '')) = 'ec2_snapshot'
    AND (CAST(:cloud_connection_id AS uuid) IS NULL OR f.cloud_connection_id = CAST(:cloud_connection_id AS uuid))
    AND (CAST(:billing_source_id AS bigint) IS NULL OR f.billing_source_id = CAST(:billing_source_id AS bigint))
  GROUP BY f.cloud_connection_id, f.billing_source_id, dr.resource_id
)
SELECT
  inv.snapshot_id,
  inv.cloud_connection_id,
  COUNT(*) AS scoped_matches
FROM ec2_snapshot_inventory_snapshots inv
LEFT JOIN snapshot_cost sc
  ON sc.snapshot_id = inv.snapshot_id
 AND sc.cloud_connection_id IS NOT DISTINCT FROM inv.cloud_connection_id
 AND sc.billing_source_id IS NOT DISTINCT FROM CAST(:billing_source_id AS bigint)
WHERE inv.tenant_id = CAST(:tenant_id AS uuid)
  AND inv.is_current = TRUE
GROUP BY inv.snapshot_id, inv.cloud_connection_id
HAVING COUNT(*) > 1;
