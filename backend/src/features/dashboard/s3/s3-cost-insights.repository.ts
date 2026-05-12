import { QueryTypes } from "sequelize";

import { sequelize } from "../../../models/index.js";
import type { DashboardScope } from "../dashboard.types.js";
import { buildDashboardFilter } from "../shared/filter-builder.js";
import type {
  S3CostBucketInsight,
  S3CostBucketTableInsight,
  S3CostCategoryTableInsight,
  S3CostCategory,
  S3CostChartBy,
  S3CostInsightsFilters,
  S3CostSeriesBy,
  S3UsageOperationTableInsight,
  S3CostYAxisMetric,
  S3CostFeatureTrendInsight,
  S3CostTrendInsight,
} from "./s3-cost-insights.types.js";

type S3KpiRow = {
  total_s3_cost: number | string | null;
};

type S3EffectiveKpiRow = {
  total_effective_s3_cost: number | string | null;
};

type S3BucketRow = {
  bucket_name: string | null;
  billed_cost: number | string | null;
  effective_cost: number | string | null;
};

type S3TrendRow = {
  usage_start_time: string | null;
  billed_cost: number | string | null;
  effective_cost: number | string | null;
};

type S3BucketBreakdownRow = {
  bucket_name: string | null;
  account: string | null;
  cost: number | string | null;
  storage: number | string | null;
  requests: number | string | null;
  transfer: number | string | null;
  region: string | null;
  owner: string | null;
  driver: string | null;
  savings: number | string | null;
  retrieval: number | string | null;
  other: number | string | null;
  replication_status: string | null;
  versioning_status: string | null;
  encryption_status: string | null;
  public_access_status: string | null;
};

type S3FeatureTrendRow = {
  usage_start_time: string | null;
  storage: number | string | null;
  requests: number | string | null;
  retrieval: number | string | null;
  transfer: number | string | null;
  bucket: number | string | null;
  bucket_storage_class: number | string | null;
  other: number | string | null;
  total: number | string | null;
};

type S3CostCategoryTableRow = {
  cost_category: string | null;
  cost: number | string | null;
  usage_quantity: number | string | null;
  pricing_unit: string | null;
  percent_of_bucket_cost: number | string | null;
};

type S3UsageOperationTableRow = {
  usage_type: string | null;
  operation: string | null;
  cost: number | string | null;
  quantity: number | string | null;
  unit: string | null;
};

type S3BreakdownRow = {
  x_value: string | null;
  series_value: string | null;
  metric_cost: number | string | null;
};

type S3StorageLensRow = {
  bucket_name: string | null;
  usage_date: string | null;
  object_count: number | string | null;
  current_version_bytes: number | string | null;
  avg_object_size_bytes: number | string | null;
  access_count: number | string | null;
  bytes_standard: number | string | null;
  bytes_standard_ia: number | string | null;
  bytes_onezone_ia: number | string | null;
  bytes_intelligent_tiering: number | string | null;
  bytes_glacier: number | string | null;
  bytes_deep_archive: number | string | null;
};

type S3OptionRow = {
  value: string | null;
};

type S3StorageDailyTrendRow = {
  usage_date: string | null;
  bytes_standard: number | string | null;
  bytes_standard_ia: number | string | null;
  bytes_glacier: number | string | null;
  bytes_deep_archive: number | string | null;
};

type S3StorageLatestBucketRow = {
  bucket_name: string | null;
  usage_date: string | null;
  bytes_standard: number | string | null;
  bytes_standard_ia: number | string | null;
  bytes_glacier: number | string | null;
  bytes_deep_archive: number | string | null;
};

const S3_FILTER_SQL = `
(
  LOWER(COALESCE(ds.service_name, '')) LIKE '%s3%'
  OR LOWER(COALESCE(ds.service_name, '')) LIKE '%simple storage service%'
  OR LOWER(COALESCE(fcli.usage_type, '')) LIKE '%s3%'
  OR LOWER(COALESCE(dres.resource_id, '')) LIKE 'arn:aws:s3:::%'
  OR LOWER(COALESCE(dres.resource_id, '')) LIKE 's3://%'
)
`;

const S3_SERVICE_NAME_FILTER_SQL = `
(
  LOWER(COALESCE(ds.service_name, '')) LIKE '%s3%'
  OR LOWER(COALESCE(ds.service_name, '')) LIKE '%simple storage service%'
)
`;

const S3_BUCKET_NAME_SQL = `
CASE
  WHEN COALESCE(dres.resource_id, '') = '' THEN 'unattributed'
  WHEN LOWER(dres.resource_id) LIKE 'arn:aws:s3:::%' THEN NULLIF(SPLIT_PART(dres.resource_id, ':::', 2), '')
  WHEN LOWER(dres.resource_id) LIKE 's3://%' THEN NULLIF(SPLIT_PART(SUBSTRING(dres.resource_id FROM 6), '/', 1), '')
  ELSE dres.resource_id
END
`;

const S3_TRANSFER_COST_CONDITION_SQL = `
(
  LOWER(TRIM(COALESCE(NULLIF(product_family, ''), ''))) = 'data transfer'
  OR LOWER(COALESCE(usage_type, '')) LIKE '%datatransfer%'
  OR LOWER(COALESCE(usage_type, '')) LIKE '%out-bytes%'
  OR LOWER(COALESCE(usage_type, '')) LIKE '%in-bytes%'
  OR LOWER(COALESCE(usage_type, '')) LIKE '%data%transfer%'
  OR LOWER(COALESCE(line_item_description, '')) LIKE '%data transfer%'
  OR LOWER(COALESCE(operation, '')) LIKE '%datatransfer%'
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
  OR LOWER(COALESCE(usage_type, '')) LIKE '%gbytehrs%'
)
`;

const S3_RETRIEVAL_COST_CONDITION_SQL = `
(
  LOWER(COALESCE(usage_type, '')) LIKE '%retrieval%'
  OR LOWER(COALESCE(usage_type, '')) LIKE '%dataretrieval%'
  OR LOWER(COALESCE(usage_type, '')) LIKE '%restore%'
  OR LOWER(COALESCE(usage_type, '')) LIKE '%glacier%retrieval%'
  OR LOWER(COALESCE(usage_type, '')) LIKE '%select%-scanned%'
  OR LOWER(COALESCE(line_item_description, '')) LIKE '%retrieval%'
  OR LOWER(COALESCE(line_item_description, '')) LIKE '%restore%'
  OR LOWER(COALESCE(line_item_description, '')) LIKE '%restore object%'
  OR LOWER(COALESCE(line_item_description, '')) LIKE '%data retrieval%'
  OR LOWER(COALESCE(operation, '')) LIKE '%restore%'
  OR LOWER(COALESCE(operation, '')) LIKE '%retrieval%'
  OR LOWER(COALESCE(operation, '')) LIKE '%restoreobject%'
  OR LOWER(COALESCE(operation, '')) LIKE '%selectobjectcontent%'
)
`;

const S3_STORAGE_USAGE_ONLY_CONDITION_SQL = `
(
  LOWER(TRIM(COALESCE(NULLIF(product_family, ''), ''))) = 'storage'
  AND (
    LOWER(COALESCE(usage_type, '')) LIKE '%timedstorage%'
    OR LOWER(COALESCE(product_usage_type, '')) LIKE '%timedstorage%'
  )
)
`;

const S3_BUCKET_COST_CONDITION_SQL = `
(
  LOWER(COALESCE(operation, '')) LIKE '%bucket%'
  OR LOWER(COALESCE(usage_type, '')) LIKE '%bucket%'
  OR LOWER(COALESCE(line_item_description, '')) LIKE '%bucket%'
)
`;

const S3_BUCKET_STORAGE_CLASS_CONDITION_SQL = `
(
  ${S3_STORAGE_COST_CONDITION_SQL}
  AND COALESCE(bucket_name, 'unattributed') <> 'unattributed'
  AND (
    LOWER(COALESCE(product_usage_type, usage_type, '')) LIKE '%timedstorage%'
    OR LOWER(COALESCE(product_usage_type, usage_type, '')) LIKE '%standardstorage%'
    OR LOWER(COALESCE(product_usage_type, usage_type, '')) LIKE '%standardia%'
    OR LOWER(COALESCE(product_usage_type, usage_type, '')) LIKE '%onezoneia%'
    OR LOWER(COALESCE(product_usage_type, usage_type, '')) LIKE '%intelligenttiering%'
    OR LOWER(COALESCE(product_usage_type, usage_type, '')) LIKE '%glacier%'
    OR LOWER(COALESCE(product_usage_type, usage_type, '')) LIKE '%deeparchive%'
  )
)
`;

const S3_STORAGE_CLASS_LABEL_SQL = `
CASE
  WHEN LOWER(COALESCE(product_usage_type, usage_type, '')) LIKE '%intelligenttieringfastorage-bytehrs%'
    OR LOWER(COALESCE(product_usage_type, usage_type, '')) LIKE '%intelligenttieringfa%'
    THEN 'Intelligent Tiering (Frequent)'
  WHEN LOWER(COALESCE(product_usage_type, usage_type, '')) LIKE '%intelligenttieringiastorage-bytehrs%'
    OR LOWER(COALESCE(product_usage_type, usage_type, '')) LIKE '%intelligenttieringia%'
    THEN 'Intelligent Tiering (Infrequent)'
  WHEN LOWER(COALESCE(product_usage_type, usage_type, '')) LIKE '%onezoneiastorage-bytehrs%'
    OR LOWER(COALESCE(product_usage_type, usage_type, '')) LIKE '%onezone-ia%'
    OR LOWER(COALESCE(product_usage_type, usage_type, '')) LIKE '%one zone-ia%'
    THEN 'One Zone-IA'
  WHEN LOWER(COALESCE(product_usage_type, usage_type, '')) LIKE '%standardiastorage-bytehrs%'
    OR LOWER(COALESCE(product_usage_type, usage_type, '')) LIKE '%standard-ia%'
    OR LOWER(COALESCE(product_usage_type, usage_type, '')) LIKE '%standard ia%'
    THEN 'Standard-IA'
  WHEN LOWER(COALESCE(product_usage_type, usage_type, '')) LIKE '%deeparchivestorage-bytehrs%'
    OR LOWER(COALESCE(product_usage_type, usage_type, '')) LIKE '%deeparchive%'
    OR LOWER(COALESCE(product_usage_type, usage_type, '')) LIKE '%deep archive%'
    THEN 'Deep Archive'
  WHEN LOWER(COALESCE(product_usage_type, usage_type, '')) LIKE '%glacierstorage-bytehrs%'
    OR LOWER(COALESCE(product_usage_type, usage_type, '')) LIKE '%glacier%'
    OR LOWER(COALESCE(operation, '')) LIKE '%glacier%'
    THEN 'Glacier'
  WHEN LOWER(COALESCE(product_usage_type, usage_type, '')) LIKE '%timedstorage-bytehrs%'
    OR LOWER(COALESCE(product_usage_type, usage_type, '')) LIKE '%timedstorage%'
    OR LOWER(COALESCE(product_usage_type, usage_type, '')) LIKE '%standardstorage%'
    THEN 'S3 Standard'
  ELSE 'Unknown'
END
`;

const S3_COST_CATEGORY_SQL = `
CASE
  WHEN ${S3_TRANSFER_COST_CONDITION_SQL} THEN 'Transfer'
  WHEN ${S3_RETRIEVAL_COST_CONDITION_SQL} THEN 'Retrieval'
  WHEN ${S3_REQUEST_COST_CONDITION_SQL} THEN 'Request'
  WHEN ${S3_STORAGE_COST_CONDITION_SQL} THEN 'Storage'
  ELSE 'Other'
END
`;

const S3_COST_CATEGORY_OPTIONS: S3CostCategory[] = [
  "Storage",
  "Request",
  "Transfer",
  "Retrieval",
  "Other",
];

const S3_COST_BY_OPTIONS: S3CostChartBy[] = ["date", "bucket", "region", "account"];
const S3_SERIES_BY_OPTIONS: S3CostSeriesBy[] = ["none", "bucket", "usage_type", "cost_category", "operation", "product_family", "storage_class"];
const S3_Y_AXIS_METRIC_OPTIONS: S3CostYAxisMetric[] = ["billed_cost", "effective_cost", "amortized_cost", "usage_quantity"];

const OWNER_TAG_KEYS_SQL = `
(
  'owner',
  'resource_owner',
  'business_owner',
  'owner_name',
  'team'
)
`;

const DRIVER_TAG_KEYS_SQL = `
(
  'cost_driver',
  'driver',
  'application',
  'app',
  'workload',
  'project'
)
`;

const toNumber = (value: number | string | null | undefined): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const STORAGE_COST_PER_GIB_MONTH = {
  STANDARD: 0.023,
  STANDARD_IA: 0.0125,
  GLACIER: 0.004,
  DEEP_ARCHIVE: 0.00099,
} as const;

const bytesToGib = (bytes: number): number => bytes / (1024 ** 3);

export class S3CostInsightsRepository {
  async getStorageCostDashboard(scope: DashboardScope): Promise<{
    latestUsageDate: string | null;
    totalStorageByClass: Array<{
      storageClass: "STANDARD" | "STANDARD_IA" | "GLACIER" | "DEEP_ARCHIVE";
      bytes: number;
      gib: number;
      estimatedMonthlyCost: number;
    }>;
    dailyStorageGrowth: {
      fromDate: string | null;
      toDate: string | null;
      bytesGrowth: number;
      gibGrowth: number;
      growthPct: number | null;
    };
    estimatedMonthlyCost: {
      total: number;
      byClass: Record<"STANDARD" | "STANDARD_IA" | "GLACIER" | "DEEP_ARCHIVE", number>;
    };
    costTrend: Array<{
      usageDate: string;
      estimatedMonthlyCost: number;
      totalBytes: number;
    }>;
    expensiveBuckets: Array<{
      bucketName: string;
      estimatedMonthlyCost: number;
      totalBytes: number;
      usageDate: string;
    }>;
  }> {
    if (scope.scopeType !== "global") {
      return {
        latestUsageDate: null,
        totalStorageByClass: [
          { storageClass: "STANDARD", bytes: 0, gib: 0, estimatedMonthlyCost: 0 },
          { storageClass: "STANDARD_IA", bytes: 0, gib: 0, estimatedMonthlyCost: 0 },
          { storageClass: "GLACIER", bytes: 0, gib: 0, estimatedMonthlyCost: 0 },
          { storageClass: "DEEP_ARCHIVE", bytes: 0, gib: 0, estimatedMonthlyCost: 0 },
        ],
        dailyStorageGrowth: { fromDate: null, toDate: null, bytesGrowth: 0, gibGrowth: 0, growthPct: null },
        estimatedMonthlyCost: { total: 0, byClass: { STANDARD: 0, STANDARD_IA: 0, GLACIER: 0, DEEP_ARCHIVE: 0 } },
        costTrend: [],
        expensiveBuckets: [],
      };
    }

    const binds: unknown[] = [scope.tenantId, scope.from, scope.to];
    const conditions: string[] = [
      "tenant_id = $1::uuid",
      "usage_date >= $2::date",
      "usage_date <= $3::date",
    ];

    if (typeof scope.providerId === "number") {
      binds.push(scope.providerId);
      conditions.push(`provider_id = $${binds.length}`);
    }
    if (Array.isArray(scope.billingSourceIds) && scope.billingSourceIds.length > 0) {
      binds.push(scope.billingSourceIds);
      conditions.push(`billing_source_id = ANY($${binds.length}::bigint[])`);
    }
    if (typeof scope.regionKey === "number") {
      binds.push(scope.regionKey);
      conditions.push(`region_key = $${binds.length}`);
    }
    if (typeof scope.subAccountKey === "number") {
      binds.push(scope.subAccountKey);
      conditions.push(`sub_account_key = $${binds.length}`);
    }

    const trendRows = await sequelize.query<S3StorageDailyTrendRow>(
      `
      SELECT
        usage_date::text AS usage_date,
        COALESCE(SUM(COALESCE(bytes_standard, 0)), 0)::double precision AS bytes_standard,
        COALESCE(SUM(COALESCE(bytes_standard_ia, 0)), 0)::double precision AS bytes_standard_ia,
        COALESCE(SUM(COALESCE(bytes_glacier, 0)), 0)::double precision AS bytes_glacier,
        COALESCE(SUM(COALESCE(bytes_deep_archive, 0)), 0)::double precision AS bytes_deep_archive
      FROM s3_storage_lens_daily
      WHERE ${conditions.join("\n        AND ")}
      GROUP BY usage_date
      ORDER BY usage_date ASC
      `,
      { bind: binds, type: QueryTypes.SELECT },
    );

    const latestBucketRows = await sequelize.query<S3StorageLatestBucketRow>(
      `
      SELECT DISTINCT ON (bucket_name)
        bucket_name,
        usage_date::text AS usage_date,
        COALESCE(bytes_standard, 0)::double precision AS bytes_standard,
        COALESCE(bytes_standard_ia, 0)::double precision AS bytes_standard_ia,
        COALESCE(bytes_glacier, 0)::double precision AS bytes_glacier,
        COALESCE(bytes_deep_archive, 0)::double precision AS bytes_deep_archive
      FROM s3_storage_lens_daily
      WHERE ${conditions.join("\n        AND ")}
      ORDER BY bucket_name ASC, usage_date DESC
      `,
      { bind: binds, type: QueryTypes.SELECT },
    );

    const trend = trendRows.map((row) => {
      const standard = toNumber(row.bytes_standard);
      const standardIa = toNumber(row.bytes_standard_ia);
      const glacier = toNumber(row.bytes_glacier);
      const deepArchive = toNumber(row.bytes_deep_archive);
      const totalBytes = standard + standardIa + glacier + deepArchive;
      const estimatedMonthlyCost =
        bytesToGib(standard) * STORAGE_COST_PER_GIB_MONTH.STANDARD +
        bytesToGib(standardIa) * STORAGE_COST_PER_GIB_MONTH.STANDARD_IA +
        bytesToGib(glacier) * STORAGE_COST_PER_GIB_MONTH.GLACIER +
        bytesToGib(deepArchive) * STORAGE_COST_PER_GIB_MONTH.DEEP_ARCHIVE;
      return {
        usageDate: String(row.usage_date ?? ""),
        estimatedMonthlyCost,
        totalBytes,
        byClass: { standard, standardIa, glacier, deepArchive },
      };
    });

    const latest = trend[trend.length - 1] ?? null;
    const first = trend[0] ?? null;
    const latestUsageDate = latest?.usageDate ?? null;

    const byClassBytes = {
      STANDARD: latest?.byClass.standard ?? 0,
      STANDARD_IA: latest?.byClass.standardIa ?? 0,
      GLACIER: latest?.byClass.glacier ?? 0,
      DEEP_ARCHIVE: latest?.byClass.deepArchive ?? 0,
    };

    const byClassCost = {
      STANDARD: bytesToGib(byClassBytes.STANDARD) * STORAGE_COST_PER_GIB_MONTH.STANDARD,
      STANDARD_IA: bytesToGib(byClassBytes.STANDARD_IA) * STORAGE_COST_PER_GIB_MONTH.STANDARD_IA,
      GLACIER: bytesToGib(byClassBytes.GLACIER) * STORAGE_COST_PER_GIB_MONTH.GLACIER,
      DEEP_ARCHIVE: bytesToGib(byClassBytes.DEEP_ARCHIVE) * STORAGE_COST_PER_GIB_MONTH.DEEP_ARCHIVE,
    };

    const expensiveBuckets = latestBucketRows
      .map((row) => {
        const standard = toNumber(row.bytes_standard);
        const standardIa = toNumber(row.bytes_standard_ia);
        const glacier = toNumber(row.bytes_glacier);
        const deepArchive = toNumber(row.bytes_deep_archive);
        const totalBytes = standard + standardIa + glacier + deepArchive;
        const estimatedMonthlyCost =
          bytesToGib(standard) * STORAGE_COST_PER_GIB_MONTH.STANDARD +
          bytesToGib(standardIa) * STORAGE_COST_PER_GIB_MONTH.STANDARD_IA +
          bytesToGib(glacier) * STORAGE_COST_PER_GIB_MONTH.GLACIER +
          bytesToGib(deepArchive) * STORAGE_COST_PER_GIB_MONTH.DEEP_ARCHIVE;
        return {
          bucketName: String(row.bucket_name ?? "").trim(),
          usageDate: String(row.usage_date ?? ""),
          totalBytes,
          estimatedMonthlyCost,
        };
      })
      .filter((row) => row.bucketName.length > 0)
      .sort((a, b) => b.estimatedMonthlyCost - a.estimatedMonthlyCost)
      .slice(0, 10);

    const firstTotal = first?.totalBytes ?? 0;
    const latestTotal = latest?.totalBytes ?? 0;
    const bytesGrowth = latestTotal - firstTotal;
    const growthPct = firstTotal > 0 ? (bytesGrowth / firstTotal) * 100 : null;

    return {
      latestUsageDate,
      totalStorageByClass: [
        {
          storageClass: "STANDARD",
          bytes: byClassBytes.STANDARD,
          gib: bytesToGib(byClassBytes.STANDARD),
          estimatedMonthlyCost: byClassCost.STANDARD,
        },
        {
          storageClass: "STANDARD_IA",
          bytes: byClassBytes.STANDARD_IA,
          gib: bytesToGib(byClassBytes.STANDARD_IA),
          estimatedMonthlyCost: byClassCost.STANDARD_IA,
        },
        {
          storageClass: "GLACIER",
          bytes: byClassBytes.GLACIER,
          gib: bytesToGib(byClassBytes.GLACIER),
          estimatedMonthlyCost: byClassCost.GLACIER,
        },
        {
          storageClass: "DEEP_ARCHIVE",
          bytes: byClassBytes.DEEP_ARCHIVE,
          gib: bytesToGib(byClassBytes.DEEP_ARCHIVE),
          estimatedMonthlyCost: byClassCost.DEEP_ARCHIVE,
        },
      ],
      dailyStorageGrowth: {
        fromDate: first?.usageDate ?? null,
        toDate: latest?.usageDate ?? null,
        bytesGrowth,
        gibGrowth: bytesToGib(bytesGrowth),
        growthPct,
      },
      estimatedMonthlyCost: {
        total:
          byClassCost.STANDARD + byClassCost.STANDARD_IA + byClassCost.GLACIER + byClassCost.DEEP_ARCHIVE,
        byClass: byClassCost,
      },
      costTrend: trend.map((item) => ({
        usageDate: item.usageDate,
        estimatedMonthlyCost: item.estimatedMonthlyCost,
        totalBytes: item.totalBytes,
      })),
      expensiveBuckets,
    };
  }

  async getBucketStorageLens(
    scope: DashboardScope,
    buckets: string[],
  ): Promise<
    Map<
      string,
      {
        usageDate: string;
        objectCount: number | null;
        currentVersionBytes: number | null;
        avgObjectSizeBytes: number | null;
        accessCount: number | null;
        percentInGlacier: number;
        storageClassDistribution: Array<{ name: string; bytes: number; percent: number }>;
      }
    >
  > {
    if (scope.scopeType !== "global" || buckets.length === 0) {
      return new Map();
    }

    const binds: unknown[] = [scope.tenantId, scope.from, scope.to, buckets];
    const conditions: string[] = [
      "tenant_id = $1::uuid",
      "usage_date >= $2::date",
      "usage_date <= $3::date",
      "bucket_name = ANY($4::text[])",
    ];

    if (typeof scope.providerId === "number") {
      binds.push(scope.providerId);
      conditions.push(`provider_id = $${binds.length}`);
    }
    if (Array.isArray(scope.billingSourceIds) && scope.billingSourceIds.length > 0) {
      binds.push(scope.billingSourceIds);
      conditions.push(`billing_source_id = ANY($${binds.length}::bigint[])`);
    }
    if (typeof scope.regionKey === "number") {
      binds.push(scope.regionKey);
      conditions.push(`region_key = $${binds.length}`);
    }
    if (typeof scope.subAccountKey === "number") {
      binds.push(scope.subAccountKey);
      conditions.push(`sub_account_key = $${binds.length}`);
    }

    const rows = await sequelize.query<S3StorageLensRow>(
      `
      SELECT DISTINCT ON (bucket_name)
        bucket_name,
        usage_date::text AS usage_date,
        object_count,
        current_version_bytes,
        avg_object_size_bytes,
        access_count,
        bytes_standard,
        bytes_standard_ia,
        bytes_onezone_ia,
        bytes_intelligent_tiering,
        bytes_glacier,
        bytes_deep_archive
      FROM s3_storage_lens_daily
      WHERE ${conditions.join("\n        AND ")}
      ORDER BY bucket_name ASC, usage_date DESC
      `,
      { bind: binds, type: QueryTypes.SELECT },
    );

    const result = new Map<
      string,
      {
        usageDate: string;
        objectCount: number | null;
        currentVersionBytes: number | null;
        avgObjectSizeBytes: number | null;
        accessCount: number | null;
        percentInGlacier: number;
        storageClassDistribution: Array<{ name: string; bytes: number; percent: number }>;
      }
    >();

    for (const row of rows) {
      const bucketName = String(row.bucket_name ?? "").trim();
      if (!bucketName) continue;

      const bytesStandard = toNumber(row.bytes_standard);
      const bytesStandardIa = toNumber(row.bytes_standard_ia);
      const bytesOnezoneIa = toNumber(row.bytes_onezone_ia);
      const bytesIntelligentTiering = toNumber(row.bytes_intelligent_tiering);
      const bytesGlacier = toNumber(row.bytes_glacier);
      const bytesDeepArchive = toNumber(row.bytes_deep_archive);
      const totalBytes =
        bytesStandard +
        bytesStandardIa +
        bytesOnezoneIa +
        bytesIntelligentTiering +
        bytesGlacier +
        bytesDeepArchive;
      const glacierBytes = bytesGlacier + bytesDeepArchive;

      const distributionRaw = [
        { name: "S3 Standard", bytes: bytesStandard },
        { name: "Standard-IA", bytes: bytesStandardIa },
        { name: "One Zone-IA", bytes: bytesOnezoneIa },
        { name: "Intelligent-Tiering", bytes: bytesIntelligentTiering },
        { name: "Glacier", bytes: bytesGlacier },
        { name: "Deep Archive", bytes: bytesDeepArchive },
      ].filter((item) => item.bytes > 0);

      result.set(bucketName, {
        usageDate: String(row.usage_date ?? ""),
        objectCount: row.object_count == null ? null : toNumber(row.object_count),
        currentVersionBytes: row.current_version_bytes == null ? null : toNumber(row.current_version_bytes),
        avgObjectSizeBytes: row.avg_object_size_bytes == null ? null : toNumber(row.avg_object_size_bytes),
        accessCount: row.access_count == null ? null : toNumber(row.access_count),
        percentInGlacier: totalBytes > 0 ? (glacierBytes / totalBytes) * 100 : 0,
        storageClassDistribution: distributionRaw
          .map((item) => ({
            ...item,
            percent: totalBytes > 0 ? (item.bytes / totalBytes) * 100 : 0,
          }))
          .sort((a, b) => b.bytes - a.bytes),
      });
    }

    return result;
  }

  private buildS3ScopedWhere(scope: DashboardScope): { whereClause: string; params: unknown[]; nextIndex: number } {
    const filter = buildDashboardFilter(scope);
    return {
      whereClause: `${filter.whereClause} AND ${S3_FILTER_SQL}`,
      params: filter.params,
      nextIndex: filter.params.length + 1,
    };
  }

  private buildS3FilterPredicates(
    filters: S3CostInsightsFilters,
    startIndex: number,
  ): { clause: string; params: unknown[] } {
    const conditions: string[] = [];
    const params: unknown[] = [];
    const push = (condition: string, value: unknown) => {
      params.push(value);
      conditions.push(condition.replaceAll("?", `$${startIndex + params.length - 1}`));
    };

    if (filters.costCategory.length > 0) {
      push(`cost_category = ANY(?::text[])`, filters.costCategory);
    }
    if (filters.bucket && filters.bucket.trim().length > 0) {
      push(`LOWER(bucket_name) LIKE LOWER(?)`, `%${filters.bucket.trim()}%`);
    }
    if (filters.storageClass.length > 0) {
      push(`storage_class = ANY(?::text[])`, filters.storageClass);
    }
    if (filters.region.length > 0) {
      push(`COALESCE(NULLIF(region, ''), 'global') = ANY(?::text[])`, filters.region);
    }
    if (filters.account.length > 0) {
      push(`COALESCE(NULLIF(account_id, ''), 'Unspecified') = ANY(?::text[])`, filters.account);
    }
    if (filters.seriesValues.length > 0) {
      if (filters.seriesBy === "cost_category") {
        push(`cost_category = ANY(?::text[])`, filters.seriesValues);
      } else if (filters.seriesBy === "storage_class") {
        push(`storage_class = ANY(?::text[])`, filters.seriesValues);
      } else if (filters.seriesBy === "usage_type") {
        push(`COALESCE(NULLIF(usage_type, ''), 'Unspecified') = ANY(?::text[])`, filters.seriesValues);
      } else if (filters.seriesBy === "operation") {
        push(`COALESCE(NULLIF(operation, ''), 'Unspecified') = ANY(?::text[])`, filters.seriesValues);
      } else if (filters.seriesBy === "product_family") {
        push(`COALESCE(NULLIF(product_family, ''), 'Unspecified') = ANY(?::text[])`, filters.seriesValues);
      } else if (filters.seriesBy === "bucket") {
        push(`bucket_name = ANY(?::text[])`, filters.seriesValues);
      }
    }

    return {
      clause: conditions.length > 0 ? conditions.join("\n          AND ") : "1=1",
      params,
    };
  }

  private getXAxisExpression(costBy: S3CostChartBy): string {
    switch (costBy) {
      case "bucket":
        return "bucket_name";
      case "region":
        return "region_name";
      case "account":
        return "account_name";
      case "date":
      default:
        return "usage_date";
    }
  }

  private getSeriesExpression(seriesBy: S3CostSeriesBy): string {
    switch (seriesBy) {
      case "none":
        return "'Billed Cost ($)'";
      case "usage_type":
        return "COALESCE(NULLIF(usage_type, ''), 'Unspecified')";
      case "operation":
        return "COALESCE(NULLIF(operation, ''), 'Unspecified')";
      case "product_family":
        return "COALESCE(NULLIF(product_family, ''), 'Unspecified')";
      case "bucket":
        return "bucket_name";
      case "storage_class":
        return "storage_class";
      case "cost_category":
      default:
        return "cost_category";
    }
  }

  private getMetricCostExpression(metric: S3CostYAxisMetric): string {
    switch (metric) {
      case "usage_quantity":
        return "usage_quantity";
      case "effective_cost":
        return "total_cost";
      case "amortized_cost":
        return "total_cost";
      case "billed_cost":
      default:
        return "total_cost";
    }
  }

  private buildS3DailyScopedWhere(scope: DashboardScope): { whereClause: string; params: unknown[]; nextIndex: number } {
    const conditions: string[] = [
      "tenant_id = $1::uuid",
      "usage_date >= $2::date",
      "usage_date <= $3::date",
    ];
    const params: unknown[] = [scope.tenantId, scope.from, scope.to];

    if (scope.scopeType === "global") {
      if (typeof scope.providerId === "number") {
        params.push(scope.providerId);
        conditions.push(`provider_id = $${params.length}`);
      }
      if (Array.isArray(scope.billingSourceIds) && scope.billingSourceIds.length > 0) {
        params.push(scope.billingSourceIds);
        conditions.push(`billing_source_id = ANY($${params.length}::bigint[])`);
      }
      if (typeof scope.subAccountKey === "number") {
        params.push(scope.subAccountKey);
        conditions.push(`sub_account_key = $${params.length}`);
      }
      if (typeof scope.regionKey === "number") {
        params.push(scope.regionKey);
        conditions.push(`region_key = $${params.length}`);
      }
    }

    return {
      whereClause: conditions.join("\n        AND "),
      params,
      nextIndex: params.length + 1,
    };
  }

  async getBreakdownChart(
    scope: DashboardScope,
    filters: S3CostInsightsFilters,
  ): Promise<{
    labels: string[];
    series: Array<{ name: string; values: number[] }>;
  }> {
    const scoped = this.buildS3DailyScopedWhere(scope);
    const filterPredicates = this.buildS3FilterPredicates(filters, scoped.nextIndex);
    const xExpr = this.getXAxisExpression(filters.costBy);
    const seriesExpr = this.getSeriesExpression(filters.seriesBy);
    const metricCostExpr = this.getMetricCostExpression(filters.yAxisMetric);

    const rows = await sequelize.query<S3BreakdownRow>(
      `
      WITH filtered AS (
        SELECT
          usage_date::text AS usage_date,
          bucket_name,
          COALESCE(NULLIF(region, ''), 'global') AS region_name,
          COALESCE(NULLIF(account_id, ''), 'Unspecified') AS account_name,
          usage_type,
          operation,
          product_family,
          storage_class,
          cost_category,
          COALESCE(${metricCostExpr}, 0)::double precision AS metric_cost
        FROM s3_cost_daily
        WHERE ${scoped.whereClause}
          AND ${filterPredicates.clause}
      ),
      ranked_x AS (
        SELECT
          ${xExpr} AS x_value,
          SUM(metric_cost)::double precision AS total_cost,
          ROW_NUMBER() OVER (ORDER BY SUM(metric_cost) DESC, ${xExpr} ASC) AS rn
        FROM filtered
        GROUP BY ${xExpr}
      ),
      reduced AS (
        SELECT
          f.*,
          CASE
            WHEN $${scoped.nextIndex + filterPredicates.params.length}::text = 'date' THEN TRUE
            ELSE COALESCE(rx.rn, 999999) <= 30
          END AS keep_x
        FROM filtered f
        LEFT JOIN ranked_x rx ON rx.x_value = ${xExpr}
      )
      SELECT
        ${xExpr} AS x_value,
        ${seriesExpr} AS series_value,
        SUM(metric_cost)::double precision AS metric_cost
      FROM reduced
      WHERE keep_x = TRUE
      GROUP BY ${xExpr}, ${seriesExpr}
      ORDER BY
        CASE WHEN $${scoped.nextIndex + filterPredicates.params.length}::text = 'date' THEN ${xExpr} END ASC,
        CASE WHEN $${scoped.nextIndex + filterPredicates.params.length}::text <> 'date' THEN SUM(metric_cost) END DESC;
      `,
      {
        bind: [...scoped.params, ...filterPredicates.params, filters.costBy],
        type: QueryTypes.SELECT,
      },
    );

    const byX = new Map<string, Map<string, number>>();
    const totalsByX = new Map<string, number>();

    for (const row of rows) {
      const x = String(row.x_value ?? "Unspecified");
      const series = String(row.series_value ?? "Unspecified");
      const cost = toNumber(row.metric_cost);
      if (!byX.has(x)) {
        byX.set(x, new Map());
      }
      const seriesMap = byX.get(x)!;
      seriesMap.set(series, (seriesMap.get(series) ?? 0) + cost);
      totalsByX.set(x, (totalsByX.get(x) ?? 0) + cost);
    }

    const labels = [...byX.keys()];
    if (filters.costBy === "date") {
      labels.sort((a, b) => a.localeCompare(b));
    } else {
      labels.sort((a, b) => (totalsByX.get(b) ?? 0) - (totalsByX.get(a) ?? 0));
    }

    const chartLabels = labels;

    const chartTotalsBySeries = new Map<string, number>();
    for (const label of chartLabels) {
      const seriesMap = byX.get(label);
      if (!seriesMap) continue;
      for (const [seriesName, value] of seriesMap.entries()) {
        chartTotalsBySeries.set(seriesName, (chartTotalsBySeries.get(seriesName) ?? 0) + value);
      }
    }

    const topSeries = [...chartTotalsBySeries.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name]) => name);
    const topSeriesSet = new Set(topSeries);
    const includeOther = [...chartTotalsBySeries.keys()].some((name) => !topSeriesSet.has(name));

    const series = topSeries.map((name) => ({
      name,
      values: chartLabels.map((label) => byX.get(label)?.get(name) ?? 0),
    }));

    if (includeOther) {
      series.push({
        name: "Other",
        values: chartLabels.map((label) => {
          const items = byX.get(label) ?? new Map<string, number>();
          let sum = 0;
          for (const [name, value] of items.entries()) {
            if (!topSeriesSet.has(name)) {
              sum += value;
            }
          }
          return sum;
        }),
      });
    }

    return { labels: chartLabels, series };
  }

  async getBreakdownFilterOptions(scope: DashboardScope): Promise<{
    costCategory: S3CostCategory[];
    usageType: string[];
    operation: string[];
    productFamily: string[];
    bucket: string[];
    storageClass: string[];
    region: string[];
    account: string[];
    costBy: S3CostChartBy[];
    seriesBy: S3CostSeriesBy[];
    yAxisMetric: S3CostYAxisMetric[];
  }> {
    const scoped = this.buildS3DailyScopedWhere(scope);
    const baseCte = `
      WITH scoped AS (
        SELECT
          bucket_name,
          COALESCE(NULLIF(region, ''), 'global') AS region_name,
          COALESCE(NULLIF(account_id, ''), 'Unspecified') AS account_name,
          usage_type,
          operation,
          product_family,
          storage_class,
          cost_category,
          total_cost AS billed_cost
        FROM s3_cost_daily
        WHERE ${scoped.whereClause}
      )
    `;

    const [usageTypeRows, operationRows, productFamilyRows, bucketRows, storageRows, regionRows, accountRows] = await Promise.all([
      sequelize.query<S3OptionRow>(
        `
        ${baseCte}
        SELECT COALESCE(NULLIF(usage_type, ''), 'Unspecified') AS value
        FROM scoped
        GROUP BY COALESCE(NULLIF(usage_type, ''), 'Unspecified')
        ORDER BY SUM(billed_cost) DESC, value ASC
        LIMIT 200;
        `,
        { bind: scoped.params, type: QueryTypes.SELECT },
      ),
      sequelize.query<S3OptionRow>(
        `
        ${baseCte}
        SELECT COALESCE(NULLIF(operation, ''), 'Unspecified') AS value
        FROM scoped
        GROUP BY COALESCE(NULLIF(operation, ''), 'Unspecified')
        ORDER BY SUM(billed_cost) DESC, value ASC
        LIMIT 200;
        `,
        { bind: scoped.params, type: QueryTypes.SELECT },
      ),
      sequelize.query<S3OptionRow>(
        `
        ${baseCte}
        SELECT COALESCE(NULLIF(product_family, ''), 'Unspecified') AS value
        FROM scoped
        GROUP BY COALESCE(NULLIF(product_family, ''), 'Unspecified')
        ORDER BY SUM(billed_cost) DESC, value ASC
        LIMIT 200;
        `,
        { bind: scoped.params, type: QueryTypes.SELECT },
      ),
      sequelize.query<S3OptionRow>(
        `
        ${baseCte}
        SELECT bucket_name AS value
        FROM scoped
        GROUP BY bucket_name
        ORDER BY SUM(billed_cost) DESC, bucket_name ASC
        LIMIT 100;
        `,
        { bind: scoped.params, type: QueryTypes.SELECT },
      ),
      sequelize.query<S3OptionRow>(
        `
        ${baseCte}
        SELECT storage_class AS value
        FROM scoped
        GROUP BY storage_class
        ORDER BY storage_class ASC;
        `,
        { bind: scoped.params, type: QueryTypes.SELECT },
      ),
      sequelize.query<S3OptionRow>(
        `
        ${baseCte}
        SELECT region_name AS value
        FROM scoped
        GROUP BY region_name
        ORDER BY SUM(billed_cost) DESC, region_name ASC;
        `,
        { bind: scoped.params, type: QueryTypes.SELECT },
      ),
      sequelize.query<S3OptionRow>(
        `
        ${baseCte}
        SELECT account_name AS value
        FROM scoped
        GROUP BY account_name
        ORDER BY SUM(billed_cost) DESC, account_name ASC;
        `,
        { bind: scoped.params, type: QueryTypes.SELECT },
      ),
    ]);

    const normalize = (rows: S3OptionRow[]) =>
      rows
        .map((row) => String(row.value ?? "").trim())
        .filter((value) => value.length > 0);

    return {
      costCategory: S3_COST_CATEGORY_OPTIONS,
      usageType: normalize(usageTypeRows),
      operation: normalize(operationRows),
      productFamily: normalize(productFamilyRows),
      bucket: normalize(bucketRows),
      storageClass: normalize(storageRows),
      region: normalize(regionRows),
      account: normalize(accountRows),
      costBy: S3_COST_BY_OPTIONS,
      seriesBy: S3_SERIES_BY_OPTIONS,
      yAxisMetric: S3_Y_AXIS_METRIC_OPTIONS,
    };
  }

  async getTotalS3Cost(scope: DashboardScope): Promise<number> {
    const scoped = this.buildS3DailyScopedWhere(scope);
    const rows = await sequelize.query<S3KpiRow>(
      `
      SELECT COALESCE(SUM(COALESCE(total_cost, 0)), 0)::double precision AS total_s3_cost
      FROM s3_cost_daily
      WHERE ${scoped.whereClause};
      `,
      { bind: scoped.params, type: QueryTypes.SELECT },
    );

    return toNumber(rows[0]?.total_s3_cost);
  }

  async getTotalS3EffectiveCost(scope: DashboardScope): Promise<number> {
    const scoped = this.buildS3DailyScopedWhere(scope);
    const rows = await sequelize.query<S3EffectiveKpiRow>(
      `
      SELECT COALESCE(SUM(COALESCE(total_cost, 0)), 0)::double precision AS total_effective_s3_cost
      FROM s3_cost_daily
      WHERE ${scoped.whereClause};
      `,
      { bind: scoped.params, type: QueryTypes.SELECT },
    );

    return toNumber(rows[0]?.total_effective_s3_cost);
  }

  async getBucketCosts(scope: DashboardScope, limit: number = 250): Promise<S3CostBucketInsight[]> {
    const scoped = this.buildS3DailyScopedWhere(scope);
    const rows = await sequelize.query<S3BucketRow>(
      `
      SELECT
        COALESCE(NULLIF(bucket_name, ''), 'unattributed') AS bucket_name,
        COALESCE(SUM(COALESCE(total_cost, 0)), 0)::double precision AS billed_cost,
        COALESCE(SUM(COALESCE(total_cost, 0)), 0)::double precision AS effective_cost
      FROM s3_cost_daily
      WHERE ${scoped.whereClause}
      GROUP BY COALESCE(NULLIF(bucket_name, ''), 'unattributed')
      ORDER BY billed_cost DESC
      LIMIT $${scoped.params.length + 1};
      `,
      { bind: [...scoped.params, limit], type: QueryTypes.SELECT },
    );

    return rows.map((row) => ({
      bucketName: String(row.bucket_name ?? "unattributed"),
      billedCost: toNumber(row.billed_cost),
      effectiveCost: toNumber(row.effective_cost),
    }));
  }

  async getTrend(scope: DashboardScope): Promise<S3CostTrendInsight[]> {
    const scoped = this.buildS3DailyScopedWhere(scope);
    const rows = await sequelize.query<S3TrendRow>(
      `
      SELECT
        usage_date::text AS usage_start_time,
        COALESCE(SUM(COALESCE(total_cost, 0)), 0)::double precision AS billed_cost,
        COALESCE(SUM(COALESCE(total_cost, 0)), 0)::double precision AS effective_cost
      FROM s3_cost_daily
      WHERE ${scoped.whereClause}
      GROUP BY usage_date
      ORDER BY usage_start_time ASC;
      `,
      { bind: scoped.params, type: QueryTypes.SELECT },
    );

    return rows
      .filter((row) => typeof row.usage_start_time === "string" && row.usage_start_time.length > 0)
      .map((row) => ({
        usageStartTime: String(row.usage_start_time),
        billedCost: toNumber(row.billed_cost),
        effectiveCost: toNumber(row.effective_cost),
      }));
  }

  async getFeatureTrend(scope: DashboardScope): Promise<S3CostFeatureTrendInsight[]> {
    const scoped = this.buildS3DailyScopedWhere(scope);
    const rows = await sequelize.query<S3FeatureTrendRow>(
      `
      SELECT
        usage_date::text AS usage_start_time,
        COALESCE(SUM(CASE WHEN cost_category = 'Storage' THEN total_cost ELSE 0 END), 0)::double precision AS storage,
        COALESCE(SUM(CASE WHEN cost_category = 'Request' THEN total_cost ELSE 0 END), 0)::double precision AS requests,
        COALESCE(SUM(CASE WHEN cost_category = 'Retrieval' THEN total_cost ELSE 0 END), 0)::double precision AS retrieval,
        COALESCE(SUM(CASE WHEN cost_category = 'Transfer' THEN total_cost ELSE 0 END), 0)::double precision AS transfer,
        0::double precision AS bucket,
        0::double precision AS bucket_storage_class,
        COALESCE(SUM(CASE WHEN cost_category = 'Other' THEN total_cost ELSE 0 END), 0)::double precision AS other,
        COALESCE(SUM(total_cost), 0)::double precision AS total
      FROM s3_cost_daily
      WHERE ${scoped.whereClause}
      GROUP BY usage_date
      ORDER BY usage_start_time ASC;
      `,
      { bind: scoped.params, type: QueryTypes.SELECT },
    );

    return rows
      .filter((row) => typeof row.usage_start_time === "string" && row.usage_start_time.length > 0)
      .map((row) => ({
        usageStartTime: String(row.usage_start_time),
        storage: toNumber(row.storage),
        requests: toNumber(row.requests),
        retrieval: toNumber(row.retrieval),
        transfer: toNumber(row.transfer),
        bucket: toNumber(row.bucket),
        bucketStorageClass: toNumber(row.bucket_storage_class),
        other: toNumber(row.other),
        total: toNumber(row.total),
      }));
  }

  async getCostCategoryTable(
    scope: DashboardScope,
    filters: S3CostInsightsFilters,
  ): Promise<S3CostCategoryTableInsight[]> {
    const scoped = this.buildS3DailyScopedWhere(scope);
    const filterPredicates = this.buildS3FilterPredicates(filters, scoped.nextIndex);

    const rows = await sequelize.query<S3CostCategoryTableRow>(
      `
      WITH filtered AS (
        SELECT
          bucket_name,
          COALESCE(NULLIF(region, ''), 'global') AS region_name,
          COALESCE(NULLIF(account_id, ''), 'Unspecified') AS account_name,
          usage_type,
          operation,
          product_family,
          storage_class,
          cost_category,
          COALESCE(total_cost, 0)::double precision AS billed_cost,
          COALESCE(usage_quantity, 0)::double precision AS usage_quantity,
          COALESCE(NULLIF(pricing_unit, ''), 'Units') AS pricing_unit
        FROM s3_cost_daily
        WHERE ${scoped.whereClause}
          AND ${filterPredicates.clause}
      ),
      grouped AS (
        SELECT
          cost_category,
          COALESCE(SUM(billed_cost), 0)::double precision AS cost,
          COALESCE(SUM(usage_quantity), 0)::double precision AS usage_quantity,
          CASE
            WHEN COUNT(DISTINCT pricing_unit) = 1 THEN MIN(pricing_unit)
            ELSE 'Mixed'
          END AS pricing_unit
        FROM filtered
        GROUP BY cost_category
      ),
      total_cost AS (
        SELECT COALESCE(SUM(cost), 0)::double precision AS total
        FROM grouped
      )
      SELECT
        g.cost_category,
        g.cost,
        g.usage_quantity,
        g.pricing_unit,
        CASE
          WHEN t.total > 0 THEN (g.cost / t.total) * 100
          ELSE 0
        END::double precision AS percent_of_bucket_cost
      FROM grouped g
      CROSS JOIN total_cost t
      ORDER BY g.cost DESC, g.cost_category ASC;
      `,
      {
        bind: [...scoped.params, ...filterPredicates.params],
        type: QueryTypes.SELECT,
      },
    );

    return rows.map((row) => ({
      costCategory: (String(row.cost_category ?? "Other") as S3CostCategory),
      cost: toNumber(row.cost),
      usageQuantity: toNumber(row.usage_quantity),
      pricingUnit: String(row.pricing_unit ?? "Units"),
      percentOfBucketCost: toNumber(row.percent_of_bucket_cost),
    }));
  }

  async getUsageOperationTable(
    scope: DashboardScope,
    filters: S3CostInsightsFilters,
    limit: number = 2000,
  ): Promise<S3UsageOperationTableInsight[]> {
    const scoped = this.buildS3DailyScopedWhere(scope);
    const filterPredicates = this.buildS3FilterPredicates(filters, scoped.nextIndex);
    const limitPlaceholder = scoped.params.length + filterPredicates.params.length + 1;

    const rows = await sequelize.query<S3UsageOperationTableRow>(
      `
      WITH filtered AS (
        SELECT
          bucket_name,
          COALESCE(NULLIF(region, ''), 'global') AS region_name,
          COALESCE(NULLIF(account_id, ''), 'Unspecified') AS account_name,
          usage_type,
          operation,
          product_family,
          storage_class,
          cost_category,
          COALESCE(total_cost, 0)::double precision AS billed_cost,
          COALESCE(usage_quantity, 0)::double precision AS quantity,
          COALESCE(NULLIF(pricing_unit, ''), 'Units') AS unit
        FROM s3_cost_daily
        WHERE ${scoped.whereClause}
          AND ${filterPredicates.clause}
      )
      SELECT
        COALESCE(NULLIF(usage_type, ''), 'Unspecified') AS usage_type,
        COALESCE(NULLIF(operation, ''), 'Unspecified') AS operation,
        COALESCE(SUM(billed_cost), 0)::double precision AS cost,
        COALESCE(SUM(quantity), 0)::double precision AS quantity,
        CASE
          WHEN COUNT(DISTINCT unit) = 1 THEN MIN(unit)
          ELSE 'Mixed'
        END AS unit
      FROM filtered
      GROUP BY COALESCE(NULLIF(usage_type, ''), 'Unspecified'), COALESCE(NULLIF(operation, ''), 'Unspecified')
      ORDER BY cost DESC, usage_type ASC, operation ASC
      LIMIT $${limitPlaceholder};
      `,
      {
        bind: [...scoped.params, ...filterPredicates.params, limit],
        type: QueryTypes.SELECT,
      },
    );

    const isTransferOnly = filters.costCategory.length === 1 && filters.costCategory[0] === "Transfer";
    const isRequestOnly = filters.costCategory.length === 1 && filters.costCategory[0] === "Request";

    return rows.map((row) => ({
      usageType: String(row.usage_type ?? "Unspecified"),
      operation: String(row.operation ?? "Unspecified"),
      cost: toNumber(row.cost),
      quantity: toNumber(row.quantity),
      unit: isTransferOnly ? "GB" : isRequestOnly ? "Requests" : String(row.unit ?? "Units"),
    }));
  }

  async getBucketCostBreakdown(
    scope: DashboardScope,
    filters: S3CostInsightsFilters,
    limit: number = 5000,
    options?: { includeAttributionTags?: boolean },
  ): Promise<Omit<S3CostBucketTableInsight, "trendPct">[]> {
    void options;
    const scoped = this.buildS3DailyScopedWhere(scope);
    const filterPredicates = this.buildS3FilterPredicates(filters, scoped.nextIndex);
    const limitPlaceholder = scoped.params.length + filterPredicates.params.length + 1;
    const rows = await sequelize.query<S3BucketBreakdownRow>(
      `
      WITH filtered_with_filters AS (
        SELECT
          bucket_name,
          COALESCE(NULLIF(region, ''), 'global') AS region_name,
          COALESCE(NULLIF(account_id, ''), 'Unspecified') AS account_name,
          COALESCE(total_cost, 0)::double precision AS billed_cost,
          cost_category
        FROM s3_cost_daily
        WHERE ${scoped.whereClause}
          AND ${filterPredicates.clause}
      ),
      bucket_agg AS (
        SELECT
          bucket_name,
          COALESCE(SUM(billed_cost), 0)::double precision AS cost,
          COALESCE(SUM(CASE WHEN cost_category = 'Storage' THEN billed_cost ELSE 0 END), 0)::double precision AS storage,
          COALESCE(SUM(CASE WHEN cost_category = 'Request' THEN billed_cost ELSE 0 END), 0)::double precision AS requests,
          COALESCE(SUM(CASE WHEN cost_category = 'Transfer' THEN billed_cost ELSE 0 END), 0)::double precision AS transfer,
          COALESCE(SUM(CASE WHEN cost_category = 'Retrieval' THEN billed_cost ELSE 0 END), 0)::double precision AS retrieval,
          COALESCE(SUM(CASE WHEN cost_category = 'Other' THEN billed_cost ELSE 0 END), 0)::double precision AS other,
          0::double precision AS savings
        FROM filtered_with_filters
        GROUP BY bucket_name
      ),
      region_rank AS (
        SELECT
          bucket_name,
          region_name,
          SUM(billed_cost)::double precision AS billed_cost,
          ROW_NUMBER() OVER (
            PARTITION BY bucket_name
            ORDER BY SUM(billed_cost) DESC, region_name ASC
          ) AS rn
        FROM filtered_with_filters
        GROUP BY bucket_name, region_name
      ),
      account_rank AS (
        SELECT
          bucket_name,
          account_name,
          SUM(billed_cost)::double precision AS billed_cost,
          ROW_NUMBER() OVER (
            PARTITION BY bucket_name
            ORDER BY SUM(billed_cost) DESC, account_name ASC
          ) AS rn
        FROM filtered_with_filters
        GROUP BY bucket_name, account_name
      )
      SELECT
        ba.bucket_name,
        COALESCE(ar.account_name, 'Unspecified') AS account,
        ba.cost,
        ba.storage,
        ba.requests,
        ba.transfer,
        ba.retrieval,
        ba.other,
        ba.savings,
        COALESCE(rr.region_name, 'global') AS region,
        'Unassigned' AS owner,
        CASE
          WHEN GREATEST(ba.storage, ba.requests, ba.transfer, ba.retrieval, ba.other) = ba.storage THEN 'Storage'
          WHEN GREATEST(ba.storage, ba.requests, ba.transfer, ba.retrieval, ba.other) = ba.requests THEN 'Request'
          WHEN GREATEST(ba.storage, ba.requests, ba.transfer, ba.retrieval, ba.other) = ba.transfer THEN 'Transfer'
          WHEN GREATEST(ba.storage, ba.requests, ba.transfer, ba.retrieval, ba.other) = ba.retrieval THEN 'Retrieval'
          ELSE 'Other'
        END AS driver
      FROM bucket_agg ba
      LEFT JOIN region_rank rr
        ON rr.bucket_name = ba.bucket_name
       AND rr.rn = 1
      LEFT JOIN account_rank ar
        ON ar.bucket_name = ba.bucket_name
       AND ar.rn = 1
      ORDER BY ba.cost DESC
      LIMIT $${limitPlaceholder};
      `,
      { bind: [...scoped.params, ...filterPredicates.params, limit], type: QueryTypes.SELECT },
    );

    return rows.map((row) => ({
      bucketName: String(row.bucket_name ?? "unattributed"),
      account: String(row.account ?? "Unspecified"),
      cost: toNumber(row.cost),
      storage: toNumber(row.storage),
      requests: toNumber(row.requests),
      transfer: toNumber(row.transfer),
      region: String(row.region ?? "global"),
      owner: String(row.owner ?? "Unassigned"),
      driver: String(row.driver ?? "Other"),
      savings: toNumber(row.savings),
      retrieval: toNumber(row.retrieval),
      other: toNumber(row.other),
      replicationStatus: row.replication_status ? String(row.replication_status) : null,
      versioningStatus: row.versioning_status ? String(row.versioning_status) : null,
      encryptionStatus: row.encryption_status ? String(row.encryption_status) : null,
      publicAccessStatus:
        String(row.public_access_status ?? "").trim().toLowerCase() === "public"
          ? "Public"
          : String(row.public_access_status ?? "").trim().toLowerCase() === "private"
            ? "Private"
            : "Unknown",
    }));
  }
}
