import { QueryTypes } from "sequelize";

import { sequelize } from "../../../../models/index.js";

type SyncEc2InstanceDailyFactParams = {
  tenantId?: string | null;
  cloudConnectionId?: string | null;
  providerId?: string | null;
  startDate: string;
  endDate: string;
};

type UpsertedRowsResult = {
  upserted_rows: number | string;
};

export class Ec2InstanceDailyFactRepository {
  async syncEc2InstanceDailyFact(params: SyncEc2InstanceDailyFactParams): Promise<{ rowsUpserted: number }> {
    const rows = await sequelize.query<UpsertedRowsResult>(
      `
WITH anchor AS (
  SELECT DISTINCT
    x.tenant_id,
    x.instance_id,
    x.usage_date
  FROM (
    SELECT
      eis.tenant_id,
      eis.instance_id,
      eis.discovered_at::date AS usage_date
    FROM ec2_instance_inventory_snapshots eis
    WHERE eis.tenant_id IS NOT NULL
      AND eis.instance_id IS NOT NULL
      AND NULLIF(TRIM(eis.instance_id), '') IS NOT NULL
      AND eis.discovered_at::date >= CAST(:startDate AS date)
      AND eis.discovered_at::date <= CAST(:endDate AS date)
      AND (CAST(:tenantId AS uuid) IS NULL OR eis.tenant_id = CAST(:tenantId AS uuid))
      AND (CAST(:cloudConnectionId AS uuid) IS NULL OR eis.cloud_connection_id = CAST(:cloudConnectionId AS uuid))
      AND (CAST(:providerId AS bigint) IS NULL OR eis.provider_id = CAST(:providerId AS bigint))

    UNION

    SELECT
      u.tenant_id,
      u.instance_id,
      u.usage_date
    FROM ec2_instance_utilization_daily u
    WHERE u.tenant_id IS NOT NULL
      AND u.instance_id IS NOT NULL
      AND NULLIF(TRIM(u.instance_id), '') IS NOT NULL
      AND u.usage_date >= CAST(:startDate AS date)
      AND u.usage_date <= CAST(:endDate AS date)
      AND (CAST(:tenantId AS uuid) IS NULL OR u.tenant_id = CAST(:tenantId AS uuid))
      AND (CAST(:cloudConnectionId AS uuid) IS NULL OR u.cloud_connection_id = CAST(:cloudConnectionId AS uuid))
      AND (CAST(:providerId AS bigint) IS NULL OR u.provider_id = CAST(:providerId AS bigint))

    UNION

    SELECT
      c.tenant_id,
      c.instance_id,
      c.usage_date
    FROM fact_ec2_instance_cost_daily c
    WHERE c.instance_id IS NOT NULL
      AND NULLIF(TRIM(c.instance_id), '') IS NOT NULL
      AND c.usage_date >= CAST(:startDate AS date)
      AND c.usage_date <= CAST(:endDate AS date)
      AND (CAST(:tenantId AS uuid) IS NULL OR c.tenant_id = CAST(:tenantId AS uuid))
      AND (CAST(:cloudConnectionId AS uuid) IS NULL OR c.cloud_connection_id = CAST(:cloudConnectionId AS uuid))
      AND (CAST(:providerId AS bigint) IS NULL OR c.provider_id = CAST(:providerId AS bigint))

    UNION

    SELECT
      cv.tenant_id,
      cv.instance_id,
      cv.usage_date
    FROM fact_ec2_instance_coverage_daily cv
    WHERE cv.instance_id IS NOT NULL
      AND NULLIF(TRIM(cv.instance_id), '') IS NOT NULL
      AND cv.usage_date >= CAST(:startDate AS date)
      AND cv.usage_date <= CAST(:endDate AS date)
      AND (CAST(:tenantId AS uuid) IS NULL OR cv.tenant_id = CAST(:tenantId AS uuid))
      AND (CAST(:cloudConnectionId AS uuid) IS NULL OR cv.cloud_connection_id = CAST(:cloudConnectionId AS uuid))
      AND (CAST(:providerId AS bigint) IS NULL OR cv.provider_id = CAST(:providerId AS bigint))
  ) x
),
inv_base AS (
  SELECT
    eis.tenant_id,
    eis.instance_id,
    eis.discovered_at::date AS usage_date,
    eis.cloud_connection_id,
    eis.provider_id,
    eis.resource_key,
    eis.region_key,
    eis.sub_account_key,
    CASE
      WHEN NULLIF(TRIM(COALESCE(eis.tags_json->>'Name', '')), '') IS NOT NULL THEN TRIM(eis.tags_json->>'Name')
      ELSE NULL
    END AS instance_name,
    eis.instance_type,
    eis.availability_zone,
    eis.state,
    CASE
      WHEN LOWER(COALESCE(eis.instance_lifecycle, '')) = 'spot' THEN TRUE
      WHEN NULLIF(TRIM(COALESCE(eis.spot_instance_request_id, '')), '') IS NOT NULL THEN TRUE
      ELSE FALSE
    END AS is_spot,
    eis.platform,
    eis.platform_details,
    eis.architecture,
    eis.tenancy,
    eis.asg_name,
    eis.vpc_id,
    eis.subnet_id,
    eis.image_id,
    eis.launch_time,
    eis.deleted_at,
    eis.discovered_at,
    eis.updated_at,
    eis.created_at
  FROM ec2_instance_inventory_snapshots eis
  WHERE eis.tenant_id IS NOT NULL
    AND eis.instance_id IS NOT NULL
    AND NULLIF(TRIM(eis.instance_id), '') IS NOT NULL
    AND eis.discovered_at::date >= CAST(:startDate AS date)
    AND eis.discovered_at::date <= CAST(:endDate AS date)
    AND (CAST(:tenantId AS uuid) IS NULL OR eis.tenant_id = CAST(:tenantId AS uuid))
    AND (CAST(:cloudConnectionId AS uuid) IS NULL OR eis.cloud_connection_id = CAST(:cloudConnectionId AS uuid))
    AND (CAST(:providerId AS bigint) IS NULL OR eis.provider_id = CAST(:providerId AS bigint))
),
inv AS (
  SELECT DISTINCT ON (ib.tenant_id, ib.instance_id, ib.usage_date)
    ib.tenant_id,
    ib.instance_id,
    ib.usage_date,
    ib.cloud_connection_id,
    ib.provider_id,
    ib.resource_key,
    ib.region_key,
    ib.sub_account_key,
    ib.instance_name,
    ib.instance_type,
    ib.availability_zone,
    ib.state,
    ib.is_spot,
    ib.platform,
    ib.platform_details,
    ib.architecture,
    ib.tenancy,
    ib.asg_name,
    ib.vpc_id,
    ib.subnet_id,
    ib.image_id,
    ib.launch_time,
    ib.deleted_at
  FROM inv_base ib
  ORDER BY
    ib.tenant_id,
    ib.instance_id,
    ib.usage_date,
    ib.discovered_at DESC NULLS LAST,
    ib.updated_at DESC NULLS LAST,
    ib.created_at DESC NULLS LAST
),
util_base AS (
  SELECT
    u.tenant_id,
    u.instance_id,
    u.usage_date,
    u.cloud_connection_id,
    u.provider_id,
    u.resource_key,
    u.region_key,
    u.sub_account_key,
    u.cpu_avg,
    u.cpu_max,
    u.cpu_min,
    u.memory_avg,
    u.memory_max,
    u.disk_used_percent_avg,
    u.disk_used_percent_max,
    u.network_in_bytes,
    u.network_out_bytes,
    u.is_idle_candidate,
    u.is_underutilized_candidate,
    u.is_overutilized_candidate
  FROM ec2_instance_utilization_daily u
  WHERE u.tenant_id IS NOT NULL
    AND u.instance_id IS NOT NULL
    AND NULLIF(TRIM(u.instance_id), '') IS NOT NULL
    AND u.usage_date >= CAST(:startDate AS date)
    AND u.usage_date <= CAST(:endDate AS date)
    AND (CAST(:tenantId AS uuid) IS NULL OR u.tenant_id = CAST(:tenantId AS uuid))
    AND (CAST(:cloudConnectionId AS uuid) IS NULL OR u.cloud_connection_id = CAST(:cloudConnectionId AS uuid))
    AND (CAST(:providerId AS bigint) IS NULL OR u.provider_id = CAST(:providerId AS bigint))
),
util AS (
  SELECT
    ub.tenant_id,
    ub.instance_id,
    ub.usage_date,
    MAX(ub.cloud_connection_id) AS cloud_connection_id,
    MAX(ub.provider_id) AS provider_id,
    MAX(ub.resource_key) AS resource_key,
    MAX(ub.region_key) AS region_key,
    MAX(ub.sub_account_key) AS sub_account_key,
    AVG(ub.cpu_avg)::numeric(10,4) AS cpu_avg,
    MAX(ub.cpu_max)::numeric(10,4) AS cpu_max,
    MIN(ub.cpu_min)::numeric(10,4) AS cpu_min,
    AVG(ub.memory_avg)::numeric(10,4) AS memory_avg,
    MAX(ub.memory_max)::numeric(10,4) AS memory_max,
    AVG(ub.disk_used_percent_avg)::numeric(10,4) AS disk_used_percent_avg,
    MAX(ub.disk_used_percent_max)::numeric(10,4) AS disk_used_percent_max,
    MAX(ub.network_in_bytes) AS network_in_bytes,
    MAX(ub.network_out_bytes) AS network_out_bytes,
    BOOL_OR(COALESCE(ub.is_idle_candidate, FALSE)) AS is_idle_candidate,
    BOOL_OR(COALESCE(ub.is_underutilized_candidate, FALSE)) AS is_underutilized_candidate,
    BOOL_OR(COALESCE(ub.is_overutilized_candidate, FALSE)) AS is_overutilized_candidate
  FROM util_base ub
  GROUP BY ub.tenant_id, ub.instance_id, ub.usage_date
),
cost_base AS (
  SELECT
    c.tenant_id,
    c.instance_id,
    c.usage_date,
    c.cloud_connection_id,
    c.billing_source_id,
    c.provider_id,
    c.resource_key,
    c.region_key,
    c.sub_account_key,
    c.instance_type,
    c.currency_code,
    c.compute_cost,
    c.ebs_cost,
    c.data_transfer_cost,
    c.tax_cost,
    c.credit_amount,
    c.refund_amount,
    c.total_billed_cost,
    c.total_effective_cost,
    c.total_list_cost,
    c.usage_hours
  FROM fact_ec2_instance_cost_daily c
  WHERE c.instance_id IS NOT NULL
    AND NULLIF(TRIM(c.instance_id), '') IS NOT NULL
    AND c.usage_date >= CAST(:startDate AS date)
    AND c.usage_date <= CAST(:endDate AS date)
    AND (CAST(:tenantId AS uuid) IS NULL OR c.tenant_id = CAST(:tenantId AS uuid))
    AND (CAST(:cloudConnectionId AS uuid) IS NULL OR c.cloud_connection_id = CAST(:cloudConnectionId AS uuid))
    AND (CAST(:providerId AS bigint) IS NULL OR c.provider_id = CAST(:providerId AS bigint))
),
cost AS (
  SELECT
    cb.tenant_id,
    cb.instance_id,
    cb.usage_date,
    MAX(cb.cloud_connection_id) AS cloud_connection_id,
    MAX(cb.billing_source_id) AS billing_source_id,
    MAX(cb.provider_id) AS provider_id,
    MAX(cb.resource_key) AS resource_key,
    MAX(cb.region_key) AS region_key,
    MAX(cb.sub_account_key) AS sub_account_key,
    MAX(cb.instance_type) AS instance_type,
    MAX(cb.currency_code) AS currency_code,
    SUM(COALESCE(cb.compute_cost, 0))::numeric(18,6) AS compute_cost,
    SUM(COALESCE(cb.ebs_cost, 0))::numeric(18,6) AS ebs_cost,
    SUM(COALESCE(cb.data_transfer_cost, 0))::numeric(18,6) AS data_transfer_cost,
    SUM(COALESCE(cb.tax_cost, 0))::numeric(18,6) AS tax_cost,
    SUM(COALESCE(cb.credit_amount, 0))::numeric(18,6) AS credit_amount,
    SUM(COALESCE(cb.refund_amount, 0))::numeric(18,6) AS refund_amount,
    SUM(COALESCE(cb.total_billed_cost, 0))::numeric(18,6) AS total_billed_cost,
    SUM(COALESCE(cb.total_effective_cost, 0))::numeric(18,6) AS total_effective_cost,
    SUM(COALESCE(cb.total_list_cost, 0))::numeric(18,6) AS total_list_cost,
    SUM(COALESCE(cb.usage_hours, 0))::numeric(18,6) AS usage_hours
  FROM cost_base cb
  GROUP BY cb.tenant_id, cb.instance_id, cb.usage_date
),
coverage_base AS (
  SELECT
    cv.tenant_id,
    cv.instance_id,
    cv.usage_date,
    cv.cloud_connection_id,
    cv.billing_source_id,
    cv.provider_id,
    cv.resource_key,
    cv.region_key,
    cv.sub_account_key,
    cv.instance_type,
    cv.reservation_type,
    cv.reservation_arn,
    cv.savings_plan_arn,
    cv.savings_plan_type,
    cv.covered_hours,
    cv.uncovered_hours,
    cv.covered_cost,
    cv.uncovered_cost
  FROM fact_ec2_instance_coverage_daily cv
  WHERE cv.instance_id IS NOT NULL
    AND NULLIF(TRIM(cv.instance_id), '') IS NOT NULL
    AND cv.usage_date >= CAST(:startDate AS date)
    AND cv.usage_date <= CAST(:endDate AS date)
    AND (CAST(:tenantId AS uuid) IS NULL OR cv.tenant_id = CAST(:tenantId AS uuid))
    AND (CAST(:cloudConnectionId AS uuid) IS NULL OR cv.cloud_connection_id = CAST(:cloudConnectionId AS uuid))
    AND (CAST(:providerId AS bigint) IS NULL OR cv.provider_id = CAST(:providerId AS bigint))
),
coverage AS (
  SELECT
    cb.tenant_id,
    cb.instance_id,
    cb.usage_date,
    MAX(cb.cloud_connection_id) AS cloud_connection_id,
    MAX(cb.billing_source_id) AS billing_source_id,
    MAX(cb.provider_id) AS provider_id,
    MAX(cb.resource_key) AS resource_key,
    MAX(cb.region_key) AS region_key,
    MAX(cb.sub_account_key) AS sub_account_key,
    MAX(cb.instance_type) AS instance_type,
    MAX(cb.reservation_type) AS reservation_type,
    MAX(cb.reservation_arn) AS reservation_arn,
    MAX(cb.savings_plan_arn) AS savings_plan_arn,
    MAX(cb.savings_plan_type) AS savings_plan_type,
    SUM(COALESCE(cb.covered_hours, 0))::numeric(18,6) AS covered_hours,
    SUM(COALESCE(cb.uncovered_hours, 0))::numeric(18,6) AS uncovered_hours,
    SUM(COALESCE(cb.covered_cost, 0))::numeric(18,6) AS covered_cost,
    SUM(COALESCE(cb.uncovered_cost, 0))::numeric(18,6) AS uncovered_cost
  FROM coverage_base cb
  GROUP BY cb.tenant_id, cb.instance_id, cb.usage_date
),
final_rows AS (
  SELECT
    a.tenant_id,
    COALESCE(inv.cloud_connection_id, util.cloud_connection_id, cost.cloud_connection_id, coverage.cloud_connection_id) AS cloud_connection_id,
    COALESCE(cost.billing_source_id, coverage.billing_source_id) AS billing_source_id,
    COALESCE(inv.provider_id, util.provider_id, cost.provider_id, coverage.provider_id) AS provider_id,
    a.usage_date,
    a.instance_id,
    COALESCE(inv.resource_key, util.resource_key, cost.resource_key, coverage.resource_key) AS resource_key,
    COALESCE(inv.region_key, util.region_key, cost.region_key, coverage.region_key) AS region_key,
    COALESCE(inv.sub_account_key, util.sub_account_key, cost.sub_account_key, coverage.sub_account_key) AS sub_account_key,
    inv.instance_name,
    COALESCE(inv.instance_type, cost.instance_type, coverage.instance_type) AS instance_type,
    inv.availability_zone,
    inv.state,
    CASE
      WHEN LOWER(COALESCE(inv.state, '')) = 'running' THEN TRUE
      WHEN COALESCE(cost.usage_hours, 0) > 0 THEN TRUE
      ELSE FALSE
    END AS is_running,
    COALESCE(
      inv.is_spot,
      CASE WHEN coverage.reservation_type = 'spot' THEN TRUE ELSE FALSE END,
      FALSE
    ) AS is_spot,
    inv.platform,
    inv.platform_details,
    inv.architecture,
    inv.tenancy,
    inv.asg_name,
    inv.vpc_id,
    inv.subnet_id,
    inv.image_id,
    inv.launch_time,
    inv.deleted_at,
    COALESCE(cost.usage_hours, 0)::numeric(18,6) AS total_hours,
    util.cpu_avg,
    util.cpu_max,
    util.cpu_min,
    util.memory_avg,
    util.memory_max,
    util.disk_used_percent_avg,
    util.disk_used_percent_max,
    util.network_in_bytes,
    util.network_out_bytes,
    COALESCE(cost.compute_cost, 0)::numeric(18,6) AS compute_cost,
    COALESCE(cost.ebs_cost, 0)::numeric(18,6) AS ebs_cost,
    COALESCE(cost.data_transfer_cost, 0)::numeric(18,6) AS data_transfer_cost,
    COALESCE(cost.tax_cost, 0)::numeric(18,6) AS tax_cost,
    COALESCE(cost.credit_amount, 0)::numeric(18,6) AS credit_amount,
    COALESCE(cost.refund_amount, 0)::numeric(18,6) AS refund_amount,
    COALESCE(cost.total_billed_cost, 0)::numeric(18,6) AS total_billed_cost,
    COALESCE(cost.total_effective_cost, 0)::numeric(18,6) AS total_effective_cost,
    COALESCE(cost.total_list_cost, 0)::numeric(18,6) AS total_list_cost,
    COALESCE(cost.currency_code, 'USD') AS currency_code,
    coverage.reservation_type,
    coverage.reservation_arn,
    coverage.savings_plan_arn,
    coverage.savings_plan_type,
    COALESCE(coverage.covered_hours, 0)::numeric(18,6) AS covered_hours,
    COALESCE(coverage.uncovered_hours, 0)::numeric(18,6) AS uncovered_hours,
    COALESCE(coverage.covered_cost, 0)::numeric(18,6) AS covered_cost,
    COALESCE(coverage.uncovered_cost, 0)::numeric(18,6) AS uncovered_cost,
    util.is_idle_candidate,
    util.is_underutilized_candidate,
    util.is_overutilized_candidate,
    CASE
      WHEN coverage.reservation_type IN ('on_demand', 'reserved', 'savings_plan', 'spot') THEN coverage.reservation_type
      ELSE 'other'
    END::varchar(30) AS pricing_model
  FROM anchor a
  LEFT JOIN inv
    ON inv.tenant_id = a.tenant_id
   AND inv.instance_id = a.instance_id
   AND inv.usage_date = a.usage_date
  LEFT JOIN util
    ON util.tenant_id = a.tenant_id
   AND util.instance_id = a.instance_id
   AND util.usage_date = a.usage_date
  LEFT JOIN cost
    ON cost.tenant_id = a.tenant_id
   AND cost.instance_id = a.instance_id
   AND cost.usage_date = a.usage_date
  LEFT JOIN coverage
    ON coverage.tenant_id = a.tenant_id
   AND coverage.instance_id = a.instance_id
   AND coverage.usage_date = a.usage_date
),
upserted AS (
  DELETE FROM fact_ec2_instance_daily t
  USING final_rows f
  WHERE t.tenant_id = f.tenant_id
    AND t.instance_id = f.instance_id
    AND t.usage_date = f.usage_date
),
inserted AS (
  INSERT INTO fact_ec2_instance_daily (
    tenant_id,
    cloud_connection_id,
    billing_source_id,
    provider_id,
    usage_date,
    instance_id,
    resource_key,
    region_key,
    sub_account_key,
    instance_name,
    instance_type,
    availability_zone,
    state,
    is_running,
    is_spot,
    platform,
    platform_details,
    architecture,
    tenancy,
    asg_name,
    vpc_id,
    subnet_id,
    image_id,
    launch_time,
    deleted_at,
    total_hours,
    cpu_avg,
    cpu_max,
    cpu_min,
    memory_avg,
    memory_max,
    disk_used_percent_avg,
    disk_used_percent_max,
    network_in_bytes,
    network_out_bytes,
    compute_cost,
    ebs_cost,
    data_transfer_cost,
    tax_cost,
    credit_amount,
    refund_amount,
    total_billed_cost,
    total_effective_cost,
    total_list_cost,
    currency_code,
    billed_cost,
    effective_cost,
    list_cost,
    pricing_model,
    reservation_type,
    reservation_arn,
    savings_plan_arn,
    savings_plan_type,
    covered_hours,
    uncovered_hours,
    covered_cost,
    uncovered_cost,
    is_idle_candidate,
    is_underutilized_candidate,
    is_overutilized_candidate,
    source,
    created_at,
    updated_at
  )
  SELECT
    f.tenant_id,
    f.cloud_connection_id,
    f.billing_source_id,
    f.provider_id,
    f.usage_date,
    f.instance_id,
    f.resource_key,
    f.region_key,
    f.sub_account_key,
    f.instance_name,
    f.instance_type,
    f.availability_zone,
    f.state,
    f.is_running,
    f.is_spot,
    f.platform,
    f.platform_details,
    f.architecture,
    f.tenancy,
    f.asg_name,
    f.vpc_id,
    f.subnet_id,
    f.image_id,
    f.launch_time,
    f.deleted_at,
    f.total_hours,
    f.cpu_avg,
    f.cpu_max,
    f.cpu_min,
    f.memory_avg,
    f.memory_max,
    f.disk_used_percent_avg,
    f.disk_used_percent_max,
    f.network_in_bytes,
    f.network_out_bytes,
    f.compute_cost,
    f.ebs_cost,
    f.data_transfer_cost,
    f.tax_cost,
    f.credit_amount,
    f.refund_amount,
    f.total_billed_cost,
    f.total_effective_cost,
    f.total_list_cost,
    f.currency_code,
    f.total_billed_cost,
    f.total_effective_cost,
    f.total_list_cost,
    f.pricing_model,
    f.reservation_type,
    f.reservation_arn,
    f.savings_plan_arn,
    f.savings_plan_type,
    f.covered_hours,
    f.uncovered_hours,
    f.covered_cost,
    f.uncovered_cost,
    f.is_idle_candidate,
    f.is_underutilized_candidate,
    f.is_overutilized_candidate,
    'ec2_gold_unified',
    NOW(),
    NOW()
  FROM final_rows f
  RETURNING 1
)
SELECT COUNT(*)::int AS upserted_rows
FROM inserted;
`,
      {
        replacements: {
          tenantId: params.tenantId ?? null,
          cloudConnectionId: params.cloudConnectionId ?? null,
          providerId: params.providerId ?? null,
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

export type { SyncEc2InstanceDailyFactParams };
