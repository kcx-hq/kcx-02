import { QueryTypes } from "sequelize";

import { BillingSource, CloudConnectionV2, sequelize } from "../../../models/index.js";

const S3_BUCKET_NAME_SQL = `
CASE
  WHEN COALESCE(dres.resource_id, '') = '' THEN 'unattributed'
  WHEN LOWER(dres.resource_id) LIKE 'arn:aws:s3:::%' THEN NULLIF(SPLIT_PART(dres.resource_id, ':::', 2), '')
  WHEN LOWER(dres.resource_id) LIKE 's3://%' THEN NULLIF(SPLIT_PART(SUBSTRING(dres.resource_id FROM 6), '/', 1), '')
  ELSE dres.resource_id
END
`;

const S3_FILTER_SQL = `
(
  LOWER(COALESCE(ds.service_name, '')) LIKE '%s3%'
  OR LOWER(COALESCE(ds.service_name, '')) LIKE '%simple storage service%'
  OR LOWER(COALESCE(fcli.usage_type, '')) LIKE '%s3%'
  OR LOWER(COALESCE(dres.resource_id, '')) LIKE 'arn:aws:s3:::%'
  OR LOWER(COALESCE(dres.resource_id, '')) LIKE 's3://%'
)
`;

const S3_TRANSFER_COST_CONDITION_SQL = `
(
  LOWER(TRIM(COALESCE(NULLIF(product_family, ''), ''))) = 'data transfer'
  OR LOWER(COALESCE(usage_type, '')) LIKE '%datatransfer%'
  OR LOWER(COALESCE(usage_type, '')) LIKE '%out-bytes%'
  OR LOWER(COALESCE(usage_type, '')) LIKE '%in-bytes%'
  OR LOWER(COALESCE(line_item_description, '')) LIKE '%data transfer%'
)
`;

const S3_REQUEST_COST_CONDITION_SQL = `
(
  LOWER(COALESCE(usage_type, '')) LIKE 'requests%'
)
`;

const S3_STORAGE_COST_CONDITION_SQL = `
(
  LOWER(COALESCE(usage_type, '')) LIKE '%timedstorage%'
  OR LOWER(COALESCE(usage_type, '')) LIKE '%storage%'
  OR LOWER(COALESCE(usage_type, '')) LIKE '%bytehrs%'
  OR LOWER(COALESCE(usage_type, '')) LIKE '%gb-month%'
)
`;

export async function refreshS3BucketCostSummaryForBillingSource({
  tenantId,
  billingSourceId,
}: {
  tenantId: string;
  billingSourceId: string;
}): Promise<{ rowsInserted: number }> {
  const source = await BillingSource.findByPk(String(billingSourceId));
  if (!source || String(source.tenantId) !== String(tenantId)) {
    return { rowsInserted: 0 };
  }

  const connection = source.cloudConnectionId
    ? await CloudConnectionV2.findByPk(String(source.cloudConnectionId))
    : null;

  const snapshotDateRows = await sequelize.query<{ snapshot_date: string }>(
    `
    SELECT COALESCE(MAX(dd.full_date), CURRENT_DATE::text) AS snapshot_date
    FROM fact_cost_line_items fcli
    LEFT JOIN dim_date dd ON dd.id = fcli.usage_date_key
    WHERE fcli.tenant_id = $1
      AND fcli.billing_source_id = $2
    `,
    {
      bind: [String(source.tenantId), String(source.id)],
      type: QueryTypes.SELECT,
    },
  );
  const snapshotDate = String(snapshotDateRows[0]?.snapshot_date ?? "").trim() || new Date().toISOString().slice(0, 10);

  await sequelize.query(
    `
    DELETE FROM s3_bucket_cost_summary_daily
    WHERE tenant_id = $1
      AND billing_source_id = $2
      AND snapshot_date = $3::date
    `,
    {
      bind: [String(source.tenantId), String(source.id), snapshotDate],
      type: QueryTypes.DELETE,
    },
  );

  const insertedRows = await sequelize.query<{ inserted_count: string }>(
    `
    WITH base AS (
      SELECT
        fcli.tenant_id,
        fcli.billing_source_id,
        fcli.provider_id,
        COALESCE(NULLIF(${S3_BUCKET_NAME_SQL}, ''), 'unattributed') AS bucket_name,
        dba.billing_account_id AS account_id,
        dr.region_name AS region_name,
        fcli.operation,
        fcli.usage_type,
        fcli.product_family,
        fcli.line_item_description,
        fcli.billed_cost,
        dd.full_date AS usage_date
      FROM fact_cost_line_items fcli
      LEFT JOIN dim_service ds ON ds.id = fcli.service_key
      LEFT JOIN dim_resource dres ON dres.id = fcli.resource_key
      LEFT JOIN dim_billing_account dba ON dba.id = fcli.billing_account_key
      LEFT JOIN dim_region dr ON dr.id = fcli.region_key
      LEFT JOIN dim_date dd ON dd.id = fcli.usage_date_key
      WHERE fcli.tenant_id = $1
        AND fcli.billing_source_id = $2
        AND ${S3_FILTER_SQL}
    ),
    filtered AS (
      SELECT *
      FROM base
      WHERE bucket_name <> 'unattributed'
    ),
    ops_30d AS (
      SELECT
        bucket_name,
        operation,
        SUM(COALESCE(billed_cost, 0)) AS operation_cost
      FROM filtered
      WHERE usage_date >= ($3::date - INTERVAL '30 day')
      GROUP BY bucket_name, operation
    ),
    ops_ranked AS (
      SELECT
        bucket_name,
        operation,
        operation_cost,
        ROW_NUMBER() OVER (PARTITION BY bucket_name ORDER BY operation_cost DESC) AS rn
      FROM ops_30d
    ),
    top_ops AS (
      SELECT
        bucket_name,
        jsonb_agg(
          jsonb_build_object(
            'operation', operation,
            'cost', operation_cost
          )
          ORDER BY operation_cost DESC
        ) AS top_operations_json
      FROM ops_ranked
      WHERE rn <= 5
      GROUP BY bucket_name
    ),
    regions_seen AS (
      SELECT
        bucket_name,
        jsonb_agg(DISTINCT region_name) FILTER (WHERE COALESCE(region_name, '') <> '') AS regions_seen_json
      FROM filtered
      GROUP BY bucket_name
    ),
    rolled AS (
      SELECT
        f.tenant_id,
        f.billing_source_id,
        f.provider_id,
        MIN(f.account_id) AS account_id,
        f.bucket_name,
        MAX(f.usage_date) AS last_seen_usage_date,
        SUM(COALESCE(f.billed_cost, 0)) FILTER (WHERE f.usage_date >= date_trunc('month', $3::date)) AS mtd_bucket_cost,
        SUM(COALESCE(f.billed_cost, 0)) FILTER (WHERE f.usage_date >= ($3::date - INTERVAL '30 day')) AS last_30d_bucket_cost,
        SUM(COALESCE(f.billed_cost, 0)) FILTER (
          WHERE f.usage_date >= ($3::date - INTERVAL '30 day')
            AND ${S3_REQUEST_COST_CONDITION_SQL}
        ) AS request_cost_30d,
        SUM(COALESCE(f.billed_cost, 0)) FILTER (
          WHERE f.usage_date >= ($3::date - INTERVAL '30 day')
            AND ${S3_STORAGE_COST_CONDITION_SQL}
        ) AS storage_cost_30d,
        SUM(COALESCE(f.billed_cost, 0)) FILTER (
          WHERE f.usage_date >= ($3::date - INTERVAL '30 day')
            AND ${S3_TRANSFER_COST_CONDITION_SQL}
        ) AS transfer_cost_30d,
        COUNT(DISTINCT f.usage_date) FILTER (WHERE f.usage_date >= ($3::date - INTERVAL '30 day')) AS active_days_30d
      FROM filtered f
      GROUP BY f.tenant_id, f.billing_source_id, f.provider_id, f.bucket_name
    ),
    inserted AS (
      INSERT INTO s3_bucket_cost_summary_daily (
        tenant_id,
        cloud_connection_id,
        billing_source_id,
        provider_id,
        account_id,
        bucket_name,
        snapshot_date,
        last_seen_usage_date,
        mtd_bucket_cost,
        last_30d_bucket_cost,
        request_cost_30d,
        storage_cost_30d,
        transfer_cost_30d,
        active_days_30d,
        top_operations_json,
        regions_seen_json,
        created_at
      )
      SELECT
        r.tenant_id,
        $4::uuid,
        r.billing_source_id,
        r.provider_id,
        r.account_id,
        r.bucket_name,
        $3::date,
        r.last_seen_usage_date,
        r.mtd_bucket_cost,
        r.last_30d_bucket_cost,
        r.request_cost_30d,
        r.storage_cost_30d,
        r.transfer_cost_30d,
        r.active_days_30d,
        t.top_operations_json,
        rs.regions_seen_json,
        NOW()
      FROM rolled r
      LEFT JOIN top_ops t ON t.bucket_name = r.bucket_name
      LEFT JOIN regions_seen rs ON rs.bucket_name = r.bucket_name
      RETURNING 1
    )
    SELECT COUNT(*)::text AS inserted_count FROM inserted
    `,
    {
      bind: [String(source.tenantId), String(source.id), snapshotDate, connection?.id ? String(connection.id) : null],
      type: QueryTypes.SELECT,
    },
  );

  return { rowsInserted: Number(insertedRows[0]?.inserted_count ?? 0) };
}
