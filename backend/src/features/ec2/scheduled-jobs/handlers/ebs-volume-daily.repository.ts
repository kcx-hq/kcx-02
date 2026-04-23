import { QueryTypes } from "sequelize";

import { sequelize } from "../../../../models/index.js";

type SyncEbsVolumeDailyParams = {
  tenantId?: string;
  startDate: string;
  endDate: string;
};

type UpsertedRowsResult = {
  upserted_rows: number | string;
  idle_count: number | string;
  unattached_count: number | string;
  warning_count: number | string;
};

export class EbsVolumeDailyRepository {
  async syncEbsVolumeDaily(params: SyncEbsVolumeDailyParams): Promise<{
    rowsUpserted: number;
    idleCount: number;
    unattachedCount: number;
    warningCount: number;
  }> {
    const rows = await sequelize.query<UpsertedRowsResult>(
      `
WITH cost_source AS (
  SELECT
    f.tenant_id,
    bs.cloud_connection_id,
    f.billing_source_id,
    f.provider_id,
    COALESCE(dd_usage.full_date, DATE(COALESCE(f.usage_start_time, f.usage_end_time))) AS usage_date,
    LOWER(TRIM(dr.resource_id)) AS volume_id,
    f.resource_key,
    f.region_key,
    f.sub_account_key,
    -- Keep cost basis aligned with existing EC2 daily cost facts (billed_cost).
    COALESCE(f.billed_cost, 0)::numeric(18,6) AS cost_amount,
    COALESCE(NULLIF(TRIM(dba.billing_currency), ''), 'USD') AS currency_code,
    (
      COALESCE(f.tax_cost, 0) <> 0
      OR COALESCE(f.credit_amount, 0) <> 0
      OR COALESCE(f.refund_amount, 0) <> 0
      OR LOWER(COALESCE(f.line_item_type, '')) LIKE '%tax%'
      OR LOWER(COALESCE(f.line_item_type, '')) LIKE '%credit%'
      OR LOWER(COALESCE(f.line_item_type, '')) LIKE '%refund%'
    ) AS is_adjustment_like,
    LOWER(
      CONCAT_WS(
        ' ',
        COALESCE(f.usage_type, ''),
        COALESCE(f.operation, ''),
        COALESCE(f.line_item_type, ''),
        COALESCE(dc.charge_category, ''),
        COALESCE(dc.charge_class, ''),
        COALESCE(ds.service_name, '')
      )
    ) AS classifier_text
  FROM fact_cost_line_items f
  INNER JOIN dim_resource dr
    ON dr.id = f.resource_key
   AND dr.tenant_id = f.tenant_id
   AND dr.provider_id = f.provider_id
  LEFT JOIN dim_date dd_usage
    ON dd_usage.id = f.usage_date_key
  LEFT JOIN dim_billing_account dba
    ON dba.id = f.billing_account_key
  LEFT JOIN dim_charge dc
    ON dc.id = f.charge_key
  LEFT JOIN dim_service ds
    ON ds.id = f.service_key
  LEFT JOIN billing_sources bs
    ON bs.id = f.billing_source_id
  WHERE COALESCE(dd_usage.full_date, DATE(COALESCE(f.usage_start_time, f.usage_end_time))) >= CAST(:startDate AS date)
    AND COALESCE(dd_usage.full_date, DATE(COALESCE(f.usage_start_time, f.usage_end_time))) <= CAST(:endDate AS date)
    AND (CAST(:tenantId AS uuid) IS NULL OR f.tenant_id = CAST(:tenantId AS uuid))
    AND LOWER(TRIM(COALESCE(dr.resource_id, ''))) ~ '^vol-[a-z0-9]+$'
),
classified AS (
  SELECT
    s.*,
    CASE
      -- Conservative split:
      -- 1) Adjustment-like lines stay out of storage/io/throughput split
      --    while still contributing to total_cost.
      -- 2) Throughput/IO are matched only on explicit keywords.
      -- 3) Remaining attributable volume cost falls back to storage.
      WHEN s.is_adjustment_like THEN 'uncategorized'
      WHEN s.classifier_text LIKE '%throughput%' THEN 'throughput'
      WHEN s.classifier_text ~ '(iops|piops|i\\/o|io[ -]?requests?)' THEN 'io'
      ELSE 'storage'
    END AS cost_bucket
  FROM cost_source s
),
cost_agg AS (
  SELECT
    c.tenant_id,
    c.usage_date,
    c.volume_id,
    (ARRAY_AGG(c.cloud_connection_id
      ORDER BY CASE WHEN c.cloud_connection_id IS NULL THEN 1 ELSE 0 END, ABS(c.cost_amount) DESC, c.cloud_connection_id)
      FILTER (WHERE c.cloud_connection_id IS NOT NULL))[1] AS cloud_connection_id,
    (ARRAY_AGG(c.billing_source_id
      ORDER BY CASE WHEN c.billing_source_id IS NULL THEN 1 ELSE 0 END, ABS(c.cost_amount) DESC, c.billing_source_id)
      FILTER (WHERE c.billing_source_id IS NOT NULL))[1] AS billing_source_id,
    (ARRAY_AGG(c.provider_id
      ORDER BY CASE WHEN c.provider_id IS NULL THEN 1 ELSE 0 END, ABS(c.cost_amount) DESC, c.provider_id)
      FILTER (WHERE c.provider_id IS NOT NULL))[1] AS provider_id,
    (ARRAY_AGG(c.resource_key
      ORDER BY CASE WHEN c.resource_key IS NULL THEN 1 ELSE 0 END, ABS(c.cost_amount) DESC, c.resource_key)
      FILTER (WHERE c.resource_key IS NOT NULL))[1] AS resource_key,
    (ARRAY_AGG(c.region_key
      ORDER BY CASE WHEN c.region_key IS NULL THEN 1 ELSE 0 END, ABS(c.cost_amount) DESC, c.region_key)
      FILTER (WHERE c.region_key IS NOT NULL))[1] AS region_key,
    (ARRAY_AGG(c.sub_account_key
      ORDER BY CASE WHEN c.sub_account_key IS NULL THEN 1 ELSE 0 END, ABS(c.cost_amount) DESC, c.sub_account_key)
      FILTER (WHERE c.sub_account_key IS NOT NULL))[1] AS sub_account_key,
    (ARRAY_AGG(c.currency_code
      ORDER BY CASE WHEN NULLIF(TRIM(c.currency_code), '') IS NULL THEN 1 ELSE 0 END, ABS(c.cost_amount) DESC, c.currency_code)
      FILTER (WHERE NULLIF(TRIM(c.currency_code), '') IS NOT NULL))[1] AS currency_code,
    SUM(CASE WHEN c.cost_bucket = 'storage' THEN c.cost_amount ELSE 0 END)::numeric(18,6) AS storage_cost,
    SUM(CASE WHEN c.cost_bucket = 'io' THEN c.cost_amount ELSE 0 END)::numeric(18,6) AS io_cost,
    SUM(CASE WHEN c.cost_bucket = 'throughput' THEN c.cost_amount ELSE 0 END)::numeric(18,6) AS throughput_cost,
    SUM(c.cost_amount)::numeric(18,6) AS total_cost
  FROM classified c
  GROUP BY c.tenant_id, c.usage_date, c.volume_id
),
utilization_daily AS (
  SELECT
    u.tenant_id,
    u.usage_date,
    LOWER(TRIM(u.volume_id)) AS volume_id,
    u.read_bytes,
    u.write_bytes,
    u.read_ops,
    u.write_ops,
    u.queue_length_max,
    u.burst_balance_avg,
    u.idle_time_avg
  FROM ebs_volume_utilization_daily u
  WHERE u.usage_date >= CAST(:startDate AS date)
    AND u.usage_date <= CAST(:endDate AS date)
    AND (CAST(:tenantId AS uuid) IS NULL OR u.tenant_id = CAST(:tenantId AS uuid))
),
enriched AS (
  SELECT
    a.tenant_id,
    COALESCE(inv.cloud_connection_id, a.cloud_connection_id) AS cloud_connection_id,
    a.billing_source_id,
    COALESCE(inv.provider_id, a.provider_id) AS provider_id,
    a.usage_date,
    a.volume_id,
    COALESCE(inv.resource_key, a.resource_key) AS resource_key,
    COALESCE(inv.region_key, a.region_key) AS region_key,
    COALESCE(inv.sub_account_key, a.sub_account_key) AS sub_account_key,
    inv.volume_type,
    inv.size_gb,
    inv.iops,
    inv.throughput,
    inv.availability_zone,
    inv.state,
    inv.attached_instance_id,
    CASE
      WHEN inv.is_attached IS NOT NULL THEN inv.is_attached
      WHEN NULLIF(TRIM(inv.attached_instance_id), '') IS NOT NULL THEN TRUE
      ELSE FALSE
    END AS is_attached,
    a.storage_cost,
    a.io_cost,
    a.throughput_cost,
    a.total_cost,
    COALESCE(NULLIF(TRIM(a.currency_code), ''), 'USD') AS currency_code,
    inst.state AS attached_instance_state,
    u.read_bytes,
    u.write_bytes,
    u.read_ops,
    u.write_ops,
    u.queue_length_max,
    u.burst_balance_avg,
    u.idle_time_avg
  FROM cost_agg a
  LEFT JOIN LATERAL (
    SELECT
      v.cloud_connection_id,
      v.provider_id,
      v.resource_key,
      v.region_key,
      v.sub_account_key,
      v.volume_type,
      v.size_gb,
      v.iops,
      v.throughput,
      v.availability_zone,
      v.state,
      v.attached_instance_id,
      v.is_attached
    FROM ec2_volume_inventory_snapshots v
    WHERE v.tenant_id = a.tenant_id
      AND LOWER(TRIM(v.volume_id)) = a.volume_id
    ORDER BY
      CASE WHEN v.cloud_connection_id IS NOT DISTINCT FROM a.cloud_connection_id THEN 0 ELSE 1 END,
      CASE WHEN v.provider_id IS NOT DISTINCT FROM a.provider_id THEN 0 ELSE 1 END,
      CASE WHEN v.discovered_at::date <= a.usage_date THEN 0 ELSE 1 END,
      CASE WHEN v.discovered_at::date <= a.usage_date THEN v.discovered_at END DESC,
      CASE WHEN v.discovered_at::date > a.usage_date THEN v.discovered_at END ASC,
      v.is_current DESC,
      v.updated_at DESC
    LIMIT 1
  ) inv ON TRUE
  LEFT JOIN LATERAL (
    SELECT
      i.state
    FROM ec2_instance_inventory_snapshots i
    WHERE i.tenant_id = a.tenant_id
      AND NULLIF(TRIM(COALESCE(inv.attached_instance_id, '')), '') IS NOT NULL
      AND LOWER(TRIM(i.instance_id)) = LOWER(TRIM(inv.attached_instance_id))
    ORDER BY
      CASE WHEN i.cloud_connection_id IS NOT DISTINCT FROM COALESCE(inv.cloud_connection_id, a.cloud_connection_id) THEN 0 ELSE 1 END,
      CASE WHEN i.provider_id IS NOT DISTINCT FROM COALESCE(inv.provider_id, a.provider_id) THEN 0 ELSE 1 END,
      CASE WHEN i.discovered_at::date <= a.usage_date THEN 0 ELSE 1 END,
      CASE WHEN i.discovered_at::date <= a.usage_date THEN i.discovered_at END DESC,
      CASE WHEN i.discovered_at::date > a.usage_date THEN i.discovered_at END ASC,
      i.is_current DESC,
      i.updated_at DESC
    LIMIT 1
  ) inst ON TRUE
  LEFT JOIN utilization_daily u
    ON u.tenant_id = a.tenant_id
   AND u.usage_date = a.usage_date
   AND u.volume_id = a.volume_id
),
final_rows AS (
  SELECT
    e.tenant_id,
    e.cloud_connection_id,
    e.billing_source_id,
    e.provider_id,
    e.usage_date,
    e.volume_id,
    e.resource_key,
    e.region_key,
    e.sub_account_key,
    e.volume_type,
    e.size_gb,
    e.iops,
    e.throughput,
    e.availability_zone,
    e.state,
    e.attached_instance_id,
    e.is_attached,
    e.storage_cost,
    e.io_cost,
    e.throughput_cost,
    e.total_cost,
    e.currency_code,
    (e.is_attached = FALSE) AS is_unattached,
    (
      COALESCE(e.is_attached, FALSE)
      AND LOWER(COALESCE(e.attached_instance_state, '')) = 'stopped'
    ) AS is_attached_to_stopped_instance,
    (
      -- Conservative idle thresholds:
      -- total bytes < 1 MiB/day and total ops < 100/day.
      (
        e.read_bytes IS NOT NULL OR e.write_bytes IS NOT NULL
        OR e.read_ops IS NOT NULL OR e.write_ops IS NOT NULL
        OR e.queue_length_max IS NOT NULL OR e.burst_balance_avg IS NOT NULL OR e.idle_time_avg IS NOT NULL
      )
      AND (COALESCE(e.read_bytes, 0) + COALESCE(e.write_bytes, 0)) < 1048576
      AND (COALESCE(e.read_ops, 0) + COALESCE(e.write_ops, 0)) < 100
    ) AS is_idle_candidate,
    (
      -- Conservative underutilized thresholds:
      -- only for attached, non-idle volumes with utilization data present.
      (
        e.read_bytes IS NOT NULL OR e.write_bytes IS NOT NULL
        OR e.read_ops IS NOT NULL OR e.write_ops IS NOT NULL
        OR e.queue_length_max IS NOT NULL OR e.burst_balance_avg IS NOT NULL OR e.idle_time_avg IS NOT NULL
      )
      AND COALESCE(e.is_attached, FALSE)
      AND NOT (
        (COALESCE(e.read_bytes, 0) + COALESCE(e.write_bytes, 0)) < 1048576
        AND (COALESCE(e.read_ops, 0) + COALESCE(e.write_ops, 0)) < 100
      )
      AND (COALESCE(e.read_bytes, 0) + COALESCE(e.write_bytes, 0)) < 104857600
      AND (COALESCE(e.read_ops, 0) + COALESCE(e.write_ops, 0)) < 1000
    ) AS is_underutilized_candidate,
    CASE
      WHEN (e.is_attached = FALSE) THEN 'warning'
      WHEN (
        COALESCE(e.is_attached, FALSE)
        AND LOWER(COALESCE(e.attached_instance_state, '')) = 'stopped'
      ) THEN 'warning'
      WHEN (
        (
          e.read_bytes IS NOT NULL OR e.write_bytes IS NOT NULL
          OR e.read_ops IS NOT NULL OR e.write_ops IS NOT NULL
          OR e.queue_length_max IS NOT NULL OR e.burst_balance_avg IS NOT NULL OR e.idle_time_avg IS NOT NULL
        )
        AND (COALESCE(e.read_bytes, 0) + COALESCE(e.write_bytes, 0)) < 1048576
        AND (COALESCE(e.read_ops, 0) + COALESCE(e.write_ops, 0)) < 100
      ) THEN 'idle'
      WHEN (
        (
          e.read_bytes IS NOT NULL OR e.write_bytes IS NOT NULL
          OR e.read_ops IS NOT NULL OR e.write_ops IS NOT NULL
          OR e.queue_length_max IS NOT NULL OR e.burst_balance_avg IS NOT NULL OR e.idle_time_avg IS NOT NULL
        )
        AND COALESCE(e.is_attached, FALSE)
        AND NOT (
          (COALESCE(e.read_bytes, 0) + COALESCE(e.write_bytes, 0)) < 1048576
          AND (COALESCE(e.read_ops, 0) + COALESCE(e.write_ops, 0)) < 100
        )
        AND (COALESCE(e.read_bytes, 0) + COALESCE(e.write_bytes, 0)) < 104857600
        AND (COALESCE(e.read_ops, 0) + COALESCE(e.write_ops, 0)) < 1000
      ) THEN 'underutilized'
      ELSE 'optimal'
    END::text AS optimization_status
  FROM enriched e
),
upserted AS (
  INSERT INTO fact_ebs_volume_daily (
    tenant_id,
    cloud_connection_id,
    billing_source_id,
    provider_id,
    usage_date,
    volume_id,
    resource_key,
    region_key,
    sub_account_key,
    volume_type,
    size_gb,
    iops,
    throughput,
    availability_zone,
    state,
    attached_instance_id,
    is_attached,
    storage_cost,
    io_cost,
    throughput_cost,
    total_cost,
    currency_code,
    is_unattached,
    is_attached_to_stopped_instance,
    is_idle_candidate,
    is_underutilized_candidate,
    optimization_status,
    created_at,
    updated_at
  )
  SELECT
    f.tenant_id,
    f.cloud_connection_id,
    f.billing_source_id,
    f.provider_id,
    f.usage_date,
    f.volume_id,
    f.resource_key,
    f.region_key,
    f.sub_account_key,
    f.volume_type,
    f.size_gb,
    f.iops,
    f.throughput,
    f.availability_zone,
    f.state,
    f.attached_instance_id,
    f.is_attached,
    f.storage_cost,
    f.io_cost,
    f.throughput_cost,
    f.total_cost,
    f.currency_code,
    f.is_unattached,
    f.is_attached_to_stopped_instance,
    f.is_idle_candidate,
    f.is_underutilized_candidate,
    f.optimization_status,
    NOW(),
    NOW()
  FROM final_rows f
  ON CONFLICT (tenant_id, volume_id, usage_date)
  DO UPDATE SET
    cloud_connection_id              = COALESCE(EXCLUDED.cloud_connection_id, fact_ebs_volume_daily.cloud_connection_id),
    billing_source_id                = COALESCE(EXCLUDED.billing_source_id, fact_ebs_volume_daily.billing_source_id),
    provider_id                      = COALESCE(EXCLUDED.provider_id, fact_ebs_volume_daily.provider_id),
    resource_key                     = COALESCE(EXCLUDED.resource_key, fact_ebs_volume_daily.resource_key),
    region_key                       = COALESCE(EXCLUDED.region_key, fact_ebs_volume_daily.region_key),
    sub_account_key                  = COALESCE(EXCLUDED.sub_account_key, fact_ebs_volume_daily.sub_account_key),
    volume_type                      = COALESCE(EXCLUDED.volume_type, fact_ebs_volume_daily.volume_type),
    size_gb                          = COALESCE(EXCLUDED.size_gb, fact_ebs_volume_daily.size_gb),
    iops                             = COALESCE(EXCLUDED.iops, fact_ebs_volume_daily.iops),
    throughput                       = COALESCE(EXCLUDED.throughput, fact_ebs_volume_daily.throughput),
    availability_zone                = COALESCE(EXCLUDED.availability_zone, fact_ebs_volume_daily.availability_zone),
    state                            = COALESCE(EXCLUDED.state, fact_ebs_volume_daily.state),
    attached_instance_id             = COALESCE(EXCLUDED.attached_instance_id, fact_ebs_volume_daily.attached_instance_id),
    is_attached                      = COALESCE(EXCLUDED.is_attached, fact_ebs_volume_daily.is_attached),
    storage_cost                     = COALESCE(EXCLUDED.storage_cost, fact_ebs_volume_daily.storage_cost),
    io_cost                          = COALESCE(EXCLUDED.io_cost, fact_ebs_volume_daily.io_cost),
    throughput_cost                  = COALESCE(EXCLUDED.throughput_cost, fact_ebs_volume_daily.throughput_cost),
    total_cost                       = COALESCE(EXCLUDED.total_cost, fact_ebs_volume_daily.total_cost),
    currency_code                    = COALESCE(EXCLUDED.currency_code, fact_ebs_volume_daily.currency_code),
    is_unattached                    = COALESCE(EXCLUDED.is_unattached, fact_ebs_volume_daily.is_unattached),
    is_attached_to_stopped_instance  = COALESCE(EXCLUDED.is_attached_to_stopped_instance, fact_ebs_volume_daily.is_attached_to_stopped_instance),
    is_idle_candidate                = COALESCE(EXCLUDED.is_idle_candidate, fact_ebs_volume_daily.is_idle_candidate),
    is_underutilized_candidate       = COALESCE(EXCLUDED.is_underutilized_candidate, fact_ebs_volume_daily.is_underutilized_candidate),
    optimization_status              = COALESCE(EXCLUDED.optimization_status, fact_ebs_volume_daily.optimization_status),
    updated_at                       = NOW()
  RETURNING
    is_idle_candidate,
    is_unattached,
    optimization_status
)
SELECT
  COUNT(*)::int AS upserted_rows,
  COUNT(*) FILTER (WHERE COALESCE(is_idle_candidate, FALSE))::int AS idle_count,
  COUNT(*) FILTER (WHERE COALESCE(is_unattached, FALSE))::int AS unattached_count,
  COUNT(*) FILTER (WHERE optimization_status = 'warning')::int AS warning_count
FROM upserted;
`,
      {
        replacements: {
          tenantId: params.tenantId ?? null,
          startDate: params.startDate,
          endDate: params.endDate,
        },
        type: QueryTypes.SELECT,
      },
    );

    return {
      rowsUpserted: Number(rows[0]?.upserted_rows ?? 0) || 0,
      idleCount: Number(rows[0]?.idle_count ?? 0) || 0,
      unattachedCount: Number(rows[0]?.unattached_count ?? 0) || 0,
      warningCount: Number(rows[0]?.warning_count ?? 0) || 0,
    };
  }
}

export type { SyncEbsVolumeDailyParams };
