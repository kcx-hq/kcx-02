import { QueryTypes } from "sequelize";

import { sequelize } from "../../../../models/index.js";

type S3DailyCategoryPoint = {
  usageDate: string;
  costCategory:
    | "Overall"
    | "Storage"
    | "Transfer"
    | "Request"
    | "GlacierRetrieval"
    | "Replication";
  cost: number;
  usageType: string | null;
  subAccountKey: string | null;
  subAccountId: string | null;
  subAccountName: string | null;
  accountId: string | null;
  bucketName: string | null;
  regionKey: string | null;
  regionName: string | null;
};

export type S3CostSpikeAnomalyType =
  | "S3_OVERALL_COST_SPIKE"
  | "S3_STORAGE_COST_SPIKE"
  | "S3_DATA_TRANSFER_COST_SPIKE"
  | "S3_REQUEST_COST_SPIKE"
  | "S3_GLACIER_RETRIEVAL_COST_SPIKE"
  | "S3_REPLICATION_COST_SPIKE"
  | "S3_MULTIPART_UPLOAD_WASTE"
  | "S3_STORAGE_GROWTH_ANOMALY"
  | "S3_OBJECT_COUNT_EXPLOSION"
  | "S3_PUBLIC_ACCESS_RISK";

const GLOBAL_S3_ANOMALY_TYPES: ReadonlySet<S3CostSpikeAnomalyType> = new Set([
  "S3_STORAGE_COST_SPIKE",
  "S3_DATA_TRANSFER_COST_SPIKE",
  "S3_REQUEST_COST_SPIKE",
]);

export type S3CostSpikeCandidate = {
  usageDate: string;
  anomalyType: S3CostSpikeAnomalyType;
  actualCost: number;
  expectedCost: number;
  deltaCost: number;
  deltaPercent: number;
  historyCount: number;
  severity: "low" | "medium" | "high";
  recommendation: string;
  description: string;
  usageType: string | null;
  subAccountKey: string | null;
  subAccountId: string | null;
  subAccountName: string | null;
  accountId: string | null;
  bucketName: string | null;
  regionKey: string | null;
  regionName: string | null;
  sourceTable: "s3_cost_daily" | "s3_storage_lens_daily" | "s3_bucket_config_snapshot";
};

export type S3CostSpikeGuardrails = {
  historyDaysRequired: number;
  minimumExpectedBaseline: number;
  minimumAbsoluteDelta: number;
  minimumPercentageDelta: number;
};

export type S3CostSpikeDetectionResult = {
  billingSourceId: string;
  effectiveDateFrom: string | null;
  effectiveDateTo: string | null;
  historyWindowStart: string | null;
  historyWindowEnd: string | null;
  defaultedDateWindow: boolean;
  observedDaysInWindow: number;
  evaluatedDays: number;
  candidates: S3CostSpikeCandidate[];
  guardrails: S3CostSpikeGuardrails;
};

const BASELINE_WINDOW_DAYS = 30;
const MIN_HISTORY_DAYS_REQUIRED = 1;
const MINIMUM_EXPECTED_BASELINE = 0.001;
const MINIMUM_ABSOLUTE_DELTA = 0.01;
const MINIMUM_PERCENTAGE_DELTA = 0.15;
const MINIMUM_NEW_ACTIVITY_COST = 0.05;
const NEW_ACTIVITY_WARMUP_DAYS = 2;
const DEFAULT_INCREMENTAL_TARGET_DAYS = 3;
const STORAGE_GROWTH_MIN_PERCENTAGE_DELTA = 0.3;
const STORAGE_GROWTH_MIN_ABSOLUTE_GIB_DELTA = 1;
const STORAGE_GIB_TO_ESTIMATED_MONTHLY_USD = 0.023;
const OBJECT_COUNT_MIN_PERCENTAGE_DELTA = 0.4;
const OBJECT_COUNT_MIN_ABSOLUTE_DELTA = 500;
const MULTIPART_WASTE_MIN_GIB = 0.5;
const MULTIPART_WASTE_MIN_PERCENT_OF_TOTAL = 0.05;
const PUBLIC_ACCESS_RISK_IMPACT_COST = 0.1;

const parseDateOnlyUtc = (value: string): Date => new Date(`${value}T00:00:00.000Z`);
const formatDateOnlyUtc = (value: Date): string => value.toISOString().slice(0, 10);
const addDaysUtc = (value: Date, deltaDays: number): Date => {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + deltaDays);
  return next;
};

const mean = (values: number[]): number => {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const mapSeverity = (deltaPercent: number): "low" | "medium" | "high" => {
  if (deltaPercent >= 1.5) return "high";
  if (deltaPercent >= 0.8) return "medium";
  return "low";
};

const severityRank = (severity: "low" | "medium" | "high"): number =>
  severity === "high" ? 3 : severity === "medium" ? 2 : 1;

const toAnomalyType = (category: S3DailyCategoryPoint["costCategory"]): S3CostSpikeAnomalyType => {
  if (category === "Overall") return "S3_OVERALL_COST_SPIKE";
  if (category === "Storage") return "S3_STORAGE_COST_SPIKE";
  if (category === "Transfer") return "S3_DATA_TRANSFER_COST_SPIKE";
  if (category === "GlacierRetrieval") return "S3_GLACIER_RETRIEVAL_COST_SPIKE";
  if (category === "Replication") return "S3_REPLICATION_COST_SPIKE";
  return "S3_REQUEST_COST_SPIKE";
};

const toRecommendation = (anomalyType: S3CostSpikeAnomalyType): string => {
  if (anomalyType === "S3_STORAGE_COST_SPIKE") {
    return "Review recent uploads and bucket growth patterns.";
  }
  if (anomalyType === "S3_DATA_TRANSFER_COST_SPIKE") {
    return "Investigate download traffic, CDN configuration, and public access patterns.";
  }
  if (anomalyType === "S3_STORAGE_GROWTH_ANOMALY") {
    return "Review recent uploads, retention rules, and lifecycle transitions for rapid bucket-size growth.";
  }
  if (anomalyType === "S3_GLACIER_RETRIEVAL_COST_SPIKE") {
    return "Review restore jobs and retrieval patterns from Glacier/Deep Archive tiers.";
  }
  if (anomalyType === "S3_REPLICATION_COST_SPIKE") {
    return "Check replication rules, destination regions, and sudden copy traffic.";
  }
  if (anomalyType === "S3_OVERALL_COST_SPIKE") {
    return "Check which S3 cost categories (storage, request, transfer) drove the overall spike.";
  }
  if (anomalyType === "S3_MULTIPART_UPLOAD_WASTE") {
    return "Abort stale multipart uploads and add lifecycle cleanup for incomplete parts.";
  }
  if (anomalyType === "S3_OBJECT_COUNT_EXPLOSION") {
    return "Investigate object-creation bursts and archive/delete low-value small objects.";
  }
  if (anomalyType === "S3_PUBLIC_ACCESS_RISK") {
    return "Block public access and tighten bucket policy/ACL settings immediately.";
  }
  return "Check for retry loops, high-frequency scans, and application request storms.";
};

const toDescription = (anomalyType: S3CostSpikeAnomalyType, deltaPercent: number): string => {
  void deltaPercent;
  if (anomalyType === "S3_STORAGE_COST_SPIKE") {
    return "S3 storage cost increased compared to normal daily usage.";
  }
  if (anomalyType === "S3_DATA_TRANSFER_COST_SPIKE") {
    return "Unexpected increase in S3 internet egress traffic detected.";
  }
  if (anomalyType === "S3_STORAGE_GROWTH_ANOMALY") {
    return "Bucket size grew abnormally fast.";
  }
  if (anomalyType === "S3_GLACIER_RETRIEVAL_COST_SPIKE") {
    return "Glacier retrieval charges increased unexpectedly.";
  }
  if (anomalyType === "S3_REPLICATION_COST_SPIKE") {
    return "S3 replication charges increased unexpectedly.";
  }
  if (anomalyType === "S3_OVERALL_COST_SPIKE") {
    return "Overall S3 daily cost increased unexpectedly.";
  }
  if (anomalyType === "S3_MULTIPART_UPLOAD_WASTE") {
    return "Incomplete multipart uploads are consuming significant storage.";
  }
  if (anomalyType === "S3_OBJECT_COUNT_EXPLOSION") {
    return "Object count is growing abnormally fast.";
  }
  if (anomalyType === "S3_PUBLIC_ACCESS_RISK") {
    return "One or more S3 buckets appear publicly accessible.";
  }
  return "S3 API request charges significantly exceeded baseline usage.";
};

const toRegionLabel = (regionName: string | null | undefined): string =>
  String(regionName ?? "").trim() || "Global/Unknown";

type S3DailyStorageBytesPoint = {
  usageDate: string;
  storageBytes: number;
  objectCount: number;
  multipartBytes: number;
  subAccountKey: string | null;
  subAccountId: string | null;
  subAccountName: string | null;
  regionKey: string | null;
  regionName: string | null;
};

const bytesToGib = (bytes: number): number => bytes / (1024 ** 3);

const fetchLatestUsageDate = async ({
  billingSourceId,
  tenantId,
}: {
  billingSourceId: string;
  tenantId: string | null;
}): Promise<string | null> => {
  const [row] = await sequelize.query<{ usage_date: string | null }>(
    `
      SELECT MAX(scd.usage_date)::text AS usage_date
      FROM s3_cost_daily scd
      WHERE scd.billing_source_id = CAST(:billingSourceId AS BIGINT)
        AND (:tenantId IS NULL OR scd.tenant_id = CAST(:tenantId AS UUID))
    `,
    {
      replacements: { billingSourceId, tenantId },
      type: QueryTypes.SELECT,
    },
  );

  return row?.usage_date ?? null;
};

const resolveEffectiveWindow = async ({
  billingSourceId,
  tenantId,
  dateFrom,
  dateTo,
}: {
  billingSourceId: string;
  tenantId: string | null;
  dateFrom: string | null;
  dateTo: string | null;
}): Promise<{ dateFrom: string | null; dateTo: string | null; defaulted: boolean }> => {
  if (dateFrom && dateTo) {
    return { dateFrom, dateTo, defaulted: false };
  }

  const latestUsageDate = await fetchLatestUsageDate({ billingSourceId, tenantId });
  if (!latestUsageDate) {
    return { dateFrom: null, dateTo: null, defaulted: true };
  }

  const end = parseDateOnlyUtc(latestUsageDate);
  const start = addDaysUtc(end, -(DEFAULT_INCREMENTAL_TARGET_DAYS - 1));
  return {
    dateFrom: formatDateOnlyUtc(start),
    dateTo: formatDateOnlyUtc(end),
    defaulted: true,
  };
};

const fetchDailyCategoryCosts = async ({
  billingSourceId,
  tenantId,
  dateFrom,
  dateTo,
}: {
  billingSourceId: string;
  tenantId: string | null;
  dateFrom: string;
  dateTo: string;
}): Promise<S3DailyCategoryPoint[]> => {
  const rows = await sequelize.query<{
    usage_date: string;
    cost_category: "Overall" | "Storage" | "Transfer" | "Request" | "GlacierRetrieval" | "Replication";
    usage_type: string | null;
    total_cost: string;
    sub_account_key: string | null;
    sub_account_id: string | null;
    sub_account_name: string | null;
    account_id: string | null;
    bucket_name: string | null;
    region_key: string | null;
    region_name: string | null;
  }>(
    `
      WITH classified AS (
        SELECT
          scd.usage_date,
          CASE
            WHEN LOWER(COALESCE(scd.cost_category, '')) = 'retrieval'
              OR LOWER(COALESCE(scd.operation_group, '')) LIKE '%retrieval%'
              OR LOWER(COALESCE(scd.usage_type, '')) LIKE '%glacier%'
              OR LOWER(COALESCE(scd.usage_type, '')) LIKE '%retrieval%'
              OR LOWER(COALESCE(scd.operation, '')) LIKE '%restore%'
            THEN 'GlacierRetrieval'
            WHEN LOWER(COALESCE(scd.operation_group, '')) LIKE '%replication%'
              OR LOWER(COALESCE(scd.usage_type, '')) LIKE '%replication%'
              OR LOWER(COALESCE(scd.operation, '')) LIKE '%replication%'
              OR LOWER(COALESCE(scd.product_family, '')) LIKE '%replication%'
            THEN 'Replication'
            WHEN LOWER(COALESCE(scd.cost_category, '')) = 'storage' THEN 'Storage'
            WHEN LOWER(COALESCE(scd.cost_category, '')) = 'transfer' THEN 'Transfer'
            WHEN LOWER(COALESCE(scd.cost_category, '')) = 'request' THEN 'Request'
            ELSE NULL
          END AS cost_category,
          NULLIF(TRIM(COALESCE(scd.usage_type, '')), '')::text AS usage_type,
          COALESCE(scd.total_cost, 0) AS total_cost,
          scd.sub_account_key,
          dsa.sub_account_id,
          dsa.sub_account_name,
          NULLIF(TRIM(COALESCE(scd.account_id, '')), '') AS account_id,
          NULLIF(TRIM(COALESCE(scd.bucket_name, '')), '') AS bucket_name,
          scd.region_key,
          COALESCE(dr.region_name, dr.region_id, 'Global/Unknown') AS region_name
        FROM s3_cost_daily scd
        LEFT JOIN dim_sub_account dsa ON dsa.id = scd.sub_account_key
        LEFT JOIN dim_region dr ON dr.id = scd.region_key
        WHERE scd.billing_source_id = CAST(:billingSourceId AS BIGINT)
          AND (:tenantId IS NULL OR scd.tenant_id = CAST(:tenantId AS UUID))
          AND scd.usage_date BETWEEN :dateFrom AND :dateTo
      )
      SELECT
        c.usage_date::text AS usage_date,
        c.cost_category,
        c.usage_type,
        COALESCE(SUM(c.total_cost), 0)::text AS total_cost,
        c.sub_account_key::text AS sub_account_key,
        c.sub_account_id::text AS sub_account_id,
        c.sub_account_name::text AS sub_account_name,
        MIN(c.account_id)::text AS account_id,
        MIN(c.bucket_name)::text AS bucket_name,
        c.region_key::text AS region_key,
        c.region_name::text AS region_name
      FROM classified c
      WHERE c.cost_category IS NOT NULL
      GROUP BY
        c.usage_date,
        c.cost_category,
        c.usage_type,
        c.sub_account_key,
        c.sub_account_id,
        c.sub_account_name,
        c.region_key,
        c.region_name
      ORDER BY c.usage_date ASC
    `,
    {
      replacements: { billingSourceId, tenantId, dateFrom, dateTo },
      type: QueryTypes.SELECT,
    },
  );

  return rows.map((row) => ({
    usageDate: row.usage_date,
    costCategory: row.cost_category,
    usageType: row.usage_type,
    cost: Number(row.total_cost ?? 0),
    subAccountKey: row.sub_account_key,
    subAccountId: row.sub_account_id,
    subAccountName: row.sub_account_name,
    accountId: row.account_id,
    bucketName: row.bucket_name,
    regionKey: row.region_key,
    regionName: row.region_name,
  }));
};

const fetchDailyStorageBytes = async ({
  billingSourceId,
  tenantId,
  dateFrom,
  dateTo,
}: {
  billingSourceId: string;
  tenantId: string | null;
  dateFrom: string;
  dateTo: string;
}): Promise<S3DailyStorageBytesPoint[]> => {
  const rows = await sequelize.query<{
    usage_date: string;
    storage_bytes: string;
    object_count: string;
    multipart_bytes: string;
    sub_account_key: string | null;
    sub_account_id: string | null;
    sub_account_name: string | null;
    region_key: string | null;
    region_name: string | null;
  }>(
    `
      SELECT
        sld.usage_date::text AS usage_date,
        COALESCE(
          SUM(
            COALESCE(sld.bytes_standard, 0) +
            COALESCE(sld.bytes_standard_ia, 0) +
            COALESCE(sld.bytes_onezone_ia, 0) +
            COALESCE(sld.bytes_intelligent_tiering, 0) +
            COALESCE(sld.bytes_glacier, 0) +
            COALESCE(sld.bytes_deep_archive, 0)
          ),
          0
        )::text AS storage_bytes,
        COALESCE(SUM(COALESCE(sld.object_count, 0)), 0)::text AS object_count,
        COALESCE(SUM(COALESCE(sld.incomplete_multipart_upload_bytes, 0)), 0)::text AS multipart_bytes,
        sld.sub_account_key::text AS sub_account_key,
        dsa.sub_account_id::text AS sub_account_id,
        dsa.sub_account_name::text AS sub_account_name,
        sld.region_key::text AS region_key,
        COALESCE(dr.region_name, dr.region_id, 'Global/Unknown')::text AS region_name
      FROM s3_storage_lens_daily sld
      LEFT JOIN dim_sub_account dsa ON dsa.id = sld.sub_account_key
      LEFT JOIN dim_region dr ON dr.id = sld.region_key
      WHERE sld.billing_source_id = CAST(:billingSourceId AS BIGINT)
        AND (:tenantId IS NULL OR sld.tenant_id = CAST(:tenantId AS UUID))
        AND sld.usage_date BETWEEN :dateFrom AND :dateTo
      GROUP BY sld.usage_date, sld.sub_account_key, dsa.sub_account_id, dsa.sub_account_name, sld.region_key, dr.region_name, dr.region_id
      ORDER BY sld.usage_date ASC
    `,
    {
      replacements: { billingSourceId, tenantId, dateFrom, dateTo },
      type: QueryTypes.SELECT,
    },
  );

  return rows.map((row) => ({
    usageDate: row.usage_date,
    storageBytes: Number(row.storage_bytes ?? 0),
    objectCount: Number(row.object_count ?? 0),
    multipartBytes: Number(row.multipart_bytes ?? 0),
    subAccountKey: row.sub_account_key,
    subAccountId: row.sub_account_id,
    subAccountName: row.sub_account_name,
    regionKey: row.region_key,
    regionName: row.region_name,
  }));
};

const fetchPublicAccessRiskRows = async ({
  billingSourceId,
  tenantId,
  dateFrom,
  dateTo,
}: {
  billingSourceId: string;
  tenantId: string | null;
  dateFrom: string;
  dateTo: string;
}): Promise<
  Array<{
    usageDate: string;
    subAccountId: string | null;
    regionName: string | null;
    riskyBucketCount: number;
  }>
> => {
  const rows = await sequelize.query<{
    usage_date: string;
    account_id: string | null;
    region: string | null;
    risky_bucket_count: string;
  }>(
    `
      SELECT
        DATE(s.scan_time)::text AS usage_date,
        NULLIF(TRIM(COALESCE(s.account_id, '')), '')::text AS account_id,
        NULLIF(TRIM(COALESCE(s.region, '')), '')::text AS region,
        COUNT(*)::text AS risky_bucket_count
      FROM s3_bucket_config_snapshot s
      WHERE s.billing_source_id = CAST(:billingSourceId AS BIGINT)
        AND (:tenantId IS NULL OR s.tenant_id = CAST(:tenantId AS UUID))
        AND DATE(s.scan_time) BETWEEN :dateFrom AND :dateTo
        AND (
          LOWER(COALESCE(s.policy_public_status, '')) LIKE '%public%'
          OR LOWER(COALESCE(s.public_access_block_status, '')) LIKE '%public%'
          OR COALESCE(s.block_public_policy, false) = false
          OR COALESCE(s.restrict_public_buckets, false) = false
        )
      GROUP BY DATE(s.scan_time), account_id, region
      ORDER BY DATE(s.scan_time) ASC
    `,
    {
      replacements: { billingSourceId, tenantId, dateFrom, dateTo },
      type: QueryTypes.SELECT,
    },
  );

  return rows.map((row) => ({
    usageDate: row.usage_date,
    subAccountId: row.account_id,
    regionName: row.region ?? "Global/Unknown",
    riskyBucketCount: Number(row.risky_bucket_count ?? 0),
  }));
};

export async function detectS3CostSpikesForSource({
  billingSourceId,
  tenantId,
  dateFrom,
  dateTo,
}: {
  billingSourceId: string;
  tenantId: string | null;
  dateFrom: string | null;
  dateTo: string | null;
}): Promise<S3CostSpikeDetectionResult> {
  const effectiveWindow = await resolveEffectiveWindow({
    billingSourceId,
    tenantId,
    dateFrom,
    dateTo,
  });

  if (!effectiveWindow.dateFrom || !effectiveWindow.dateTo) {
    return {
      billingSourceId,
      effectiveDateFrom: null,
      effectiveDateTo: null,
      historyWindowStart: null,
      historyWindowEnd: null,
      defaultedDateWindow: effectiveWindow.defaulted,
      observedDaysInWindow: 0,
      evaluatedDays: 0,
      candidates: [],
      guardrails: {
        historyDaysRequired: MIN_HISTORY_DAYS_REQUIRED,
        minimumExpectedBaseline: MINIMUM_EXPECTED_BASELINE,
        minimumAbsoluteDelta: MINIMUM_ABSOLUTE_DELTA,
        minimumPercentageDelta: MINIMUM_PERCENTAGE_DELTA,
      },
    };
  }

  const targetFrom = parseDateOnlyUtc(effectiveWindow.dateFrom);
  const targetTo = parseDateOnlyUtc(effectiveWindow.dateTo);
  const historyStart = addDaysUtc(targetFrom, -BASELINE_WINDOW_DAYS);
  const points = await fetchDailyCategoryCosts({
    billingSourceId,
    tenantId,
    dateFrom: formatDateOnlyUtc(historyStart),
    dateTo: formatDateOnlyUtc(targetTo),
  });
  const storagePoints = await fetchDailyStorageBytes({
    billingSourceId,
    tenantId,
    dateFrom: formatDateOnlyUtc(historyStart),
    dateTo: formatDateOnlyUtc(targetTo),
  });

  const pointsByStream = new Map<string, S3DailyCategoryPoint[]>();
  for (const point of points) {
    const streamKey = [
      point.subAccountId ?? "unknown_account",
      point.regionKey ?? "global_unknown",
      point.costCategory,
      point.usageType ?? "unknown_usage_type",
    ].join("|");
    const stream = pointsByStream.get(streamKey) ?? [];
    stream.push(point);
    pointsByStream.set(streamKey, stream);
  }

  const candidates: S3CostSpikeCandidate[] = [];
  let observedDaysInWindow = 0;
  let evaluatedDays = 0;
  const targetFromDate = formatDateOnlyUtc(targetFrom);
  const targetToDate = formatDateOnlyUtc(targetTo);

  for (const categoryPoints of pointsByStream.values()) {
    const category = categoryPoints[0]?.costCategory;
    if (!category) continue;
    const sortedPoints = [...categoryPoints].sort((a, b) => a.usageDate.localeCompare(b.usageDate));

    for (let index = 0; index < sortedPoints.length; index += 1) {
      const point = sortedPoints[index];
      if (point.usageDate < targetFromDate || point.usageDate > targetToDate) continue;
      observedDaysInWindow += 1;

      const historicalValues = sortedPoints
        .slice(0, index)
        .map((entry) => entry.cost)
        .slice(-BASELINE_WINDOW_DAYS);

      if (historicalValues.length === 0) {
        // For newly connected accounts, treat meaningful first-day spend as a soft anomaly signal.
        if (point.cost >= MINIMUM_NEW_ACTIVITY_COST) {
          const anomalyType = toAnomalyType(category);
          candidates.push({
            usageDate: point.usageDate,
            anomalyType,
            actualCost: point.cost,
            expectedCost: 0,
            deltaCost: point.cost,
            deltaPercent: 1,
            historyCount: 0,
            severity: "low",
            recommendation: toRecommendation(anomalyType),
            description: `${toDescription(anomalyType, 1)} in ${toRegionLabel(point.regionName)}.`,
            usageType: point.usageType,
            subAccountKey: point.subAccountKey,
            subAccountId: point.subAccountId,
            subAccountName: point.subAccountName,
            accountId: point.accountId,
            bucketName: point.bucketName,
            regionKey: point.regionKey,
            regionName: point.regionName,
            sourceTable: "s3_cost_daily",
          });
        }
        continue;
      }

      if (historicalValues.length < MIN_HISTORY_DAYS_REQUIRED) continue;
      evaluatedDays += 1;

      const expectedCost = mean(historicalValues);
      const deltaCost = point.cost - expectedCost;
      if (deltaCost <= 0) continue;

      const deltaPercent = expectedCost > 0 ? deltaCost / expectedCost : 0;
      const isWarmupWindow = historicalValues.length <= NEW_ACTIVITY_WARMUP_DAYS;

      if (expectedCost <= MINIMUM_EXPECTED_BASELINE) {
        if (!isWarmupWindow || point.cost < MINIMUM_NEW_ACTIVITY_COST) continue;
      } else if (deltaCost < MINIMUM_ABSOLUTE_DELTA || deltaPercent < MINIMUM_PERCENTAGE_DELTA) {
        continue;
      }

      const anomalyType = toAnomalyType(category);
      candidates.push({
        usageDate: point.usageDate,
        anomalyType,
        actualCost: point.cost,
        expectedCost,
        deltaCost,
        deltaPercent,
        historyCount: historicalValues.length,
        severity: mapSeverity(deltaPercent),
        recommendation: toRecommendation(anomalyType),
        description: `${toDescription(anomalyType, deltaPercent)} in ${toRegionLabel(point.regionName)}.`,
        usageType: point.usageType,
        subAccountKey: point.subAccountKey,
        subAccountId: point.subAccountId,
        subAccountName: point.subAccountName,
        accountId: point.accountId,
        bucketName: point.bucketName,
        regionKey: point.regionKey,
        regionName: point.regionName,
        sourceTable: "s3_cost_daily",
      });
    }
  }

  // Detect overall daily S3 cost spikes regardless of category split.
  const overallByStream = new Map<string, S3DailyCategoryPoint[]>();
  for (const point of points) {
    const streamKey = [point.subAccountId ?? "unknown_account", point.regionKey ?? "global_unknown", "overall"].join("|");
    const stream = overallByStream.get(streamKey) ?? [];
    stream.push({ ...point, costCategory: "Overall", usageType: "overall_daily_total" });
    overallByStream.set(streamKey, stream);
  }
  for (const overallStream of overallByStream.values()) {
    const byDate = new Map<string, S3DailyCategoryPoint>();
    for (const point of overallStream) {
      const existing = byDate.get(point.usageDate);
      if (!existing) {
        byDate.set(point.usageDate, { ...point });
        continue;
      }
      existing.cost += point.cost;
    }
    const sortedPoints = Array.from(byDate.values()).sort((a, b) => a.usageDate.localeCompare(b.usageDate));
    for (let index = 0; index < sortedPoints.length; index += 1) {
      const point = sortedPoints[index];
      if (point.usageDate < targetFromDate || point.usageDate > targetToDate) continue;
      const historicalValues = sortedPoints
        .slice(0, index)
        .map((entry) => entry.cost)
        .slice(-BASELINE_WINDOW_DAYS);
      if (historicalValues.length < MIN_HISTORY_DAYS_REQUIRED) continue;
      const expectedCost = mean(historicalValues);
      const deltaCost = point.cost - expectedCost;
      if (deltaCost <= 0) continue;
      const deltaPercent = expectedCost > 0 ? deltaCost / expectedCost : 0;
      if (deltaCost < MINIMUM_ABSOLUTE_DELTA || deltaPercent < MINIMUM_PERCENTAGE_DELTA) continue;
      const anomalyType: S3CostSpikeAnomalyType = "S3_OVERALL_COST_SPIKE";
      candidates.push({
        usageDate: point.usageDate,
        anomalyType,
        actualCost: point.cost,
        expectedCost,
        deltaCost,
        deltaPercent,
        historyCount: historicalValues.length,
        severity: mapSeverity(deltaPercent),
        recommendation: toRecommendation(anomalyType),
        description: `${toDescription(anomalyType, deltaPercent)} in ${toRegionLabel(point.regionName)}.`,
        usageType: point.usageType,
        subAccountKey: point.subAccountKey,
        subAccountId: point.subAccountId,
        subAccountName: point.subAccountName,
        accountId: point.accountId,
        bucketName: point.bucketName,
        regionKey: point.regionKey,
        regionName: point.regionName,
        sourceTable: "s3_cost_daily",
      });
    }
  }

  const storageByStream = new Map<string, S3DailyStorageBytesPoint[]>();
  for (const point of storagePoints) {
    const streamKey = [point.subAccountId ?? "unknown_account", point.regionKey ?? "global_unknown", "storage_growth"].join("|");
    const stream = storageByStream.get(streamKey) ?? [];
    stream.push(point);
    storageByStream.set(streamKey, stream);
  }

  for (const streamPoints of storageByStream.values()) {
    const sortedStoragePoints = [...streamPoints].sort((a, b) => a.usageDate.localeCompare(b.usageDate));
    for (let index = 0; index < sortedStoragePoints.length; index += 1) {
      const point = sortedStoragePoints[index];
      if (point.usageDate < targetFromDate || point.usageDate > targetToDate) continue;

      const historicalBytes = sortedStoragePoints
        .slice(0, index)
        .map((entry) => entry.storageBytes)
        .slice(-BASELINE_WINDOW_DAYS);

      if (historicalBytes.length < MIN_HISTORY_DAYS_REQUIRED) continue;

      const expectedBytes = mean(historicalBytes);
      if (expectedBytes <= 0) continue;

      const deltaBytes = point.storageBytes - expectedBytes;
      if (deltaBytes <= 0) continue;

      const deltaPercent = deltaBytes / expectedBytes;
      const deltaGib = bytesToGib(deltaBytes);
      if (deltaPercent < STORAGE_GROWTH_MIN_PERCENTAGE_DELTA || deltaGib < STORAGE_GROWTH_MIN_ABSOLUTE_GIB_DELTA) {
        continue;
      }

      const estimatedImpact = deltaGib * STORAGE_GIB_TO_ESTIMATED_MONTHLY_USD;
      candidates.push({
        usageDate: point.usageDate,
        anomalyType: "S3_STORAGE_GROWTH_ANOMALY",
        actualCost: estimatedImpact,
        expectedCost: bytesToGib(expectedBytes) * STORAGE_GIB_TO_ESTIMATED_MONTHLY_USD,
        deltaCost: estimatedImpact - bytesToGib(expectedBytes) * STORAGE_GIB_TO_ESTIMATED_MONTHLY_USD,
        deltaPercent,
        historyCount: historicalBytes.length,
        severity: mapSeverity(deltaPercent),
        recommendation: toRecommendation("S3_STORAGE_GROWTH_ANOMALY"),
        description: `${toDescription("S3_STORAGE_GROWTH_ANOMALY", deltaPercent)} in ${toRegionLabel(point.regionName)}.`,
        usageType: "storage_bytes",
        subAccountKey: point.subAccountKey,
        subAccountId: point.subAccountId,
        subAccountName: point.subAccountName,
        accountId: null,
        bucketName: null,
        regionKey: point.regionKey,
        regionName: point.regionName,
        sourceTable: "s3_storage_lens_daily",
      });

      const historicalObjectCounts = sortedStoragePoints
        .slice(0, index)
        .map((entry) => entry.objectCount)
        .slice(-BASELINE_WINDOW_DAYS);
      if (historicalObjectCounts.length >= MIN_HISTORY_DAYS_REQUIRED) {
        const expectedObjectCount = mean(historicalObjectCounts);
        if (expectedObjectCount > 0) {
          const objectDelta = point.objectCount - expectedObjectCount;
          const objectDeltaPercent = objectDelta / expectedObjectCount;
          if (
            objectDelta >= OBJECT_COUNT_MIN_ABSOLUTE_DELTA &&
            objectDeltaPercent >= OBJECT_COUNT_MIN_PERCENTAGE_DELTA
          ) {
            const anomalyType: S3CostSpikeAnomalyType = "S3_OBJECT_COUNT_EXPLOSION";
            candidates.push({
              usageDate: point.usageDate,
              anomalyType,
              actualCost: Math.max(0.05, point.storageBytes / (1024 ** 3) * STORAGE_GIB_TO_ESTIMATED_MONTHLY_USD),
              expectedCost: Math.max(0.01, expectedObjectCount / 1_000_000),
              deltaCost: Math.max(0.01, objectDelta / 1_000_000),
              deltaPercent: objectDeltaPercent,
              historyCount: historicalObjectCounts.length,
              severity: mapSeverity(objectDeltaPercent),
              recommendation: toRecommendation(anomalyType),
              description: `${toDescription(anomalyType, objectDeltaPercent)} in ${toRegionLabel(point.regionName)}.`,
              usageType: "object_count",
              subAccountKey: point.subAccountKey,
              subAccountId: point.subAccountId,
              subAccountName: point.subAccountName,
              accountId: null,
              bucketName: null,
              regionKey: point.regionKey,
              regionName: point.regionName,
              sourceTable: "s3_storage_lens_daily",
            });
          }
        }
      }

      if (point.multipartBytes > 0 && point.storageBytes > 0) {
        const multipartGib = bytesToGib(point.multipartBytes);
        const multipartRatio = point.multipartBytes / point.storageBytes;
        if (multipartGib >= MULTIPART_WASTE_MIN_GIB && multipartRatio >= MULTIPART_WASTE_MIN_PERCENT_OF_TOTAL) {
          const anomalyType: S3CostSpikeAnomalyType = "S3_MULTIPART_UPLOAD_WASTE";
          const monthlyWasteCost = multipartGib * STORAGE_GIB_TO_ESTIMATED_MONTHLY_USD;
          candidates.push({
            usageDate: point.usageDate,
            anomalyType,
            actualCost: monthlyWasteCost,
            expectedCost: 0,
            deltaCost: monthlyWasteCost,
            deltaPercent: multipartRatio,
            historyCount: historicalBytes.length,
            severity: mapSeverity(multipartRatio),
            recommendation: toRecommendation(anomalyType),
            description: `${toDescription(anomalyType, multipartRatio)} in ${toRegionLabel(point.regionName)}.`,
            usageType: "incomplete_multipart_upload_bytes",
            subAccountKey: point.subAccountKey,
            subAccountId: point.subAccountId,
            subAccountName: point.subAccountName,
            accountId: null,
            bucketName: null,
            regionKey: point.regionKey,
            regionName: point.regionName,
            sourceTable: "s3_storage_lens_daily",
          });
        }
      }
    }
  }

  const publicRiskRows = await fetchPublicAccessRiskRows({
    billingSourceId,
    tenantId,
    dateFrom: targetFromDate,
    dateTo: targetToDate,
  });
  for (const row of publicRiskRows) {
    if (row.riskyBucketCount <= 0) continue;
    const anomalyType: S3CostSpikeAnomalyType = "S3_PUBLIC_ACCESS_RISK";
    candidates.push({
      usageDate: row.usageDate,
      anomalyType,
      actualCost: PUBLIC_ACCESS_RISK_IMPACT_COST * row.riskyBucketCount,
      expectedCost: 0,
      deltaCost: PUBLIC_ACCESS_RISK_IMPACT_COST * row.riskyBucketCount,
      deltaPercent: 1,
      historyCount: 1,
      severity: row.riskyBucketCount > 2 ? "high" : "medium",
      recommendation: toRecommendation(anomalyType),
      description: `${toDescription(anomalyType, 1)} (${row.riskyBucketCount} risky bucket${row.riskyBucketCount > 1 ? "s" : ""}).`,
      usageType: "public_access_config",
      subAccountKey: null,
      subAccountId: row.subAccountId,
      subAccountName: null,
      accountId: row.subAccountId,
      bucketName: null,
      regionKey: null,
      regionName: row.regionName,
      sourceTable: "s3_bucket_config_snapshot",
    });
  }

  const mergedByAnomalyKey = new Map<string, S3CostSpikeCandidate>();
  for (const candidate of candidates) {
    const anomalyKey = [
      candidate.subAccountId ?? "unknown_account",
      "amazon_s3",
      candidate.regionKey ?? "global_unknown",
      candidate.anomalyType,
      candidate.usageDate,
    ].join("|");
    const existing = mergedByAnomalyKey.get(anomalyKey);
    if (!existing) {
      mergedByAnomalyKey.set(anomalyKey, { ...candidate });
      continue;
    }

    const mergedDeltaCost = existing.deltaCost + candidate.deltaCost;
    const mergedExpectedCost = existing.expectedCost + candidate.expectedCost;
    const mergedActualCost = existing.actualCost + candidate.actualCost;
    const mergedDeltaPercent =
      mergedExpectedCost > 0 ? mergedDeltaCost / mergedExpectedCost : Math.max(existing.deltaPercent, candidate.deltaPercent);
    const mergedSeverity = severityRank(candidate.severity) > severityRank(existing.severity) ? candidate.severity : existing.severity;
    const usageTypeSet = Array.from(
      new Set(
        [existing.usageType, candidate.usageType]
          .map((value) => String(value ?? "").trim())
          .filter((value) => value.length > 0),
      ),
    );

    mergedByAnomalyKey.set(anomalyKey, {
      ...existing,
      expectedCost: mergedExpectedCost,
      actualCost: mergedActualCost,
      deltaCost: mergedDeltaCost,
      deltaPercent: mergedDeltaPercent,
      historyCount: Math.max(existing.historyCount, candidate.historyCount),
      severity: mergedSeverity,
      usageType: usageTypeSet.join(", "),
      description: `${toDescription(existing.anomalyType, mergedDeltaPercent)} in ${toRegionLabel(existing.regionName)}.`,
    });
  }

  return {
    billingSourceId,
    effectiveDateFrom: effectiveWindow.dateFrom,
    effectiveDateTo: effectiveWindow.dateTo,
    historyWindowStart: formatDateOnlyUtc(historyStart),
    historyWindowEnd: formatDateOnlyUtc(targetTo),
    defaultedDateWindow: effectiveWindow.defaulted,
    observedDaysInWindow,
    evaluatedDays,
    candidates: Array.from(mergedByAnomalyKey.values()).filter((candidate) =>
      GLOBAL_S3_ANOMALY_TYPES.has(candidate.anomalyType),
    ),
    guardrails: {
      historyDaysRequired: MIN_HISTORY_DAYS_REQUIRED,
      minimumExpectedBaseline: MINIMUM_EXPECTED_BASELINE,
      minimumAbsoluteDelta: MINIMUM_ABSOLUTE_DELTA,
      minimumPercentageDelta: MINIMUM_PERCENTAGE_DELTA,
    },
  };
}
