import { QueryTypes } from "sequelize";

import { sequelize } from "../../../../models/index.js";
import { logger } from "../../../../utils/logger.js";
import type { DashboardScope } from "../../dashboard.types.js";
import type { S3RecommendationConfidence, S3StorageAnomalyInsight } from "../cost-insights/s3-cost-insights.types.js";

type GrowthRow = {
  bucket_name: string | null;
  account_id: string | null;
  region_name: string | null;
  report_date: string | null;
  storage_bytes_current: number | string | null;
  storage_bytes_7d_ago: number | string | null;
  object_count_current: number | string | null;
  object_count_7d_ago: number | string | null;
  bytes_standard_current: number | string | null;
  bytes_standard_7d_ago: number | string | null;
  bytes_glacier_current: number | string | null;
  bytes_glacier_7d_ago: number | string | null;
  bytes_deep_archive_current: number | string | null;
  bytes_deep_archive_7d_ago: number | string | null;
  noncurrent_bytes_current: number | string | null;
  has_lifecycle_policy: boolean | null;
  lifecycle_rules_count: number | null;
};

const bytesToGib = (bytes: number): number => bytes / (1024 ** 3);
const toNumber = (value: number | string | null | undefined): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const STORAGE_PRICE = {
  STANDARD: 0.023,
  STANDARD_IA: 0.0125,
  GLACIER: 0.004,
  DEEP_ARCHIVE: 0.00099,
};

const getSeverity = (growthPercentage: number | null, monthlyImpact: number): "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" => {
  if (growthPercentage != null && growthPercentage > 50 && monthlyImpact > 500) return "CRITICAL";
  if (growthPercentage != null && growthPercentage > 25 && monthlyImpact > 100) return "HIGH";
  if ((growthPercentage != null && growthPercentage > 10) || monthlyImpact > 50) return "MEDIUM";
  return "LOW";
};

const buildActionForType = (anomalyType: string): string => {
  switch (anomalyType) {
    case "HIGH_STORAGE_GROWTH_NO_LIFECYCLE":
      return "Add lifecycle policy for cold/noncurrent data and track 14-day impact.";
    case "STANDARD_STORAGE_SPIKE":
      return "Enable transition from Standard to Standard-IA/Intelligent-Tiering for low-access prefixes.";
    case "ARCHIVE_GROWTH_SPIKE":
      return "Validate archival policy and retrieval pattern to avoid unexpected archive lifecycle drift.";
    case "HIGH_NONCURRENT_GROWTH":
      return "Add noncurrent version expiration rules and verify versioning retention requirements.";
    case "OBJECT_COUNT_SPIKE":
      return "Review producer behavior for small-object explosion and batch aggregation opportunities.";
    case "CLASS_MIX_SHIFT":
      return "Review recent workload changes and lifecycle transitions causing storage class mix shift.";
    default:
      return "Review bucket growth drivers and create a prioritized FinOps action item.";
  }
};

export class S3StorageAnomalyService {
  async getStorageGrowthAnomalies(scope: DashboardScope): Promise<{ items: S3StorageAnomalyInsight[]; total: number }> {
    if (scope.scopeType !== "global") {
      return { items: [], total: 0 };
    }

    const binds: unknown[] = [scope.tenantId, scope.from, scope.to];
    const where: string[] = [
      "sld.tenant_id = $1::uuid",
      "sld.usage_date >= $2::date",
      "sld.usage_date <= $3::date",
    ];

    if (typeof scope.providerId === "number") {
      binds.push(scope.providerId);
      where.push(`sld.provider_id = $${binds.length}`);
    }
    if (Array.isArray(scope.billingSourceIds) && scope.billingSourceIds.length > 0) {
      binds.push(scope.billingSourceIds);
      where.push(`sld.billing_source_id = ANY($${binds.length}::bigint[])`);
    }
    if (typeof scope.regionKey === "number") {
      binds.push(scope.regionKey);
      where.push(`sld.region_key = $${binds.length}`);
    }
    if (typeof scope.subAccountKey === "number") {
      binds.push(scope.subAccountKey);
      where.push(`sld.sub_account_key = $${binds.length}`);
    }

    const rows = await sequelize.query<GrowthRow>(
      `
      WITH latest_date AS (
        SELECT MAX(sld.usage_date) AS max_usage_date
        FROM s3_storage_lens_daily sld
        WHERE ${where.join("\n          AND ")}
      ),
      current_rows AS (
        SELECT
          sld.bucket_name,
          COALESCE(dsa.sub_account_id, 'unknown') AS account_id,
          COALESCE(dr.region_name, dr.region_id, 'global') AS region_name,
          sld.usage_date::text AS report_date,
          (
            COALESCE(sld.bytes_standard, 0) +
            COALESCE(sld.bytes_standard_ia, 0) +
            COALESCE(sld.bytes_onezone_ia, 0) +
            COALESCE(sld.bytes_intelligent_tiering, 0) +
            COALESCE(sld.bytes_glacier, 0) +
            COALESCE(sld.bytes_deep_archive, 0)
          )::double precision AS storage_bytes_current,
          COALESCE(sld.object_count, 0)::double precision AS object_count_current,
          COALESCE(sld.bytes_standard, 0)::double precision AS bytes_standard_current,
          COALESCE(sld.bytes_glacier, 0)::double precision AS bytes_glacier_current,
          COALESCE(sld.bytes_deep_archive, 0)::double precision AS bytes_deep_archive_current,
          COALESCE(sld.noncurrent_version_bytes, 0)::double precision AS noncurrent_bytes_current,
          CASE WHEN COALESCE(cfg.lifecycle_rules_count, 0) > 0 THEN true ELSE false END AS has_lifecycle_policy,
          COALESCE(cfg.lifecycle_rules_count, 0) AS lifecycle_rules_count
        FROM s3_storage_lens_daily sld
        CROSS JOIN latest_date ld
        LEFT JOIN dim_sub_account dsa ON dsa.id = sld.sub_account_key
        LEFT JOIN dim_region dr ON dr.id = sld.region_key
        LEFT JOIN LATERAL (
          SELECT lifecycle_rules_count
          FROM s3_bucket_config_snapshot bcs
          WHERE bcs.tenant_id = sld.tenant_id
            AND bcs.bucket_name = sld.bucket_name
          ORDER BY bcs.scan_time DESC
          LIMIT 1
        ) cfg ON TRUE
        WHERE sld.usage_date = ld.max_usage_date
          AND ${where.join("\n          AND ")}
      ),
      prev_rows AS (
        SELECT
          sld.bucket_name,
          (
            COALESCE(sld.bytes_standard, 0) +
            COALESCE(sld.bytes_standard_ia, 0) +
            COALESCE(sld.bytes_onezone_ia, 0) +
            COALESCE(sld.bytes_intelligent_tiering, 0) +
            COALESCE(sld.bytes_glacier, 0) +
            COALESCE(sld.bytes_deep_archive, 0)
          )::double precision AS storage_bytes_7d_ago,
          COALESCE(sld.object_count, 0)::double precision AS object_count_7d_ago,
          COALESCE(sld.bytes_standard, 0)::double precision AS bytes_standard_7d_ago,
          COALESCE(sld.bytes_glacier, 0)::double precision AS bytes_glacier_7d_ago,
          COALESCE(sld.bytes_deep_archive, 0)::double precision AS bytes_deep_archive_7d_ago
        FROM s3_storage_lens_daily sld
        CROSS JOIN latest_date ld
        WHERE sld.usage_date = ld.max_usage_date - INTERVAL '7 day'
          AND ${where.join("\n          AND ")}
      )
      SELECT
        c.bucket_name,
        c.account_id,
        c.region_name,
        c.report_date,
        c.storage_bytes_current,
        p.storage_bytes_7d_ago,
        c.object_count_current,
        p.object_count_7d_ago,
        c.bytes_standard_current,
        p.bytes_standard_7d_ago,
        c.bytes_glacier_current,
        p.bytes_glacier_7d_ago,
        c.bytes_deep_archive_current,
        p.bytes_deep_archive_7d_ago,
        c.noncurrent_bytes_current,
        c.has_lifecycle_policy,
        c.lifecycle_rules_count
      FROM current_rows c
      LEFT JOIN prev_rows p ON p.bucket_name = c.bucket_name
      ORDER BY c.storage_bytes_current DESC
      `,
      {
        bind: binds,
        type: QueryTypes.SELECT,
      },
    );

    const items: S3StorageAnomalyInsight[] = [];

    for (const row of rows) {
      const bucketName = String(row.bucket_name ?? "").trim();
      if (!bucketName) continue;

      const storageCurrentGib = bytesToGib(toNumber(row.storage_bytes_current));
      const storage7dAgoGib = row.storage_bytes_7d_ago == null ? null : bytesToGib(toNumber(row.storage_bytes_7d_ago));
      const growthGib = storageCurrentGib - (storage7dAgoGib ?? 0);
      const growthPct = storage7dAgoGib && storage7dAgoGib > 0 ? (growthGib / storage7dAgoGib) * 100 : null;

      const standardDeltaGib = bytesToGib(toNumber(row.bytes_standard_current) - toNumber(row.bytes_standard_7d_ago));
      const glacierDeltaGib = bytesToGib(toNumber(row.bytes_glacier_current) - toNumber(row.bytes_glacier_7d_ago));
      const deepArchiveDeltaGib = bytesToGib(toNumber(row.bytes_deep_archive_current) - toNumber(row.bytes_deep_archive_7d_ago));

      const monthlyImpact =
        Math.max(standardDeltaGib, 0) * STORAGE_PRICE.STANDARD +
        Math.max(glacierDeltaGib, 0) * STORAGE_PRICE.GLACIER +
        Math.max(deepArchiveDeltaGib, 0) * STORAGE_PRICE.DEEP_ARCHIVE;

      const objectCurrent = toNumber(row.object_count_current);
      const objectPrev = toNumber(row.object_count_7d_ago);
      const objectGrowthPct = objectPrev > 0 ? ((objectCurrent - objectPrev) / objectPrev) * 100 : null;

      const standardShareCurrent = storageCurrentGib > 0 ? bytesToGib(toNumber(row.bytes_standard_current)) / storageCurrentGib : 0;
      const standardSharePrev = (storage7dAgoGib ?? 0) > 0 ? bytesToGib(toNumber(row.bytes_standard_7d_ago)) / (storage7dAgoGib ?? 1) : 0;
      const classMixDeltaPct = (standardShareCurrent - standardSharePrev) * 100;

      let anomalyType: string | null = null;
      let reason = "";

      if ((growthPct ?? 0) > 25 && !row.has_lifecycle_policy) {
        anomalyType = "HIGH_STORAGE_GROWTH_NO_LIFECYCLE";
        reason = "Bucket grew rapidly in 7 days and lifecycle policy is missing.";
      } else if (standardDeltaGib > 100 && (growthPct ?? 0) > 15) {
        anomalyType = "STANDARD_STORAGE_SPIKE";
        reason = "Standard class increased sharply and is driving additional cost.";
      } else if ((glacierDeltaGib + deepArchiveDeltaGib) > 150) {
        anomalyType = "ARCHIVE_GROWTH_SPIKE";
        reason = "Archive tiers grew abruptly; verify archival pipeline and retention policy.";
      } else if (bytesToGib(toNumber(row.noncurrent_bytes_current)) > 100 && (growthPct ?? 0) > 10) {
        anomalyType = "HIGH_NONCURRENT_GROWTH";
        reason = "Noncurrent version bytes are high and growth trend is elevated.";
      } else if ((objectGrowthPct ?? 0) > 50) {
        anomalyType = "OBJECT_COUNT_SPIKE";
        reason = "Object count growth is disproportionate versus 7-day baseline.";
      } else if (Math.abs(classMixDeltaPct) >= 20 && (growthPct ?? 0) > 10) {
        anomalyType = "CLASS_MIX_SHIFT";
        reason = "Storage class distribution changed abruptly within 7 days.";
      }

      if (!anomalyType) continue;

      const severity = getSeverity(growthPct, monthlyImpact);
      const confidence: S3RecommendationConfidence =
        storage7dAgoGib != null && objectPrev > 0 && row.lifecycle_rules_count != null ? "HIGH" : "MEDIUM";

      items.push({
        bucketName,
        accountId: String(row.account_id ?? "unknown"),
        region: row.region_name ? String(row.region_name) : null,
        reportDate: String(row.report_date ?? ""),
        storageGibCurrent: storageCurrentGib,
        storageGib7dAgo: storage7dAgoGib,
        growthGib,
        growthPercentage: growthPct,
        estimatedMonthlyCostImpact: monthlyImpact,
        anomalyType,
        severity,
        confidence,
        reason,
        recommendedAction: buildActionForType(anomalyType),
      });
    }

    items.sort((a, b) => {
      const severityRank: Record<S3StorageAnomalyInsight["severity"], number> = {
        CRITICAL: 4,
        HIGH: 3,
        MEDIUM: 2,
        LOW: 1,
      };
      const rankDelta = severityRank[b.severity] - severityRank[a.severity];
      if (rankDelta !== 0) return rankDelta;
      return b.estimatedMonthlyCostImpact - a.estimatedMonthlyCostImpact;
    });

    logger.info("[S3StorageAnomalyService] computed anomalies", {
      tenantId: scope.tenantId,
      anomalies: items.length,
    });

    return {
      items: items.slice(0, 200),
      total: items.length,
    };
  }
}

