import { QueryTypes } from "sequelize";

import { sequelize } from "../../../models/index.js";

type SyncS3CostDailyParams = {
  tenantId: string;
  startDate: string;
  endDate: string;
  cloudConnectionId?: string | null;
  billingSourceId?: string | number | null;
  providerId?: string | number | null;
  accountId?: string | null;
  region?: string | null;
  rebuildRange?: boolean;
};

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const INVALID_S3_BUCKET_VALUES = [
  "unattributed",
  "aws.s3",
  "lambda",
  "amazon s3",
  "s3",
  "credits / adjustments",
] as const;

const validateDateOnly = (value: string, field: "startDate" | "endDate"): void => {
  if (!DATE_ONLY_REGEX.test(value)) {
    throw new Error(`${field} must be in YYYY-MM-DD format`);
  }
};

const normalizeTrim = (value: string | null | undefined): string => String(value ?? "").trim();

export function getS3OperationGroup(operation?: string | null): string {
  if (!operation) return "Other";

  const op = operation.toLowerCase();

  if (
    op.includes("putobject") ||
    op.includes("copyobject") ||
    op.includes("uploadpart") ||
    op.includes("multipartupload")
  ) {
    return "Write";
  }

  if (
    op.includes("getobject") ||
    op.includes("headobject") ||
    op.includes("selectobject")
  ) {
    return "Read";
  }

  if (
    op.includes("listbucket") ||
    op.includes("listallmybuckets") ||
    op.includes("readacl") ||
    op.includes("getbucket") ||
    op.includes("headbucket") ||
    op.includes("readbucket")
  ) {
    return "List & Metadata";
  }

  if (
    op.includes("deleteobject") ||
    op.includes("abortmultipartupload")
  ) {
    return "Delete";
  }

  if (
    op.includes("restore") ||
    op.includes("lifecycle") ||
    op.includes("glacier")
  ) {
    return "Lifecycle & Archive";
  }

  if (
    op.includes("replication") ||
    op.includes("replicate")
  ) {
    return "Replication";
  }

  return "Other";
}

export function getS3StorageClass(
  usageType?: string | null,
  operation?: string | null,
  productUsageType?: string | null,
): string | null {
  const value = [usageType, operation, productUsageType]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!value) return null;

  if (
    value.includes("deeparchive") ||
    value.includes("deep archive")
  ) {
    return "Deep Archive";
  }

  if (
    value.includes("intelligenttiering") ||
    value.includes("intelligent-tiering") ||
    value.includes("intelligent tiering")
  ) {
    return "Intelligent Tiering";
  }

  if (
    value.includes("onezoneia") ||
    value.includes("one zone") ||
    value.includes("onezone")
  ) {
    return "One Zone-IA";
  }

  if (
    value.includes("standardia") ||
    value.includes("standard-ia") ||
    value.includes("standard infrequent access")
  ) {
    return "Standard-IA";
  }

  if (
    value.includes("glacier") ||
    value.includes("archive")
  ) {
    return "Glacier";
  }

  if (
    value.includes("standardstorage") ||
    value.includes("standard storage") ||
    value.includes("timedstorage-bytehrs") ||
    value.includes("bytehrs")
  ) {
    return "S3 Standard";
  }

  return null;
}

export function isValidS3BucketName(value?: string | null): boolean {
  if (!value) return false;

  const v = value.trim().toLowerCase();
  if (!v) return false;

  if ((INVALID_S3_BUCKET_VALUES as readonly string[]).includes(v)) return false;

  if (v.startsWith("arn:aws:s3:") && v.includes(":storage-lens/")) return false;

  return /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(v);
}

type DeletedCountRow = { deleted_rows: number | string };
type InsertedCountRow = { inserted_rows: number | string };
type SourceCountRow = { source_rows: number | string };

export async function syncS3CostDaily(params: SyncS3CostDailyParams): Promise<{
  rowsDeleted: number;
  rowsInserted: number;
}> {
  validateDateOnly(params.startDate, "startDate");
  validateDateOnly(params.endDate, "endDate");
  if (params.startDate > params.endDate) {
    throw new Error("startDate must be <= endDate");
  }

  const tenantId = normalizeTrim(params.tenantId);
  if (!tenantId) throw new Error("tenantId is required");

  const cloudConnectionId = normalizeTrim(params.cloudConnectionId) || null;
  const billingSourceId = params.billingSourceId == null ? null : Number(params.billingSourceId);
  const providerId = params.providerId == null ? null : Number(params.providerId);
  const accountId = normalizeTrim(params.accountId) || null;
  const region = normalizeTrim(params.region) || null;

  const replacements = {
    tenantId,
    startDate: params.startDate,
    endDate: params.endDate,
    cloudConnectionId,
    billingSourceId,
    providerId,
    accountId,
    region,
    defaultOperationGroup: getS3OperationGroup(null),
  };

  const sourceRows = await sequelize.query<SourceCountRow>(
    `
    SELECT COUNT(*)::int AS source_rows
    FROM fact_cost_line_items f
    LEFT JOIN dim_date dd ON dd.id = f.usage_date_key
    LEFT JOIN billing_sources bs ON bs.id = f.billing_source_id
    LEFT JOIN dim_service ds ON ds.id = f.service_key
    LEFT JOIN dim_resource dres ON dres.id = f.resource_key
    LEFT JOIN dim_region dr ON dr.id = f.region_key
    LEFT JOIN dim_sub_account dsa ON dsa.id = f.sub_account_key
    LEFT JOIN dim_billing_account dba ON dba.id = f.billing_account_key
    WHERE f.tenant_id = CAST(:tenantId AS uuid)
      AND COALESCE(dd.full_date, DATE(COALESCE(f.usage_start_time, f.usage_end_time))) >= CAST(:startDate AS date)
      AND COALESCE(dd.full_date, DATE(COALESCE(f.usage_start_time, f.usage_end_time))) <= CAST(:endDate AS date)
      AND (CAST(:cloudConnectionId AS uuid) IS NULL OR bs.cloud_connection_id = CAST(:cloudConnectionId AS uuid))
      AND (:billingSourceId::bigint IS NULL OR f.billing_source_id = :billingSourceId::bigint)
      AND (:providerId::bigint IS NULL OR f.provider_id = :providerId::bigint)
      AND (:accountId::text IS NULL OR COALESCE(NULLIF(TRIM(dsa.sub_account_id), ''), NULLIF(TRIM(dba.billing_account_id), '')) = :accountId::text)
      AND (:region::text IS NULL OR COALESCE(NULLIF(TRIM(dr.region_name), ''), NULLIF(TRIM(dr.region_id), ''), 'global') = :region::text)
      AND (
        LOWER(COALESCE(ds.service_name, '')) LIKE '%s3%'
        OR LOWER(COALESCE(ds.service_name, '')) LIKE '%simple storage service%'
        OR LOWER(COALESCE(f.usage_type, '')) LIKE '%s3%'
        OR LOWER(COALESCE(dres.resource_id, '')) LIKE 'arn:aws:s3:::%'
        OR LOWER(COALESCE(dres.resource_id, '')) LIKE 's3://%'
      );
    `,
    { replacements, type: QueryTypes.SELECT },
  );

  const sourceRowCount = Number(sourceRows[0]?.source_rows ?? 0) || 0;
  if (sourceRowCount === 0) {
    return { rowsDeleted: 0, rowsInserted: 0 };
  }

  const result = await sequelize.transaction(async (transaction) => {
    let rowsDeleted = 0;
    if (params.rebuildRange !== false) {
      const deletedRows = await sequelize.query<DeletedCountRow>(
        `
        WITH deleted AS (
          DELETE FROM s3_cost_daily
          WHERE tenant_id = CAST(:tenantId AS uuid)
            AND usage_date >= CAST(:startDate AS date)
            AND usage_date <= CAST(:endDate AS date)
            AND (CAST(:cloudConnectionId AS uuid) IS NULL OR cloud_connection_id = CAST(:cloudConnectionId AS uuid))
            AND (:billingSourceId::bigint IS NULL OR billing_source_id = :billingSourceId::bigint)
            AND (:providerId::bigint IS NULL OR provider_id = :providerId::bigint)
            AND (:accountId::text IS NULL OR account_id = :accountId::text)
            AND (:region::text IS NULL OR region = :region::text)
          RETURNING 1
        )
        SELECT COUNT(*)::int AS deleted_rows FROM deleted;
        `,
        {
          replacements,
          type: QueryTypes.SELECT,
          transaction,
        },
      );
      rowsDeleted = Number(deletedRows[0]?.deleted_rows ?? 0) || 0;
    }

    const insertedRows = await sequelize.query<InsertedCountRow>(
      `
    WITH raw AS (
      SELECT
        f.tenant_id,
        bs.cloud_connection_id,
        f.billing_source_id,
        f.provider_id,
        f.sub_account_key,
        f.region_key,
        COALESCE(NULLIF(TRIM(dsa.sub_account_id), ''), NULLIF(TRIM(dba.billing_account_id), '')) AS account_id,
        COALESCE(NULLIF(TRIM(dr.region_name), ''), NULLIF(TRIM(dr.region_id), ''), 'global') AS region,
        COALESCE(dd.full_date, DATE(COALESCE(f.usage_start_time, f.usage_end_time)))::date AS usage_date,
        CASE
          WHEN LOWER(COALESCE(f.line_item_type, '')) = 'credit' THEN NULL
          ELSE
            CASE
              WHEN (
                CASE
                  WHEN COALESCE(dres.resource_id, '') = '' THEN NULL
                  WHEN LOWER(dres.resource_id) LIKE 'arn:aws:s3:::%' THEN NULLIF(SPLIT_PART(dres.resource_id, ':::', 2), '')
                  WHEN LOWER(dres.resource_id) LIKE 's3://%' THEN NULLIF(SPLIT_PART(SUBSTRING(dres.resource_id FROM 6), '/', 1), '')
                  ELSE dres.resource_id
                END
              ) IS NULL THEN NULL
              WHEN LOWER(
                CASE
                  WHEN COALESCE(dres.resource_id, '') = '' THEN ''
                  WHEN LOWER(dres.resource_id) LIKE 'arn:aws:s3:::%' THEN COALESCE(NULLIF(SPLIT_PART(dres.resource_id, ':::', 2), ''), '')
                  WHEN LOWER(dres.resource_id) LIKE 's3://%' THEN COALESCE(NULLIF(SPLIT_PART(SUBSTRING(dres.resource_id FROM 6), '/', 1), ''), '')
                  ELSE COALESCE(dres.resource_id, '')
                END
              ) = ANY (ARRAY['unattributed', 'aws.s3', 'lambda', 'amazon s3', 's3', 'credits / adjustments']::text[]) THEN NULL
              WHEN LOWER(
                CASE
                  WHEN COALESCE(dres.resource_id, '') = '' THEN ''
                  WHEN LOWER(dres.resource_id) LIKE 'arn:aws:s3:::%' THEN COALESCE(NULLIF(SPLIT_PART(dres.resource_id, ':::', 2), ''), '')
                  WHEN LOWER(dres.resource_id) LIKE 's3://%' THEN COALESCE(NULLIF(SPLIT_PART(SUBSTRING(dres.resource_id FROM 6), '/', 1), ''), '')
                  ELSE COALESCE(dres.resource_id, '')
                END
              ) LIKE 'arn:aws:s3:%:storage-lens/%' THEN NULL
              WHEN LOWER(
                CASE
                  WHEN COALESCE(dres.resource_id, '') = '' THEN ''
                  WHEN LOWER(dres.resource_id) LIKE 'arn:aws:s3:::%' THEN COALESCE(NULLIF(SPLIT_PART(dres.resource_id, ':::', 2), ''), '')
                  WHEN LOWER(dres.resource_id) LIKE 's3://%' THEN COALESCE(NULLIF(SPLIT_PART(SUBSTRING(dres.resource_id FROM 6), '/', 1), ''), '')
                  ELSE COALESCE(dres.resource_id, '')
                END
              ) ~ '^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$' THEN
                CASE
                  WHEN COALESCE(dres.resource_id, '') = '' THEN NULL
                  WHEN LOWER(dres.resource_id) LIKE 'arn:aws:s3:::%' THEN NULLIF(SPLIT_PART(dres.resource_id, ':::', 2), '')
                  WHEN LOWER(dres.resource_id) LIKE 's3://%' THEN NULLIF(SPLIT_PART(SUBSTRING(dres.resource_id FROM 6), '/', 1), '')
                  ELSE dres.resource_id
                END
              ELSE NULL
            END
        END AS bucket_name,
        CASE
          WHEN (
            LOWER(COALESCE(f.usage_type, '')) LIKE '%retrieval%'
            OR LOWER(COALESCE(f.line_item_description, '')) LIKE '%retrieval%'
            OR LOWER(COALESCE(f.operation, '')) LIKE '%restore%'
            OR LOWER(COALESCE(f.operation, '')) LIKE '%selectobjectcontent%'
          ) THEN 'Retrieval'
          WHEN (
            LOWER(COALESCE(f.usage_type, '')) LIKE 'requests%'
          ) THEN 'Request'
          WHEN (
            LOWER(TRIM(COALESCE(NULLIF(f.product_family, ''), ''))) = 'data transfer'
            OR LOWER(COALESCE(f.usage_type, '')) LIKE '%datatransfer%'
            OR LOWER(COALESCE(f.usage_type, '')) LIKE '%out-bytes%'
            OR LOWER(COALESCE(f.usage_type, '')) LIKE '%in-bytes%'
            OR LOWER(COALESCE(f.line_item_description, '')) LIKE '%data transfer%'
            OR LOWER(COALESCE(f.operation, '')) LIKE '%datatransfer%'
          ) THEN 'Transfer'
          WHEN (
            LOWER(COALESCE(f.usage_type, '')) LIKE '%timedstorage%'
            OR LOWER(COALESCE(f.usage_type, '')) LIKE '%storage%'
            OR LOWER(COALESCE(f.usage_type, '')) LIKE '%bytehrs%'
            OR LOWER(COALESCE(f.usage_type, '')) LIKE '%gb-month%'
            OR LOWER(COALESCE(f.usage_type, '')) LIKE '%gbytehrs%'
          ) THEN 'Storage'
          ELSE 'Other'
        END AS cost_category,
        CASE
          WHEN (
            LOWER(COALESCE(f.usage_type, '')) LIKE '%timedstorage%'
            OR LOWER(COALESCE(f.usage_type, '')) LIKE '%storage%'
            OR LOWER(COALESCE(f.usage_type, '')) LIKE '%bytehrs%'
            OR LOWER(COALESCE(f.usage_type, '')) LIKE '%gb-month%'
            OR LOWER(COALESCE(f.usage_type, '')) LIKE '%gbytehrs%'
          ) THEN
            CASE
              WHEN LOWER(COALESCE(f.usage_type, '') || ' ' || COALESCE(f.operation, '') || ' ' || COALESCE(f.product_usage_type, '')) LIKE '%deeparchive%'
                OR LOWER(COALESCE(f.usage_type, '') || ' ' || COALESCE(f.operation, '') || ' ' || COALESCE(f.product_usage_type, '')) LIKE '%deep archive%'
              THEN 'Deep Archive'
              WHEN LOWER(COALESCE(f.usage_type, '') || ' ' || COALESCE(f.operation, '') || ' ' || COALESCE(f.product_usage_type, '')) LIKE '%intelligenttiering%'
                OR LOWER(COALESCE(f.usage_type, '') || ' ' || COALESCE(f.operation, '') || ' ' || COALESCE(f.product_usage_type, '')) LIKE '%intelligent-tiering%'
                OR LOWER(COALESCE(f.usage_type, '') || ' ' || COALESCE(f.operation, '') || ' ' || COALESCE(f.product_usage_type, '')) LIKE '%intelligent tiering%'
              THEN 'Intelligent Tiering'
              WHEN LOWER(COALESCE(f.usage_type, '') || ' ' || COALESCE(f.operation, '') || ' ' || COALESCE(f.product_usage_type, '')) LIKE '%onezoneia%'
                OR LOWER(COALESCE(f.usage_type, '') || ' ' || COALESCE(f.operation, '') || ' ' || COALESCE(f.product_usage_type, '')) LIKE '%one zone%'
                OR LOWER(COALESCE(f.usage_type, '') || ' ' || COALESCE(f.operation, '') || ' ' || COALESCE(f.product_usage_type, '')) LIKE '%onezone%'
              THEN 'One Zone-IA'
              WHEN LOWER(COALESCE(f.usage_type, '') || ' ' || COALESCE(f.operation, '') || ' ' || COALESCE(f.product_usage_type, '')) LIKE '%standardia%'
                OR LOWER(COALESCE(f.usage_type, '') || ' ' || COALESCE(f.operation, '') || ' ' || COALESCE(f.product_usage_type, '')) LIKE '%standard-ia%'
                OR LOWER(COALESCE(f.usage_type, '') || ' ' || COALESCE(f.operation, '') || ' ' || COALESCE(f.product_usage_type, '')) LIKE '%standard infrequent access%'
              THEN 'Standard-IA'
              WHEN LOWER(COALESCE(f.usage_type, '') || ' ' || COALESCE(f.operation, '') || ' ' || COALESCE(f.product_usage_type, '')) LIKE '%glacier%'
                OR LOWER(COALESCE(f.usage_type, '') || ' ' || COALESCE(f.operation, '') || ' ' || COALESCE(f.product_usage_type, '')) LIKE '%archive%'
              THEN 'Glacier'
              WHEN LOWER(COALESCE(f.usage_type, '') || ' ' || COALESCE(f.operation, '') || ' ' || COALESCE(f.product_usage_type, '')) LIKE '%standardstorage%'
                OR LOWER(COALESCE(f.usage_type, '') || ' ' || COALESCE(f.operation, '') || ' ' || COALESCE(f.product_usage_type, '')) LIKE '%standard storage%'
                OR LOWER(COALESCE(f.usage_type, '') || ' ' || COALESCE(f.operation, '') || ' ' || COALESCE(f.product_usage_type, '')) LIKE '%timedstorage-bytehrs%'
                OR LOWER(COALESCE(f.usage_type, '') || ' ' || COALESCE(f.operation, '') || ' ' || COALESCE(f.product_usage_type, '')) LIKE '%bytehrs%'
              THEN 'S3 Standard'
              ELSE NULL
            END
          ELSE NULL
        END AS storage_class,
        COALESCE(NULLIF(f.usage_type, ''), 'Unspecified') AS usage_type,
        COALESCE(NULLIF(f.operation, ''), 'Unspecified') AS operation,
        CASE
          WHEN f.operation IS NULL THEN :defaultOperationGroup::text
          WHEN LOWER(f.operation) LIKE '%putobject%'
            OR LOWER(f.operation) LIKE '%copyobject%'
            OR LOWER(f.operation) LIKE '%uploadpart%'
            OR LOWER(f.operation) LIKE '%multipartupload%'
          THEN 'Write'
          WHEN LOWER(f.operation) LIKE '%getobject%'
            OR LOWER(f.operation) LIKE '%headobject%'
            OR LOWER(f.operation) LIKE '%selectobject%'
          THEN 'Read'
          WHEN LOWER(f.operation) LIKE '%listbucket%'
            OR LOWER(f.operation) LIKE '%listallmybuckets%'
            OR LOWER(f.operation) LIKE '%readacl%'
            OR LOWER(f.operation) LIKE '%getbucket%'
            OR LOWER(f.operation) LIKE '%headbucket%'
            OR LOWER(f.operation) LIKE '%readbucket%'
          THEN 'List & Metadata'
          WHEN LOWER(f.operation) LIKE '%deleteobject%'
            OR LOWER(f.operation) LIKE '%abortmultipartupload%'
          THEN 'Delete'
          WHEN LOWER(f.operation) LIKE '%restore%'
            OR LOWER(f.operation) LIKE '%lifecycle%'
            OR LOWER(f.operation) LIKE '%glacier%'
          THEN 'Lifecycle & Archive'
          WHEN LOWER(f.operation) LIKE '%replication%'
            OR LOWER(f.operation) LIKE '%replicate%'
          THEN 'Replication'
          ELSE 'Other'
        END AS operation_group,
        COALESCE(NULLIF(f.product_family, ''), 'Unspecified') AS product_family,
        COALESCE(NULLIF(dsku.pricing_unit, ''), 'Units') AS pricing_unit,
        COALESCE(f.billed_cost, 0)::numeric AS total_cost,
        COALESCE(f.consumed_quantity, 0)::numeric AS usage_quantity,
        COALESCE(NULLIF(TRIM(dba.billing_currency), ''), 'USD') AS currency_code
      FROM fact_cost_line_items f
      LEFT JOIN dim_date dd ON dd.id = f.usage_date_key
      LEFT JOIN billing_sources bs ON bs.id = f.billing_source_id
      LEFT JOIN dim_service ds ON ds.id = f.service_key
      LEFT JOIN dim_resource dres ON dres.id = f.resource_key
      LEFT JOIN dim_region dr ON dr.id = f.region_key
      LEFT JOIN dim_sub_account dsa ON dsa.id = f.sub_account_key
      LEFT JOIN dim_billing_account dba ON dba.id = f.billing_account_key
      LEFT JOIN dim_sku dsku ON dsku.id = f.sku_key
      WHERE f.tenant_id = CAST(:tenantId AS uuid)
        AND COALESCE(dd.full_date, DATE(COALESCE(f.usage_start_time, f.usage_end_time))) >= CAST(:startDate AS date)
        AND COALESCE(dd.full_date, DATE(COALESCE(f.usage_start_time, f.usage_end_time))) <= CAST(:endDate AS date)
        AND (CAST(:cloudConnectionId AS uuid) IS NULL OR bs.cloud_connection_id = CAST(:cloudConnectionId AS uuid))
        AND (:billingSourceId::bigint IS NULL OR f.billing_source_id = :billingSourceId::bigint)
        AND (:providerId::bigint IS NULL OR f.provider_id = :providerId::bigint)
        AND (:accountId::text IS NULL OR COALESCE(NULLIF(TRIM(dsa.sub_account_id), ''), NULLIF(TRIM(dba.billing_account_id), '')) = :accountId::text)
        AND (:region::text IS NULL OR COALESCE(NULLIF(TRIM(dr.region_name), ''), NULLIF(TRIM(dr.region_id), ''), 'global') = :region::text)
        AND (
          LOWER(COALESCE(ds.service_name, '')) LIKE '%s3%'
          OR LOWER(COALESCE(ds.service_name, '')) LIKE '%simple storage service%'
          OR LOWER(COALESCE(f.usage_type, '')) LIKE '%s3%'
          OR LOWER(COALESCE(dres.resource_id, '')) LIKE 'arn:aws:s3:::%'
          OR LOWER(COALESCE(dres.resource_id, '')) LIKE 's3://%'
        )
    ),
    rolled AS (
      SELECT
        tenant_id,
        cloud_connection_id,
        billing_source_id,
        provider_id,
        sub_account_key,
        region_key,
        account_id,
        region,
        bucket_name,
        usage_date,
        cost_category,
        storage_class,
        usage_type,
        operation,
        operation_group,
        product_family,
        pricing_unit,
        COALESCE(SUM(total_cost), 0)::numeric(20,12) AS total_cost,
        COALESCE(SUM(usage_quantity), 0)::numeric(24,8) AS usage_quantity,
        currency_code,
        COUNT(*)::int AS line_item_count
      FROM raw
      GROUP BY
        tenant_id, cloud_connection_id, billing_source_id, provider_id, sub_account_key, region_key,
        account_id, region, bucket_name, usage_date, cost_category, storage_class, usage_type, operation, operation_group, product_family, pricing_unit, currency_code
    ),
    inserted AS (
      INSERT INTO s3_cost_daily (
        tenant_id, cloud_connection_id, billing_source_id, provider_id, sub_account_key, region_key,
        account_id, region, bucket_name, usage_date, cost_category, storage_class, usage_type, operation, operation_group, product_family, pricing_unit,
        total_cost, usage_quantity, currency_code, line_item_count, created_at, updated_at
      )
      SELECT
        tenant_id, cloud_connection_id, billing_source_id, provider_id, sub_account_key, region_key,
        account_id, region, bucket_name, usage_date, cost_category, storage_class, usage_type, operation, operation_group, product_family, pricing_unit,
        total_cost, usage_quantity, currency_code, line_item_count, NOW(), NOW()
      FROM rolled
      ON CONFLICT (
        tenant_id, cloud_connection_id, billing_source_id, provider_id, sub_account_key, region_key,
        account_id, region, bucket_name, usage_date, cost_category, storage_class, usage_type, operation, product_family, pricing_unit, currency_code
      )
      DO UPDATE SET
        total_cost = EXCLUDED.total_cost,
        usage_quantity = EXCLUDED.usage_quantity,
        line_item_count = EXCLUDED.line_item_count,
        operation_group = EXCLUDED.operation_group,
        updated_at = EXCLUDED.updated_at
      RETURNING 1
    )
    SELECT COUNT(*)::int AS inserted_rows FROM inserted;
    `,
      {
        replacements,
        type: QueryTypes.SELECT,
        transaction,
      },
    );

    const rowsInserted = Number(insertedRows[0]?.inserted_rows ?? 0) || 0;
    if (rowsInserted <= 0 && rowsDeleted > 0) {
      throw new Error("s3_cost_daily rebuild produced zero inserted rows; rolling back delete");
    }

    return { rowsDeleted, rowsInserted };
  });

  return result;
}

