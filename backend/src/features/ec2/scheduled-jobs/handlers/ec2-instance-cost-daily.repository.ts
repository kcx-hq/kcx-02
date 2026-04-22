import { QueryTypes } from "sequelize";

import { sequelize } from "../../../../models/index.js";

type SyncEc2InstanceCostDailyParams = {
  tenantId?: string;
  startDate: string;
  endDate: string;
};

type UpsertedRowsResult = {
  upserted_rows: number | string;
};

export class Ec2InstanceCostDailyRepository {
  async syncEc2InstanceCostDaily(params: SyncEc2InstanceCostDailyParams): Promise<{ rowsUpserted: number }> {
    const rows = await sequelize.query<UpsertedRowsResult>(
      `
WITH base AS (
  SELECT
    d.tenant_id,
    d.cloud_connection_id,
    d.billing_source_id,
    d.provider_id,
    d.usage_date,
    COALESCE(
      NULLIF(TRIM(d.instance_id), ''),
      ebs_map.mapped_instance_id
    ) AS instance_id,
    d.resource_key,
    d.region_key,
    d.sub_account_key,
    d.instance_type,
    d.currency_code,
    d.charge_category,
    COALESCE(d.billed_cost, 0)::numeric(18,6)    AS billed_cost,
    COALESCE(d.effective_cost, 0)::numeric(18,6) AS effective_cost,
    COALESCE(d.list_cost, 0)::numeric(18,6)      AS list_cost,
    COALESCE(d.usage_quantity, 0)::numeric(18,6) AS usage_quantity
  FROM ec2_cost_history_daily d
  LEFT JOIN dim_resource dr
    ON dr.id = d.resource_key
  LEFT JOIN LATERAL (
    SELECT
      MIN(NULLIF(TRIM(v.attached_instance_id), '')) AS mapped_instance_id
    FROM ec2_volume_inventory_snapshots v
    WHERE d.charge_category = 'ebs'
      AND NULLIF(TRIM(d.instance_id), '') IS NULL
      AND d.usage_date IS NOT NULL
      AND NULLIF(TRIM(COALESCE(dr.resource_id, '')), '') IS NOT NULL
      AND LOWER(TRIM(dr.resource_id)) ~ '^vol-[a-z0-9]+$'
      AND LOWER(TRIM(v.volume_id)) = LOWER(TRIM(dr.resource_id))
      AND v.tenant_id = d.tenant_id
      AND v.provider_id IS NOT DISTINCT FROM d.provider_id
      AND v.cloud_connection_id IS NOT DISTINCT FROM d.cloud_connection_id
      AND v.discovered_at::date = d.usage_date
      AND v.is_attached = TRUE
      AND NULLIF(TRIM(v.attached_instance_id), '') IS NOT NULL
    GROUP BY LOWER(TRIM(v.volume_id))
    HAVING COUNT(DISTINCT NULLIF(TRIM(v.attached_instance_id), '')) = 1
  ) ebs_map ON TRUE
  WHERE COALESCE(NULLIF(TRIM(d.instance_id), ''), ebs_map.mapped_instance_id) IS NOT NULL
    AND d.usage_date >= CAST(:startDate AS date)
    AND d.usage_date <= CAST(:endDate AS date)
    AND (CAST(:tenantId AS uuid) IS NULL OR d.tenant_id = CAST(:tenantId AS uuid))
),
agg AS (
  SELECT
    b.tenant_id,
    b.usage_date,
    b.instance_id,
    (ARRAY_AGG(b.cloud_connection_id
      ORDER BY CASE WHEN b.charge_category = 'compute' THEN 0 ELSE 1 END, b.cloud_connection_id)
      FILTER (WHERE b.cloud_connection_id IS NOT NULL))[1] AS cloud_connection_id,
    (ARRAY_AGG(b.billing_source_id
      ORDER BY CASE WHEN b.charge_category = 'compute' THEN 0 ELSE 1 END, b.billing_source_id)
      FILTER (WHERE b.billing_source_id IS NOT NULL))[1] AS billing_source_id,
    (ARRAY_AGG(b.provider_id
      ORDER BY CASE WHEN b.charge_category = 'compute' THEN 0 ELSE 1 END, b.provider_id)
      FILTER (WHERE b.provider_id IS NOT NULL))[1] AS provider_id,
    (ARRAY_AGG(b.resource_key
      ORDER BY CASE WHEN b.charge_category = 'compute' THEN 0 ELSE 1 END, b.resource_key)
      FILTER (WHERE b.resource_key IS NOT NULL))[1] AS resource_key,
    (ARRAY_AGG(b.region_key
      ORDER BY CASE WHEN b.charge_category = 'compute' THEN 0 ELSE 1 END, b.region_key)
      FILTER (WHERE b.region_key IS NOT NULL))[1] AS region_key,
    (ARRAY_AGG(b.sub_account_key
      ORDER BY CASE WHEN b.charge_category = 'compute' THEN 0 ELSE 1 END, b.sub_account_key)
      FILTER (WHERE b.sub_account_key IS NOT NULL))[1] AS sub_account_key,
    (ARRAY_AGG(b.instance_type
      ORDER BY CASE WHEN b.charge_category = 'compute' THEN 0 ELSE 1 END, b.instance_type)
      FILTER (WHERE NULLIF(TRIM(b.instance_type), '') IS NOT NULL))[1] AS instance_type,
    (ARRAY_AGG(b.currency_code
      ORDER BY CASE WHEN b.charge_category = 'compute' THEN 0 ELSE 1 END, b.currency_code)
      FILTER (WHERE NULLIF(TRIM(b.currency_code), '') IS NOT NULL))[1] AS currency_code,
    SUM(CASE WHEN b.charge_category = 'compute'       THEN b.billed_cost ELSE 0 END)::numeric(18,6) AS compute_cost,
    SUM(CASE WHEN b.charge_category = 'ebs'           THEN b.billed_cost ELSE 0 END)::numeric(18,6) AS ebs_cost,
    SUM(CASE WHEN b.charge_category = 'data_transfer' THEN b.billed_cost ELSE 0 END)::numeric(18,6) AS data_transfer_cost,
    SUM(CASE WHEN b.charge_category = 'tax'           THEN b.billed_cost ELSE 0 END)::numeric(18,6) AS tax_cost,
    SUM(CASE WHEN b.charge_category = 'credit'        THEN b.billed_cost ELSE 0 END)::numeric(18,6) AS credit_amount,
    SUM(CASE WHEN b.charge_category = 'refund'        THEN b.billed_cost ELSE 0 END)::numeric(18,6) AS refund_amount,
    SUM(b.billed_cost)::numeric(18,6)    AS total_billed_cost,
    SUM(b.effective_cost)::numeric(18,6) AS total_effective_cost,
    SUM(b.list_cost)::numeric(18,6)      AS total_list_cost,
    SUM(CASE WHEN b.charge_category = 'compute' THEN b.usage_quantity ELSE 0 END)::numeric(18,6) AS usage_hours
  FROM base b
  GROUP BY b.tenant_id, b.usage_date, b.instance_id
),
upserted AS (
  INSERT INTO fact_ec2_instance_cost_daily (
    tenant_id,
    cloud_connection_id,
    billing_source_id,
    provider_id,
    usage_date,
    instance_id,
    resource_key,
    region_key,
    sub_account_key,
    instance_type,
    currency_code,
    compute_cost,
    ebs_cost,
    data_transfer_cost,
    tax_cost,
    credit_amount,
    refund_amount,
    total_billed_cost,
    total_effective_cost,
    total_list_cost,
    usage_hours,
    created_at,
    updated_at
  )
  SELECT
    a.tenant_id,
    a.cloud_connection_id,
    a.billing_source_id,
    a.provider_id,
    a.usage_date,
    a.instance_id,
    a.resource_key,
    a.region_key,
    a.sub_account_key,
    a.instance_type,
    a.currency_code,
    a.compute_cost,
    a.ebs_cost,
    a.data_transfer_cost,
    a.tax_cost,
    a.credit_amount,
    a.refund_amount,
    a.total_billed_cost,
    a.total_effective_cost,
    a.total_list_cost,
    a.usage_hours,
    NOW(),
    NOW()
  FROM agg a
  ON CONFLICT (tenant_id, instance_id, usage_date)
  DO UPDATE SET
    cloud_connection_id  = EXCLUDED.cloud_connection_id,
    billing_source_id    = EXCLUDED.billing_source_id,
    provider_id          = EXCLUDED.provider_id,
    resource_key         = EXCLUDED.resource_key,
    region_key           = EXCLUDED.region_key,
    sub_account_key      = EXCLUDED.sub_account_key,
    instance_type        = EXCLUDED.instance_type,
    currency_code        = EXCLUDED.currency_code,
    compute_cost         = EXCLUDED.compute_cost,
    ebs_cost             = EXCLUDED.ebs_cost,
    data_transfer_cost   = EXCLUDED.data_transfer_cost,
    tax_cost             = EXCLUDED.tax_cost,
    credit_amount        = EXCLUDED.credit_amount,
    refund_amount        = EXCLUDED.refund_amount,
    total_billed_cost    = EXCLUDED.total_billed_cost,
    total_effective_cost = EXCLUDED.total_effective_cost,
    total_list_cost      = EXCLUDED.total_list_cost,
    usage_hours          = EXCLUDED.usage_hours,
    updated_at           = NOW()
  RETURNING 1
)
SELECT COUNT(*)::int AS upserted_rows
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
    };
  }
}

export type { SyncEc2InstanceCostDailyParams };
