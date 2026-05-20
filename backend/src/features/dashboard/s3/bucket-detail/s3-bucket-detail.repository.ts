import { QueryTypes } from "sequelize";

import { sequelize } from "../../../../models/index.js";
import type { DashboardScope } from "../../dashboard.types.js";

type BucketConfigRow = {
  bucket_name: string | null;
  account_id: string | null;
  region: string | null;
  owner: string | null;
  environment: string | null;
  encryption_status: string | null;
  versioning_status: string | null;
  public_access_status: string | null;
  lifecycle_status: string | null;
  lifecycle_rules_count: number | string | null;
  enabled_lifecycle_rules_count: number | string | null;
  transition_rules_count: number | string | null;
  replication_status: string | null;
  replication_rules_count: number | string | null;
  replication_config_json: unknown;
  scan_time: string | null;
};

type StorageLensLatestRow = {
  usage_date: string | null;
  region: string | null;
  object_count: number | string | null;
  current_version_bytes: number | string | null;
  avg_object_size_bytes: number | string | null;
};

type CurRegionRow = { region: string | null };
type DailyMetricRow = { usage_date: string | null; value: number | string | null };
type EstimatedBytesRow = { value: number | string | null };

const toNumber = (value: number | string | null | undefined): number | null => {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toIsoDate = (value: Date): string => value.toISOString().slice(0, 10);

const buildLast30Days = (toDate: string): { from: string; to: string } => {
  const end = new Date(`${toDate}T00:00:00.000Z`);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 29);
  return { from: toIsoDate(start), to: toIsoDate(end) };
};

export class S3BucketDetailRepository {
  private buildScopedConditions(scope: DashboardScope, dateColumn: string, binds: unknown[]): string[] {
    const where: string[] = ["tenant_id = $1::uuid"];
    if (scope.scopeType === "global") {
      if (typeof scope.providerId === "number") {
        binds.push(scope.providerId);
        where.push(`${"provider_id"} = $${binds.length}`);
      }
      if (Array.isArray(scope.billingSourceIds) && scope.billingSourceIds.length > 0) {
        binds.push(scope.billingSourceIds);
        where.push(`${"billing_source_id"} = ANY($${binds.length}::bigint[])`);
      }
      if (typeof scope.subAccountKey === "number") {
        binds.push(scope.subAccountKey);
        where.push(`${"sub_account_key"} = $${binds.length}`);
      }
      if (typeof scope.regionKey === "number") {
        binds.push(scope.regionKey);
        where.push(`${"region_key"} = $${binds.length}`);
      }
    }

    const { from, to } = buildLast30Days(scope.to);
    binds.push(from);
    where.push(`${dateColumn} >= $${binds.length}::date`);
    binds.push(to);
    where.push(`${dateColumn} <= $${binds.length}::date`);

    return where;
  }

  async getBucketConfig(scope: DashboardScope, bucketName: string): Promise<BucketConfigRow | null> {
    const binds: unknown[] = [scope.tenantId, bucketName];
    const where = ["tenant_id = $1::uuid", "LOWER(bucket_name) = LOWER($2::text)"];
    if (scope.scopeType === "global") {
      if (typeof scope.providerId === "number") {
        binds.push(scope.providerId);
        where.push(`provider_id = $${binds.length}`);
      }
      if (Array.isArray(scope.billingSourceIds) && scope.billingSourceIds.length > 0) {
        binds.push(scope.billingSourceIds);
        where.push(`billing_source_id = ANY($${binds.length}::bigint[])`);
      }
    }

    const row = await sequelize.query<BucketConfigRow>(
      `
      SELECT
        bucket_name,
        account_id,
        region,
        NULL::text AS owner,
        NULL::text AS environment,
        encryption_status,
        versioning_status,
        public_access_block_status AS public_access_status,
        lifecycle_status,
        lifecycle_rules_count,
        COALESCE(lifecycle_rules_count, 0) AS enabled_lifecycle_rules_count,
        0::bigint AS transition_rules_count,
        replication_status,
        replication_rules_count,
        replication_config_json,
        scan_time::text AS scan_time
      FROM s3_bucket_config_snapshot
      WHERE ${where.join("\n        AND ")}
      ORDER BY scan_time DESC
      LIMIT 1;
      `,
      { bind: binds, type: QueryTypes.SELECT, plain: true },
    );

    return row ?? null;
  }

  async getLatestStorageLens(scope: DashboardScope, bucketName: string): Promise<StorageLensLatestRow | null> {
    const binds: unknown[] = [scope.tenantId, bucketName];
    const where: string[] = ["tenant_id = $1::uuid"];
    where.push(`LOWER(bucket_name) = LOWER($2::text)`);
    if (scope.scopeType === "global") {
      if (typeof scope.providerId === "number") {
        binds.push(scope.providerId);
        where.push(`provider_id = $${binds.length}`);
      }
      if (Array.isArray(scope.billingSourceIds) && scope.billingSourceIds.length > 0) {
        binds.push(scope.billingSourceIds);
        where.push(`billing_source_id = ANY($${binds.length}::bigint[])`);
      }
      if (typeof scope.subAccountKey === "number") {
        binds.push(scope.subAccountKey);
        where.push(`sub_account_key = $${binds.length}`);
      }
      if (typeof scope.regionKey === "number") {
        binds.push(scope.regionKey);
        where.push(`region_key = $${binds.length}`);
      }
    }

    const row = await sequelize.query<StorageLensLatestRow>(
      `
      SELECT
        sld.usage_date::text AS usage_date,
        COALESCE(dr.region_name, dr.region_id, NULL)::text AS region,
        sld.object_count,
        sld.current_version_bytes,
        sld.avg_object_size_bytes
      FROM s3_storage_lens_daily sld
      LEFT JOIN dim_region dr ON dr.id = sld.region_key
      WHERE ${where.join("\n        AND ")}
      ORDER BY sld.usage_date DESC
      LIMIT 1;
      `,
      { bind: binds, type: QueryTypes.SELECT, plain: true },
    );

    return row ?? null;
  }

  async getCurRegionFallback(scope: DashboardScope, bucketName: string): Promise<string | null> {
    const binds: unknown[] = [scope.tenantId, bucketName];
    const where = this.buildScopedConditions(scope, "usage_date", binds);
    where.push(`LOWER(bucket_name) = LOWER($2::text)`);

    const row = await sequelize.query<CurRegionRow>(
      `
      SELECT region
      FROM s3_cost_daily
      WHERE ${where.join("\n        AND ")}
        AND COALESCE(NULLIF(region, ''), '') <> ''
      GROUP BY region
      ORDER BY SUM(COALESCE(total_cost, 0)) DESC, region ASC
      LIMIT 1;
      `,
      { bind: binds, type: QueryTypes.SELECT, plain: true },
    );
    return row?.region ? String(row.region) : null;
  }

  async getStorageSeries(scope: DashboardScope, bucketName: string): Promise<Map<string, number>> {
    const binds: unknown[] = [scope.tenantId, bucketName];
    const where = this.buildScopedConditions(scope, "usage_date", binds);
    where.push(`LOWER(bucket_name) = LOWER($2::text)`);
    const rows = await sequelize.query<DailyMetricRow>(
      `
      SELECT
        usage_date::text AS usage_date,
        (MAX(current_version_bytes) / 1073741824.0)::double precision AS value
      FROM s3_storage_lens_daily
      WHERE ${where.join("\n        AND ")}
      GROUP BY usage_date
      ORDER BY usage_date ASC;
      `,
      { bind: binds, type: QueryTypes.SELECT },
    );
    return new Map(
      rows
        .filter((r) => r.usage_date && toNumber(r.value) != null)
        .map((r) => [String(r.usage_date), Number(toNumber(r.value) ?? 0)]),
    );
  }

  async getRequestSeries(scope: DashboardScope, bucketName: string): Promise<Map<string, number>> {
    const binds: unknown[] = [scope.tenantId, bucketName];
    const where = this.buildScopedConditions(scope, "usage_date", binds);
    where.push(`LOWER(bucket_name) = LOWER($2::text)`);
    where.push("cost_category = 'Request'");
    where.push("LOWER(COALESCE(pricing_unit, '')) = 'requests'");

    const rows = await sequelize.query<DailyMetricRow>(
      `
      SELECT
        usage_date::text AS usage_date,
        COALESCE(SUM(COALESCE(usage_quantity, 0)), 0)::double precision AS value
      FROM s3_cost_daily
      WHERE ${where.join("\n        AND ")}
      GROUP BY usage_date
      ORDER BY usage_date ASC;
      `,
      { bind: binds, type: QueryTypes.SELECT },
    );

    return new Map(rows.filter((r) => r.usage_date).map((r) => [String(r.usage_date), Number(toNumber(r.value) ?? 0)]));
  }

  async getTransferSeries(scope: DashboardScope, bucketName: string): Promise<Map<string, number>> {
    const binds: unknown[] = [scope.tenantId, bucketName];
    const where = this.buildScopedConditions(scope, "usage_date", binds);
    where.push(`LOWER(bucket_name) = LOWER($2::text)`);
    where.push("cost_category = 'Transfer'");
    where.push("LOWER(COALESCE(pricing_unit, '')) = 'gb'");
    where.push("bucket_name = $2::text");
    where.push("operation IS NOT NULL");
    where.push("NULLIF(TRIM(operation), '') IS NOT NULL");
    where.push("TRIM(operation) NOT IN ('Unspecified', 'None')");
    where.push("NOT (COALESCE(total_cost, 0) = 0 AND COALESCE(usage_quantity, 0) >= 1)");

    const rows = await sequelize.query<DailyMetricRow>(
      `
      SELECT
        usage_date::text AS usage_date,
        COALESCE(SUM(COALESCE(usage_quantity, 0)), 0)::double precision AS value
      FROM s3_cost_daily
      WHERE ${where.join("\n        AND ")}
      GROUP BY usage_date
      ORDER BY usage_date ASC;
      `,
      { bind: binds, type: QueryTypes.SELECT },
    );

    return new Map(rows.filter((r) => r.usage_date).map((r) => [String(r.usage_date), Number(toNumber(r.value) ?? 0)]));
  }

  getLast30DaysWindow(scope: DashboardScope): { from: string; to: string; labels: string[] } {
    const range = buildLast30Days(scope.to);
    const labels: string[] = [];
    const start = new Date(`${range.from}T00:00:00.000Z`);
    const end = new Date(`${range.to}T00:00:00.000Z`);
    const cursor = new Date(start);
    while (cursor <= end) {
      labels.push(toIsoDate(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return { ...range, labels };
  }

  parseNumber(value: number | string | null | undefined): number | null {
    return toNumber(value);
  }

  async getEstimatedCurrentVersionBytes(scope: DashboardScope, bucketName: string): Promise<number | null> {
    const binds: unknown[] = [scope.tenantId, bucketName];
    const where = this.buildScopedConditions(scope, "usage_date", binds);
    where.push("bucket_name = $2::text");
    where.push("cost_category = 'Storage'");
    where.push("LOWER(COALESCE(usage_type, '')) LIKE '%timedstorage-bytehrs%'");

    const row = await sequelize.query<EstimatedBytesRow>(
      `
      WITH latest_day AS (
        SELECT MAX(usage_date) AS usage_date
        FROM s3_cost_daily
        WHERE ${where.join("\n          AND ")}
      )
      SELECT
        (
          COALESCE(SUM(COALESCE(scd.usage_quantity, 0)), 0) / 24.0
        )::double precision AS value
      FROM s3_cost_daily scd
      JOIN latest_day ld ON ld.usage_date = scd.usage_date
      WHERE ${where
        .map((clause) => clause.replace(/\busage_date\b/g, "scd.usage_date"))
        .join("\n        AND ")};
      `,
      { bind: binds, type: QueryTypes.SELECT, plain: true },
    );

    const gib = toNumber(row?.value);
    if (gib == null) return null;
    return Math.max(0, gib * 1073741824);
  }
}

