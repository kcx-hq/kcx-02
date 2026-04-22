import { QueryTypes } from "sequelize";

import { sequelize } from "../../../../models/index.js";

type SyncEc2InstanceCoverageDailyParams = {
  tenantId?: string;
  startDate: string;
  endDate: string;
};

type UpsertedRowsResult = {
  upserted_rows: number | string;
};

export class Ec2InstanceCoverageDailyRepository {
  async syncEc2InstanceCoverageDaily(params: SyncEc2InstanceCoverageDailyParams): Promise<{ rowsUpserted: number }> {
    const rows = await sequelize.query<UpsertedRowsResult>(
      `
WITH base AS (
  SELECT
    d.tenant_id,
    d.cloud_connection_id,
    d.billing_source_id,
    d.provider_id,
    d.usage_date,
    d.instance_id,
    d.resource_key,
    d.region_key,
    d.sub_account_key,
    d.instance_type,
    d.pricing_model,
    d.charge_category,
    COALESCE(d.effective_cost, 0)::numeric(18,6) AS effective_cost,
    COALESCE(d.usage_quantity, 0)::numeric(18,6) AS usage_quantity
  FROM ec2_cost_history_daily d
  WHERE d.instance_id IS NOT NULL
    AND NULLIF(TRIM(d.instance_id), '') IS NOT NULL
    AND d.usage_date >= CAST(:startDate AS date)
    AND d.usage_date <= CAST(:endDate AS date)
    AND (CAST(:tenantId AS uuid) IS NULL OR d.tenant_id = CAST(:tenantId AS uuid))
),
normalized AS (
  SELECT
    b.*,
    CASE
      WHEN b.pricing_model = 'savings_plan' THEN 'savings_plan'
      WHEN b.pricing_model = 'reserved' THEN 'reserved'
      WHEN b.pricing_model = 'spot' THEN 'spot'
      ELSE 'on_demand'
    END AS reservation_type_normalized
  FROM base b
),
agg AS (
  SELECT
    n.tenant_id,
    n.usage_date,
    n.instance_id,
    (ARRAY_AGG(n.cloud_connection_id
      ORDER BY CASE WHEN n.charge_category = 'compute' THEN 0 ELSE 1 END, n.cloud_connection_id)
      FILTER (WHERE n.cloud_connection_id IS NOT NULL))[1] AS cloud_connection_id,
    (ARRAY_AGG(n.billing_source_id
      ORDER BY CASE WHEN n.charge_category = 'compute' THEN 0 ELSE 1 END, n.billing_source_id)
      FILTER (WHERE n.billing_source_id IS NOT NULL))[1] AS billing_source_id,
    (ARRAY_AGG(n.provider_id
      ORDER BY CASE WHEN n.charge_category = 'compute' THEN 0 ELSE 1 END, n.provider_id)
      FILTER (WHERE n.provider_id IS NOT NULL))[1] AS provider_id,
    (ARRAY_AGG(n.resource_key
      ORDER BY CASE WHEN n.charge_category = 'compute' THEN 0 ELSE 1 END, n.resource_key)
      FILTER (WHERE n.resource_key IS NOT NULL))[1] AS resource_key,
    (ARRAY_AGG(n.region_key
      ORDER BY CASE WHEN n.charge_category = 'compute' THEN 0 ELSE 1 END, n.region_key)
      FILTER (WHERE n.region_key IS NOT NULL))[1] AS region_key,
    (ARRAY_AGG(n.sub_account_key
      ORDER BY CASE WHEN n.charge_category = 'compute' THEN 0 ELSE 1 END, n.sub_account_key)
      FILTER (WHERE n.sub_account_key IS NOT NULL))[1] AS sub_account_key,
    (ARRAY_AGG(n.instance_type
      ORDER BY CASE WHEN n.charge_category = 'compute' THEN 0 ELSE 1 END, n.instance_type)
      FILTER (WHERE NULLIF(TRIM(n.instance_type), '') IS NOT NULL))[1] AS instance_type,
    (
      -- Collapse mixed pricing models per instance-day into one canonical reservation_type.
      -- Priority: savings_plan > reserved > spot > on_demand, while preferring compute rows first.
      ARRAY_AGG(
        n.reservation_type_normalized
        ORDER BY
          CASE WHEN n.charge_category = 'compute' THEN 0 ELSE 1 END,
          CASE n.reservation_type_normalized
            WHEN 'savings_plan' THEN 0
            WHEN 'reserved' THEN 1
            WHEN 'spot' THEN 2
            ELSE 3
          END,
          n.reservation_type_normalized
      )
    )[1] AS reservation_type,
    NULL::text AS reservation_arn,
    NULL::text AS savings_plan_arn,
    NULL::text AS savings_plan_type,
    SUM(
      CASE
        WHEN n.charge_category = 'compute'
         AND n.pricing_model IN ('reserved', 'savings_plan', 'spot')
          THEN n.usage_quantity
        ELSE 0
      END
    )::numeric(18,6) AS covered_hours,
    SUM(
      CASE
        WHEN n.charge_category = 'compute'
         AND COALESCE(n.pricing_model, 'other') IN ('on_demand', 'other')
          THEN n.usage_quantity
        ELSE 0
      END
    )::numeric(18,6) AS uncovered_hours,
    SUM(
      CASE
        WHEN n.charge_category = 'compute'
         AND n.pricing_model IN ('reserved', 'savings_plan', 'spot')
          THEN n.effective_cost
        ELSE 0
      END
    )::numeric(18,6) AS covered_cost,
    SUM(
      CASE
        WHEN n.charge_category = 'compute'
         AND COALESCE(n.pricing_model, 'other') IN ('on_demand', 'other')
          THEN n.effective_cost
        ELSE 0
      END
    )::numeric(18,6) AS uncovered_cost,
    SUM(
      CASE
        WHEN n.charge_category = 'compute'
          THEN n.effective_cost
        ELSE 0
      END
    )::numeric(18,6) AS effective_cost
  FROM normalized n
  GROUP BY n.tenant_id, n.usage_date, n.instance_id
),
upserted AS (
  INSERT INTO fact_ec2_instance_coverage_daily (
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
    reservation_type,
    reservation_arn,
    savings_plan_arn,
    savings_plan_type,
    covered_hours,
    uncovered_hours,
    covered_cost,
    uncovered_cost,
    effective_cost,
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
    a.reservation_type,
    a.reservation_arn,
    a.savings_plan_arn,
    a.savings_plan_type,
    a.covered_hours,
    a.uncovered_hours,
    a.covered_cost,
    a.uncovered_cost,
    a.effective_cost,
    NOW(),
    NOW()
  FROM agg a
  ON CONFLICT (tenant_id, instance_id, usage_date)
  DO UPDATE SET
    cloud_connection_id = EXCLUDED.cloud_connection_id,
    billing_source_id   = EXCLUDED.billing_source_id,
    provider_id         = EXCLUDED.provider_id,
    resource_key        = EXCLUDED.resource_key,
    region_key          = EXCLUDED.region_key,
    sub_account_key     = EXCLUDED.sub_account_key,
    instance_type       = EXCLUDED.instance_type,
    reservation_type    = EXCLUDED.reservation_type,
    reservation_arn     = EXCLUDED.reservation_arn,
    savings_plan_arn    = EXCLUDED.savings_plan_arn,
    savings_plan_type   = EXCLUDED.savings_plan_type,
    covered_hours       = EXCLUDED.covered_hours,
    uncovered_hours     = EXCLUDED.uncovered_hours,
    covered_cost        = EXCLUDED.covered_cost,
    uncovered_cost      = EXCLUDED.uncovered_cost,
    effective_cost      = EXCLUDED.effective_cost,
    updated_at          = NOW()
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

export type { SyncEc2InstanceCoverageDailyParams };
