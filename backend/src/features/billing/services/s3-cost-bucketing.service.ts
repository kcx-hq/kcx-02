import { QueryTypes } from "sequelize";

import { sequelize } from "../../../models/index.js";

type GetS3DailyCostBucketsParams = {
  tenantId: string;
  providerId: string | number;
  billingSourceId: string | number;
  startDate: string;
  endDate: string;
};

type S3DailyCostBucketRow = {
  usage_date: string;
  month_start: string;
  charge_category: "storage" | "request" | "data_transfer" | "retrieval" | "replication" | "other";
  storage_class:
    | "standard"
    | "intelligent_tiering"
    | "standard_ia"
    | "one_zone_ia"
    | "glacier_ir"
    | "glacier_flexible"
    | "glacier_deep_archive"
    | "reduced_redundancy"
    | "unknown";
  region_name: string;
  bucket_name: string;
  usage_type: string;
  operation: string;
  line_item_type: string;
  billed_cost: string;
  effective_cost: string;
  list_cost: string;
  usage_quantity: string;
  currency_code: string;
};

const EFFECTIVE_USAGE_DATE_SQL = `
COALESCE(
  dd_usage.full_date,
  DATE(COALESCE(f.usage_start_time, f.usage_end_time))
)
`;

const S3_FILTER_SQL = `
(
  LOWER(COALESCE(ds.service_name, '')) LIKE '%s3%'
  OR LOWER(COALESCE(ds.service_name, '')) LIKE '%simple storage service%'
  OR LOWER(COALESCE(f.usage_type, '')) LIKE '%s3%'
  OR LOWER(COALESCE(dres.resource_id, '')) LIKE 'arn:aws:s3:::%'
  OR LOWER(COALESCE(dres.resource_id, '')) LIKE 's3://%'
)
`;

const S3_CHARGE_CATEGORY_SQL = `
CASE
  WHEN LOWER(COALESCE(f.usage_type, '')) LIKE '%retrieval%'
    OR LOWER(COALESCE(f.line_item_description, '')) LIKE '%retrieval%'
    OR LOWER(COALESCE(f.operation, '')) LIKE '%restore%'
    THEN 'retrieval'
  WHEN LOWER(COALESCE(f.usage_type, '')) LIKE '%replication%'
    OR LOWER(COALESCE(f.line_item_description, '')) LIKE '%replication%'
    OR LOWER(COALESCE(f.operation, '')) LIKE '%replication%'
    OR LOWER(COALESCE(f.operation, '')) LIKE '%replicate%'
    THEN 'replication'
  WHEN (
    LOWER(COALESCE(f.usage_type, '')) LIKE '%data%transfer%'
    OR LOWER(COALESCE(f.line_item_description, '')) LIKE '%data transfer%'
    OR LOWER(COALESCE(f.usage_type, '')) LIKE '%datatransfer%'
    OR LOWER(COALESCE(f.operation, '')) LIKE '%datatransfer%'
    OR LOWER(COALESCE(f.line_item_type, '')) LIKE '%data transfer%'
  )
    THEN 'data_transfer'
  WHEN (
    LOWER(COALESCE(f.operation, '')) LIKE '%put%'
    OR LOWER(COALESCE(f.operation, '')) LIKE '%get%'
    OR LOWER(COALESCE(f.operation, '')) LIKE '%list%'
    OR LOWER(COALESCE(f.operation, '')) LIKE '%head%'
    OR LOWER(COALESCE(f.operation, '')) LIKE '%post%'
    OR LOWER(COALESCE(f.operation, '')) LIKE '%delete%'
    OR LOWER(COALESCE(f.operation, '')) LIKE '%select%'
    OR LOWER(COALESCE(f.usage_type, '')) LIKE '%requests%'
    OR LOWER(COALESCE(f.usage_type, '')) LIKE '%request%'
  )
    THEN 'request'
  WHEN (
    LOWER(COALESCE(f.usage_type, '')) LIKE '%timedstorage%'
    OR LOWER(COALESCE(f.usage_type, '')) LIKE '%storage%'
    OR LOWER(COALESCE(f.usage_type, '')) LIKE '%bytehrs%'
    OR LOWER(COALESCE(f.usage_type, '')) LIKE '%gb-month%'
    OR LOWER(COALESCE(f.usage_type, '')) LIKE '%gbytehrs%'
  )
    THEN 'storage'
  ELSE 'other'
END
`;

const S3_STORAGE_CLASS_SQL = `
CASE
  WHEN LOWER(COALESCE(f.product_usage_type, f.usage_type, '')) LIKE '%intelligent%tiering%' THEN 'intelligent_tiering'
  WHEN LOWER(COALESCE(f.product_usage_type, f.usage_type, '')) LIKE '%onezone-ia%'
    OR LOWER(COALESCE(f.product_usage_type, f.usage_type, '')) LIKE '%one zone-ia%' THEN 'one_zone_ia'
  WHEN LOWER(COALESCE(f.product_usage_type, f.usage_type, '')) LIKE '%standard-ia%'
    OR LOWER(COALESCE(f.product_usage_type, f.usage_type, '')) LIKE '%standard ia%' THEN 'standard_ia'
  WHEN LOWER(COALESCE(f.product_usage_type, f.usage_type, '')) LIKE '%glacier%instant%'
    OR LOWER(COALESCE(f.product_usage_type, f.usage_type, '')) LIKE '%glacier_ir%' THEN 'glacier_ir'
  WHEN LOWER(COALESCE(f.product_usage_type, f.usage_type, '')) LIKE '%deeparchive%'
    OR LOWER(COALESCE(f.product_usage_type, f.usage_type, '')) LIKE '%deep archive%' THEN 'glacier_deep_archive'
  WHEN LOWER(COALESCE(f.product_usage_type, f.usage_type, '')) LIKE '%glacier%'
    OR LOWER(COALESCE(f.operation, '')) LIKE '%glacier%' THEN 'glacier_flexible'
  WHEN LOWER(COALESCE(f.product_usage_type, f.usage_type, '')) LIKE '%reducedredundancy%'
    OR LOWER(COALESCE(f.product_usage_type, f.usage_type, '')) LIKE '%rrs%' THEN 'reduced_redundancy'
  WHEN LOWER(COALESCE(f.product_usage_type, f.usage_type, '')) LIKE '%timedstorage%'
    OR LOWER(COALESCE(f.product_usage_type, f.usage_type, '')) LIKE '%standardstorage%' THEN 'standard'
  ELSE 'unknown'
END
`;

const S3_BUCKET_NAME_SQL = `
CASE
  WHEN COALESCE(dres.resource_id, '') = '' THEN 'unattributed'
  WHEN LOWER(dres.resource_id) LIKE 'arn:aws:s3:::%' THEN NULLIF(SPLIT_PART(dres.resource_id, ':::', 2), '')
  WHEN LOWER(dres.resource_id) LIKE 's3://%' THEN NULLIF(SPLIT_PART(SUBSTRING(dres.resource_id FROM 6), '/', 1), '')
  ELSE dres.resource_id
END
`;

const GET_S3_DAILY_COST_BUCKETS_SQL = `
WITH ranked_facts AS (
  SELECT
    f.*,
    ${EFFECTIVE_USAGE_DATE_SQL} AS effective_usage_date,
    ROW_NUMBER() OVER (
      PARTITION BY
        f.tenant_id,
        f.provider_id,
        f.billing_source_id,
        ${EFFECTIVE_USAGE_DATE_SQL},
        COALESCE(f.service_key, -1),
        COALESCE(f.sub_account_key, -1),
        COALESCE(f.region_key, -1),
        COALESCE(f.resource_key, -1),
        COALESCE(f.billing_account_key, -1),
        COALESCE(f.usage_type, ''),
        COALESCE(f.operation, ''),
        COALESCE(f.line_item_type, ''),
        COALESCE(f.pricing_term, ''),
        COALESCE(f.purchase_option, ''),
        COALESCE(f.reservation_arn, ''),
        COALESCE(f.savings_plan_arn, ''),
        COALESCE(f.savings_plan_type, ''),
        COALESCE(f.billed_cost, 0),
        COALESCE(f.effective_cost, 0),
        COALESCE(f.list_cost, 0),
        COALESCE(f.consumed_quantity, 0),
        COALESCE(f.usage_start_time, f.usage_end_time)
      ORDER BY
        f.ingestion_run_id DESC NULLS LAST,
        f.id DESC
    ) AS dedupe_rank
  FROM fact_cost_line_items f
  LEFT JOIN dim_date dd_usage
    ON dd_usage.id = f.usage_date_key
  WHERE f.tenant_id = CAST(:tenantId AS UUID)
    AND f.provider_id = CAST(:providerId AS BIGINT)
    AND f.billing_source_id = CAST(:billingSourceId AS BIGINT)
    AND ${EFFECTIVE_USAGE_DATE_SQL} >= CAST(:startDate AS DATE)
    AND ${EFFECTIVE_USAGE_DATE_SQL} <= CAST(:endDate AS DATE)
),
s3_rows AS (
  SELECT
    f.effective_usage_date AS usage_date,
    DATE_TRUNC('month', f.effective_usage_date)::DATE AS month_start,
    ${S3_CHARGE_CATEGORY_SQL} AS charge_category,
    ${S3_STORAGE_CLASS_SQL} AS storage_class,
    COALESCE(NULLIF(dr.region_name, ''), NULLIF(dr.region_id, ''), 'global') AS region_name,
    COALESCE(NULLIF(${S3_BUCKET_NAME_SQL}, ''), 'unattributed') AS bucket_name,
    COALESCE(f.usage_type, 'unknown') AS usage_type,
    COALESCE(f.operation, 'unknown') AS operation,
    COALESCE(f.line_item_type, 'unknown') AS line_item_type,
    COALESCE(f.billed_cost, 0) AS billed_cost,
    COALESCE(f.effective_cost, 0) AS effective_cost,
    COALESCE(f.list_cost, 0) AS list_cost,
    COALESCE(f.consumed_quantity, 0) AS usage_quantity,
    COALESCE(NULLIF(dba.billing_currency, ''), 'USD') AS currency_code
  FROM ranked_facts f
  LEFT JOIN dim_service ds
    ON ds.id = f.service_key
  LEFT JOIN dim_resource dres
    ON dres.id = f.resource_key
  LEFT JOIN dim_region dr
    ON dr.id = f.region_key
  LEFT JOIN dim_billing_account dba
    ON dba.id = f.billing_account_key
  WHERE f.dedupe_rank = 1
    AND ${S3_FILTER_SQL}
)
SELECT
  usage_date,
  month_start,
  charge_category,
  storage_class,
  region_name,
  bucket_name,
  usage_type,
  operation,
  line_item_type,
  COALESCE(SUM(billed_cost), 0)::DECIMAL(18,6) AS billed_cost,
  COALESCE(SUM(effective_cost), 0)::DECIMAL(18,6) AS effective_cost,
  COALESCE(SUM(list_cost), 0)::DECIMAL(18,6) AS list_cost,
  COALESCE(SUM(usage_quantity), 0)::DECIMAL(18,6) AS usage_quantity,
  currency_code
FROM s3_rows
GROUP BY
  usage_date,
  month_start,
  charge_category,
  storage_class,
  region_name,
  bucket_name,
  usage_type,
  operation,
  line_item_type,
  currency_code
ORDER BY
  usage_date ASC,
  charge_category ASC,
  billed_cost DESC;
`;

async function getS3DailyCostBuckets({
  tenantId,
  providerId,
  billingSourceId,
  startDate,
  endDate,
}: GetS3DailyCostBucketsParams): Promise<S3DailyCostBucketRow[]> {
  return sequelize.query<S3DailyCostBucketRow>(GET_S3_DAILY_COST_BUCKETS_SQL, {
    replacements: {
      tenantId,
      providerId: String(providerId),
      billingSourceId: String(billingSourceId),
      startDate,
      endDate,
    },
    type: QueryTypes.SELECT,
  });
}

export type { GetS3DailyCostBucketsParams, S3DailyCostBucketRow };
export { getS3DailyCostBuckets };
