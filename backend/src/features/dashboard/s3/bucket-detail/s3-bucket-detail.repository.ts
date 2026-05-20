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
  encryption_type: string | null;
  versioning_status: string | null;
  public_access_block_status: string | null;
  block_public_acls: boolean | null;
  ignore_public_acls: boolean | null;
  block_public_policy: boolean | null;
  restrict_public_buckets: boolean | null;
  policy_public_status: string | null;
  ownership_status: string | null;
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
type CostBreakdownRow = {
  total_cost: number | string | null;
  storage_cost: number | string | null;
  request_cost: number | string | null;
  transfer_cost: number | string | null;
  retrieval_cost: number | string | null;
  other_cost: number | string | null;
};
type CostTrendRow = {
  usage_date: string | null;
  storage_cost: number | string | null;
  request_cost: number | string | null;
  transfer_cost: number | string | null;
  other_cost: number | string | null;
};
type StorageClassBreakdownRow = {
  storage_class: string | null;
  usage_quantity: number | string | null;
};
type ActivityUsageRow = {
  usage_date: string | null;
  get_requests_count: number | string | null;
  put_requests_count: number | string | null;
  current_version_bytes: number | string | null;
  object_count: number | string | null;
};
type RequestBreakdownRow = {
  operation_group: string | null;
  request_count: number | string | null;
};
type TransferBreakdownRow = {
  transfer_type: string | null;
  transfer_gb: number | string | null;
};

const normalizeStorageClassLabel = (raw: string): string => {
  const value = raw.trim();
  const upper = value.toUpperCase();
  if (!value) return "Other";
  if (upper.includes("DEEP") && upper.includes("ARCHIVE")) return "Deep Archive";
  if (upper.includes("GLACIER")) return "Glacier";
  if (upper.includes("ONE") && upper.includes("ZONE") && upper.includes("IA")) return "One Zone-IA";
  if (upper.includes("STANDARD") && upper.includes("IA")) return "Standard-IA";
  if (upper === "STANDARD" || (upper.includes("STANDARD") && !upper.includes("IA"))) return "Standard";
  return "Other";
};

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
const buildPreviousWindow = (from: string, to: string): { from: string; to: string } => {
  const fromDate = new Date(`${from}T00:00:00.000Z`);
  const toDate = new Date(`${to}T00:00:00.000Z`);
  const diffDays = Math.floor((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1;
  const prevTo = new Date(fromDate);
  prevTo.setUTCDate(prevTo.getUTCDate() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setUTCDate(prevFrom.getUTCDate() - (diffDays - 1));
  return { from: toIsoDate(prevFrom), to: toIsoDate(prevTo) };
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
        encryption_type,
        versioning_status,
        public_access_block_status,
        block_public_acls,
        ignore_public_acls,
        block_public_policy,
        restrict_public_buckets,
        policy_public_status,
        ownership_status,
        lifecycle_status,
        lifecycle_rules_count,
        NULL::double precision AS enabled_lifecycle_rules_count,
        NULL::double precision AS transition_rules_count,
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

  async getCostBreakdown(scope: DashboardScope, bucketName: string): Promise<{
    totalCost: number;
    storageCost: number;
    requestCost: number;
    transferCost: number;
    retrievalCost: number;
    otherCost: number;
    costTrendPct: number;
  }> {
    const from = scope.from;
    const to = scope.to;
    const previous = buildPreviousWindow(from, to);

    const makeWhere = (start: string, end: string, binds: unknown[]): string[] => {
      const where: string[] = [
        "tenant_id = $1::uuid",
        "bucket_name = $2::text",
        `usage_date >= $${binds.length + 1}::date`,
        `usage_date <= $${binds.length + 2}::date`,
        "COALESCE(total_cost, 0) >= 0",
      ];
      binds.push(start, end);
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
      return where;
    };

    const currentBinds: unknown[] = [scope.tenantId, bucketName];
    const currentWhere = makeWhere(from, to, currentBinds);
    const previousBinds: unknown[] = [scope.tenantId, bucketName];
    const previousWhere = makeWhere(previous.from, previous.to, previousBinds);

    const [currentRow, previousRow] = await Promise.all([
      sequelize.query<CostBreakdownRow>(
        `
        SELECT
          COALESCE(SUM(COALESCE(total_cost, 0)), 0)::double precision AS total_cost,
          COALESCE(SUM(CASE WHEN cost_category = 'Storage' THEN COALESCE(total_cost, 0) ELSE 0 END), 0)::double precision AS storage_cost,
          COALESCE(SUM(CASE WHEN cost_category = 'Request' THEN COALESCE(total_cost, 0) ELSE 0 END), 0)::double precision AS request_cost,
          COALESCE(SUM(CASE WHEN cost_category = 'Transfer' THEN COALESCE(total_cost, 0) ELSE 0 END), 0)::double precision AS transfer_cost,
          COALESCE(SUM(CASE WHEN cost_category = 'Retrieval' THEN COALESCE(total_cost, 0) ELSE 0 END), 0)::double precision AS retrieval_cost,
          COALESCE(
            SUM(
              CASE
                WHEN cost_category NOT IN ('Storage','Request','Transfer','Retrieval') OR cost_category IS NULL
                THEN COALESCE(total_cost, 0)
                ELSE 0
              END
            ),
            0
          )::double precision AS other_cost
        FROM s3_cost_daily
        WHERE ${currentWhere.join("\n          AND ")};
        `,
        { bind: currentBinds, type: QueryTypes.SELECT, plain: true },
      ),
      sequelize.query<{ total_cost: number | string | null }>(
        `
        SELECT COALESCE(SUM(COALESCE(total_cost, 0)), 0)::double precision AS total_cost
        FROM s3_cost_daily
        WHERE ${previousWhere.join("\n          AND ")};
        `,
        { bind: previousBinds, type: QueryTypes.SELECT, plain: true },
      ),
    ]);

    const totalCost = Number(toNumber(currentRow?.total_cost) ?? 0);
    const previousTotalCost = Number(toNumber(previousRow?.total_cost) ?? 0);
    const costTrendPct = previousTotalCost > 0 ? ((totalCost - previousTotalCost) / previousTotalCost) * 100 : 0;

    return {
      totalCost,
      storageCost: Number(toNumber(currentRow?.storage_cost) ?? 0),
      requestCost: Number(toNumber(currentRow?.request_cost) ?? 0),
      transferCost: Number(toNumber(currentRow?.transfer_cost) ?? 0),
      retrievalCost: Number(toNumber(currentRow?.retrieval_cost) ?? 0),
      otherCost: Number(toNumber(currentRow?.other_cost) ?? 0),
      costTrendPct: Number(costTrendPct.toFixed(2)),
    };
  }

  async getCostTrend(scope: DashboardScope, bucketName: string): Promise<Array<{
    date: string;
    storageCost: number;
    requestCost: number;
    transferCost: number;
    otherCost: number;
  }>> {
    const binds: unknown[] = [scope.tenantId, bucketName];
    const where: string[] = [
      "tenant_id = $1::uuid",
      "bucket_name = $2::text",
      "usage_date >= $3::date",
      "usage_date <= $4::date",
      "COALESCE(total_cost, 0) >= 0",
    ];
    binds.push(scope.from, scope.to);
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

    const rows = await sequelize.query<CostTrendRow>(
      `
      SELECT
        usage_date::text AS usage_date,
        COALESCE(SUM(CASE WHEN cost_category = 'Storage' THEN COALESCE(total_cost, 0) ELSE 0 END), 0)::double precision AS storage_cost,
        COALESCE(SUM(CASE WHEN cost_category = 'Request' THEN COALESCE(total_cost, 0) ELSE 0 END), 0)::double precision AS request_cost,
        COALESCE(SUM(CASE WHEN cost_category = 'Transfer' THEN COALESCE(total_cost, 0) ELSE 0 END), 0)::double precision AS transfer_cost,
        COALESCE(
          SUM(
            CASE
              WHEN cost_category NOT IN ('Storage','Request','Transfer','Retrieval') OR cost_category IS NULL
              THEN COALESCE(total_cost, 0)
              ELSE 0
            END
          ),
          0
        )::double precision AS other_cost
      FROM s3_cost_daily
      WHERE ${where.join("\n        AND ")}
      GROUP BY usage_date
      ORDER BY usage_date ASC;
      `,
      { bind: binds, type: QueryTypes.SELECT },
    );

    return rows
      .filter((row) => row.usage_date)
      .map((row) => ({
        date: String(row.usage_date),
        storageCost: Number(toNumber(row.storage_cost) ?? 0),
        requestCost: Number(toNumber(row.request_cost) ?? 0),
        transferCost: Number(toNumber(row.transfer_cost) ?? 0),
        otherCost: Number(toNumber(row.other_cost) ?? 0),
      }));
  }

  async getStorageClassBreakdown(scope: DashboardScope, bucketName: string): Promise<Array<{
    storageClass: string;
    bytes: number;
    objectCount: number | null;
  }>> {
    const binds: unknown[] = [scope.tenantId, bucketName, scope.from, scope.to];
    const where: string[] = [
      "tenant_id = $1::uuid",
      "LOWER(bucket_name) = LOWER($2::text)",
      "usage_date >= $3::date",
      "usage_date <= $4::date",
      "LOWER(TRIM(COALESCE(NULLIF(cost_category, ''), ''))) = 'storage'",
      "LOWER(TRIM(COALESCE(NULLIF(pricing_unit, ''), ''))) IN ('gb-mo', 'gb-month', 'gbytehrs')",
      "storage_class IS NOT NULL",
      "NULLIF(BTRIM(storage_class), '') IS NOT NULL",
      "LOWER(COALESCE(usage_type, '')) <> 'use1-storagelens-objcount'",
      "LOWER(COALESCE(operation, '')) <> 'storagelens'",
    ];

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

    const rows = await sequelize.query<StorageClassBreakdownRow>(
      `
      SELECT
        storage_class,
        COALESCE(SUM(COALESCE(usage_quantity, 0)), 0)::double precision AS usage_quantity
      FROM s3_cost_daily
      WHERE ${where.join("\n        AND ")}
      GROUP BY storage_class
      ORDER BY usage_quantity DESC;
      `,
      { bind: binds, type: QueryTypes.SELECT },
    );

    const mapped = rows
      .map((row): { storageClass: string; bytes: number; objectCount: number | null } | null => {
        const raw = String(row.storage_class ?? "").trim();
        if (!raw) return null;
        const normalizedLabel = normalizeStorageClassLabel(raw);
        const bytesFromGbMonth = Number(toNumber(row.usage_quantity) ?? 0) * 1024 ** 3;
        const bytes = Number.isFinite(bytesFromGbMonth) && bytesFromGbMonth > 0 ? bytesFromGbMonth : 0;
        if (bytes <= 0) return null;
        return {
          storageClass: normalizedLabel,
          bytes,
          objectCount: null,
        };
      });

    return mapped.filter((item): item is { storageClass: string; bytes: number; objectCount: number | null } => item != null);
  }

  async getActivityUsageSeries(scope: DashboardScope, bucketName: string): Promise<Array<{
    date: string;
    getRequestsCount: number;
    putRequestsCount: number;
    currentVersionBytes: number | null;
    objectCount: number | null;
  }>> {
    const binds: unknown[] = [scope.tenantId, bucketName, scope.from, scope.to];
    const where: string[] = [
      "sld.tenant_id = $1::uuid",
      "LOWER(sld.bucket_name) = LOWER($2::text)",
      "sld.usage_date >= $3::date",
      "sld.usage_date <= $4::date",
    ];

    if (scope.scopeType === "global") {
      if (typeof scope.providerId === "number") {
        binds.push(scope.providerId);
        where.push(`sld.provider_id = $${binds.length}`);
      }
      if (Array.isArray(scope.billingSourceIds) && scope.billingSourceIds.length > 0) {
        binds.push(scope.billingSourceIds);
        where.push(`sld.billing_source_id = ANY($${binds.length}::bigint[])`);
      }
      if (typeof scope.subAccountKey === "number") {
        binds.push(scope.subAccountKey);
        where.push(`sld.sub_account_key = $${binds.length}`);
      }
      if (typeof scope.regionKey === "number") {
        binds.push(scope.regionKey);
        where.push(`sld.region_key = $${binds.length}`);
      }
    }

    const rows = await sequelize.query<ActivityUsageRow>(
      `
      SELECT
        sld.usage_date::text AS usage_date,
        COALESCE(sld.get_requests_count, 0)::double precision AS get_requests_count,
        COALESCE(sld.put_requests_count, 0)::double precision AS put_requests_count,
        sld.current_version_bytes,
        sld.object_count
      FROM s3_storage_lens_daily sld
      WHERE ${where.join("\n        AND ")}
      ORDER BY sld.usage_date ASC;
      `,
      { bind: binds, type: QueryTypes.SELECT },
    );

    return rows
      .filter((row) => row.usage_date)
      .map((row) => ({
        date: String(row.usage_date),
        getRequestsCount: Number(toNumber(row.get_requests_count) ?? 0),
        putRequestsCount: Number(toNumber(row.put_requests_count) ?? 0),
        currentVersionBytes: toNumber(row.current_version_bytes),
        objectCount: toNumber(row.object_count),
      }));
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

  async getRequestOperationBreakdown(scope: DashboardScope, bucketName: string): Promise<Array<{
    operation: "GET" | "PUT" | "LIST" | "DELETE" | "HEAD" | "COPY" | "Other";
    count: number;
  }>> {
    const binds: unknown[] = [scope.tenantId, bucketName];
    const where = this.buildScopedConditions(scope, "usage_date", binds);
    where.push("LOWER(bucket_name) = LOWER($2::text)");
    where.push("cost_category = 'Request'");
    where.push("LOWER(COALESCE(pricing_unit, '')) = 'requests'");
    where.push("NULLIF(TRIM(COALESCE(operation, '')), '') IS NOT NULL");
    where.push("TRIM(COALESCE(operation, '')) NOT IN ('Unspecified', 'None')");

    const rows = await sequelize.query<RequestBreakdownRow>(
      `
      SELECT
        CASE
          WHEN LOWER(operation) LIKE '%get%' OR LOWER(operation) LIKE '%read%' OR LOWER(operation) LIKE '%select%' THEN 'GET'
          WHEN LOWER(operation) LIKE '%put%' OR LOWER(operation) LIKE '%post%' OR LOWER(operation) LIKE '%upload%' OR LOWER(operation) LIKE '%write%' THEN 'PUT'
          WHEN LOWER(operation) LIKE '%list%' THEN 'LIST'
          WHEN LOWER(operation) LIKE '%delete%' OR LOWER(operation) LIKE '%remove%' OR LOWER(operation) LIKE '%abortmultipartupload%' THEN 'DELETE'
          WHEN LOWER(operation) LIKE '%head%' THEN 'HEAD'
          WHEN LOWER(operation) LIKE '%copy%' OR LOWER(operation) LIKE '%replicate%' THEN 'COPY'
          ELSE 'Other'
        END AS operation_group,
        COALESCE(SUM(COALESCE(usage_quantity, 0)), 0)::double precision AS request_count
      FROM s3_cost_daily
      WHERE ${where.join("\n        AND ")}
      GROUP BY 1
      ORDER BY request_count DESC;
      `,
      { bind: binds, type: QueryTypes.SELECT },
    );

    return rows
      .map((row) => ({
        operation: String(row.operation_group ?? "Other") as "GET" | "PUT" | "LIST" | "DELETE" | "HEAD" | "COPY" | "Other",
        count: Number(toNumber(row.request_count) ?? 0),
      }))
      .filter((row) => row.count > 0);
  }

  async getTransferBreakdown(scope: DashboardScope, bucketName: string): Promise<Array<{
    type: "Upload" | "Download" | "Internal" | "Other";
    bytes: number;
  }>> {
    const binds: unknown[] = [scope.tenantId, bucketName];
    const where = this.buildScopedConditions(scope, "usage_date", binds);
    where.push("LOWER(bucket_name) = LOWER($2::text)");
    where.push("cost_category = 'Transfer'");
    where.push("LOWER(COALESCE(pricing_unit, '')) = 'gb'");
    where.push("NOT (COALESCE(total_cost, 0) = 0 AND COALESCE(usage_quantity, 0) >= 1)");
    where.push("NULLIF(TRIM(COALESCE(operation, '')), '') IS NOT NULL");
    where.push("TRIM(COALESCE(operation, '')) NOT IN ('Unspecified', 'None')");

    const rows = await sequelize.query<TransferBreakdownRow>(
      `
      SELECT
        CASE
          WHEN LOWER(COALESCE(usage_type, '') || ' ' || COALESCE(operation, '') || ' ' || COALESCE(product_family, '')) LIKE '%inter-region%'
            OR LOWER(COALESCE(usage_type, '') || ' ' || COALESCE(operation, '') || ' ' || COALESCE(product_family, '')) LIKE '%interregion%'
            OR LOWER(COALESCE(usage_type, '') || ' ' || COALESCE(operation, '') || ' ' || COALESCE(product_family, '')) LIKE '%inter-az%'
            OR LOWER(COALESCE(usage_type, '') || ' ' || COALESCE(operation, '') || ' ' || COALESCE(product_family, '')) LIKE '%intra-region%'
            OR LOWER(COALESCE(usage_type, '') || ' ' || COALESCE(operation, '') || ' ' || COALESCE(product_family, '')) LIKE '%replication%'
            THEN 'Internal'
          WHEN LOWER(COALESCE(usage_type, '') || ' ' || COALESCE(operation, '') || ' ' || COALESCE(product_family, '')) LIKE '%out-bytes%'
            OR LOWER(COALESCE(usage_type, '') || ' ' || COALESCE(operation, '') || ' ' || COALESCE(product_family, '')) LIKE '%egress%'
            OR LOWER(COALESCE(usage_type, '') || ' ' || COALESCE(operation, '') || ' ' || COALESCE(product_family, '')) LIKE '%download%'
            OR LOWER(COALESCE(usage_type, '') || ' ' || COALESCE(operation, '') || ' ' || COALESCE(product_family, '')) LIKE '%getobject%'
            THEN 'Download'
          WHEN LOWER(COALESCE(usage_type, '') || ' ' || COALESCE(operation, '') || ' ' || COALESCE(product_family, '')) LIKE '%in-bytes%'
            OR LOWER(COALESCE(usage_type, '') || ' ' || COALESCE(operation, '') || ' ' || COALESCE(product_family, '')) LIKE '%ingress%'
            OR LOWER(COALESCE(usage_type, '') || ' ' || COALESCE(operation, '') || ' ' || COALESCE(product_family, '')) LIKE '%upload%'
            OR LOWER(COALESCE(usage_type, '') || ' ' || COALESCE(operation, '') || ' ' || COALESCE(product_family, '')) LIKE '%putobject%'
            OR LOWER(COALESCE(usage_type, '') || ' ' || COALESCE(operation, '') || ' ' || COALESCE(product_family, '')) LIKE '%copyobject%'
            THEN 'Upload'
          ELSE 'Other'
        END AS transfer_type,
        COALESCE(SUM(COALESCE(usage_quantity, 0)), 0)::double precision AS transfer_gb
      FROM s3_cost_daily
      WHERE ${where.join("\n        AND ")}
      GROUP BY 1
      ORDER BY transfer_gb DESC;
      `,
      { bind: binds, type: QueryTypes.SELECT },
    );

    return rows
      .map((row) => ({
        type: String(row.transfer_type ?? "Other") as "Upload" | "Download" | "Internal" | "Other",
        bytes: Number(toNumber(row.transfer_gb) ?? 0) * 1024 ** 3,
      }))
      .filter((row) => row.bytes > 0);
  }
}

