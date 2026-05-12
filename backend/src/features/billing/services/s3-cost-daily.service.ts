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

const validateDateOnly = (value: string, field: "startDate" | "endDate"): void => {
  if (!DATE_ONLY_REGEX.test(value)) {
    throw new Error(`${field} must be in YYYY-MM-DD format`);
  }
};

const normalizeTrim = (value: string | null | undefined): string => String(value ?? "").trim();

type DeletedCountRow = { deleted_rows: number | string };
type InsertedCountRow = { inserted_rows: number | string };

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
        replacements: {
          tenantId,
          startDate: params.startDate,
          endDate: params.endDate,
          cloudConnectionId,
          billingSourceId,
          providerId,
          accountId,
          region,
        },
        type: QueryTypes.SELECT,
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
        COALESCE(NULLIF(
          CASE
            WHEN COALESCE(dres.resource_id, '') = '' THEN 'unattributed'
            WHEN LOWER(dres.resource_id) LIKE 'arn:aws:s3:::%' THEN NULLIF(SPLIT_PART(dres.resource_id, ':::', 2), '')
            WHEN LOWER(dres.resource_id) LIKE 's3://%' THEN NULLIF(SPLIT_PART(SUBSTRING(dres.resource_id FROM 6), '/', 1), '')
            ELSE dres.resource_id
          END
        , ''), 'unattributed') AS bucket_name,
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
          WHEN LOWER(COALESCE(f.product_usage_type, f.usage_type, '')) LIKE '%intelligenttiering%' THEN 'Intelligent-Tiering'
          WHEN LOWER(COALESCE(f.product_usage_type, f.usage_type, '')) LIKE '%onezoneia%' THEN 'One Zone-IA'
          WHEN LOWER(COALESCE(f.product_usage_type, f.usage_type, '')) LIKE '%standardiastorage-bytehrs%'
            OR LOWER(COALESCE(f.product_usage_type, f.usage_type, '')) LIKE '%standard-ia%'
            OR LOWER(COALESCE(f.product_usage_type, f.usage_type, '')) LIKE '%standard ia%' THEN 'Standard-IA'
          WHEN LOWER(COALESCE(f.product_usage_type, f.usage_type, '')) LIKE '%deeparchive%' THEN 'Deep Archive'
          WHEN LOWER(COALESCE(f.product_usage_type, f.usage_type, '')) LIKE '%glacier%' OR LOWER(COALESCE(f.operation, '')) LIKE '%glacier%' THEN 'Glacier'
          WHEN LOWER(COALESCE(f.product_usage_type, f.usage_type, '')) LIKE '%timedstorage%'
            OR LOWER(COALESCE(f.product_usage_type, f.usage_type, '')) LIKE '%standardstorage%' THEN 'S3 Standard'
          ELSE 'Unknown'
        END AS storage_class,
        COALESCE(NULLIF(f.usage_type, ''), 'Unspecified') AS usage_type,
        COALESCE(NULLIF(f.operation, ''), 'Unspecified') AS operation,
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
        product_family,
        pricing_unit,
        COALESCE(SUM(total_cost), 0)::numeric(20,12) AS total_cost,
        COALESCE(SUM(usage_quantity), 0)::numeric(24,8) AS usage_quantity,
        currency_code,
        COUNT(*)::int AS line_item_count
      FROM raw
      GROUP BY
        tenant_id, cloud_connection_id, billing_source_id, provider_id, sub_account_key, region_key,
        account_id, region, bucket_name, usage_date, cost_category, storage_class, usage_type, operation, product_family, pricing_unit, currency_code
    ),
    inserted AS (
      INSERT INTO s3_cost_daily (
        tenant_id, cloud_connection_id, billing_source_id, provider_id, sub_account_key, region_key,
        account_id, region, bucket_name, usage_date, cost_category, storage_class, usage_type, operation, product_family, pricing_unit,
        total_cost, usage_quantity, currency_code, line_item_count, created_at, updated_at
      )
      SELECT
        tenant_id, cloud_connection_id, billing_source_id, provider_id, sub_account_key, region_key,
        account_id, region, bucket_name, usage_date, cost_category, storage_class, usage_type, operation, product_family, pricing_unit,
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
        updated_at = EXCLUDED.updated_at
      RETURNING 1
    )
    SELECT COUNT(*)::int AS inserted_rows FROM inserted;
    `,
    {
      replacements: {
        tenantId,
        startDate: params.startDate,
        endDate: params.endDate,
        cloudConnectionId,
        billingSourceId,
        providerId,
        accountId,
        region,
      },
      type: QueryTypes.SELECT,
    },
  );

  return {
    rowsDeleted,
    rowsInserted: Number(insertedRows[0]?.inserted_rows ?? 0) || 0,
  };
}

