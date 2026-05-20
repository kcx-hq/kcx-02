import { QueryTypes } from "sequelize";

import { sequelize } from "../../../../models/index.js";

type S3DailyCategoryPoint = {
  usageDate: string;
  costCategory: "Storage" | "Transfer" | "Request";
  cost: number;
  bucketName: string | null;
  subAccountKey: string | null;
  regionKey: string | null;
};

export type S3CostSpikeAnomalyType =
  | "S3 Storage Cost Spike"
  | "S3 Data Transfer Spike"
  | "S3 Request Cost Spike"
  | "S3 Storage Growth Anomaly";

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
  bucketName: string | null;
  subAccountKey: string | null;
  regionKey: string | null;
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

const toAnomalyType = (category: S3DailyCategoryPoint["costCategory"]): S3CostSpikeAnomalyType => {
  if (category === "Storage") return "S3 Storage Cost Spike";
  if (category === "Transfer") return "S3 Data Transfer Spike";
  return "S3 Request Cost Spike";
};

const toRecommendation = (anomalyType: S3CostSpikeAnomalyType): string => {
  if (anomalyType === "S3 Storage Cost Spike") {
    return "Review recent uploads, lifecycle policies, and bucket growth patterns.";
  }
  if (anomalyType === "S3 Data Transfer Spike") {
    return "Investigate internet egress paths, CDN behavior, and public/object download access.";
  }
  if (anomalyType === "S3 Storage Growth Anomaly") {
    return "Review recent uploads, retention rules, and lifecycle transitions for rapid bucket-size growth.";
  }
  return "Check for retry loops, high-frequency scans, and application request storms.";
};

const toDescription = (anomalyType: S3CostSpikeAnomalyType, deltaPercent: number): string => {
  void deltaPercent;
  if (anomalyType === "S3 Storage Cost Spike") {
    return "S3 storage cost increased compared to normal daily usage.";
  }
  if (anomalyType === "S3 Data Transfer Spike") {
    return "Unexpected increase in S3 internet egress traffic detected.";
  }
  if (anomalyType === "S3 Storage Growth Anomaly") {
    return "Bucket size grew abnormally fast.";
  }
  return "S3 API request charges significantly exceeded baseline usage.";
};

type S3DailyStorageBytesPoint = {
  usageDate: string;
  storageBytes: number;
  bucketName: string | null;
  subAccountKey: string | null;
  regionKey: string | null;
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
    cost_category: "Storage" | "Transfer" | "Request";
    total_cost: string;
    bucket_name: string | null;
    sub_account_key: string | null;
    region_key: string | null;
  }>(
    `
      SELECT
        scd.usage_date::text AS usage_date,
        CASE
          WHEN LOWER(COALESCE(scd.cost_category, '')) = 'storage' THEN 'Storage'
          WHEN LOWER(COALESCE(scd.cost_category, '')) = 'transfer' THEN 'Transfer'
          WHEN LOWER(COALESCE(scd.cost_category, '')) = 'request' THEN 'Request'
          ELSE NULL
        END AS cost_category,
        COALESCE(SUM(COALESCE(scd.total_cost, 0)), 0)::text AS total_cost,
        MIN(scd.bucket_name)::text AS bucket_name,
        MIN(scd.sub_account_key)::text AS sub_account_key,
        MIN(scd.region_key)::text AS region_key
      FROM s3_cost_daily scd
      WHERE scd.billing_source_id = CAST(:billingSourceId AS BIGINT)
        AND (:tenantId IS NULL OR scd.tenant_id = CAST(:tenantId AS UUID))
        AND scd.usage_date BETWEEN :dateFrom AND :dateTo
      GROUP BY scd.usage_date, cost_category
      HAVING
        CASE
          WHEN LOWER(COALESCE(scd.cost_category, '')) = 'storage' THEN 'Storage'
          WHEN LOWER(COALESCE(scd.cost_category, '')) = 'transfer' THEN 'Transfer'
          WHEN LOWER(COALESCE(scd.cost_category, '')) = 'request' THEN 'Request'
          ELSE NULL
        END IS NOT NULL
      ORDER BY scd.usage_date ASC
    `,
    {
      replacements: { billingSourceId, tenantId, dateFrom, dateTo },
      type: QueryTypes.SELECT,
    },
  );

  return rows.map((row) => ({
    usageDate: row.usage_date,
    costCategory: row.cost_category,
    cost: Number(row.total_cost ?? 0),
    bucketName: row.bucket_name,
    subAccountKey: row.sub_account_key,
    regionKey: row.region_key,
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
    bucket_name: string | null;
    sub_account_key: string | null;
    region_key: string | null;
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
        MIN(sld.bucket_name)::text AS bucket_name,
        MIN(sld.sub_account_key)::text AS sub_account_key,
        MIN(sld.region_key)::text AS region_key
      FROM s3_storage_lens_daily sld
      WHERE sld.billing_source_id = CAST(:billingSourceId AS BIGINT)
        AND (:tenantId IS NULL OR sld.tenant_id = CAST(:tenantId AS UUID))
        AND sld.usage_date BETWEEN :dateFrom AND :dateTo
      GROUP BY sld.usage_date
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
    bucketName: row.bucket_name,
    subAccountKey: row.sub_account_key,
    regionKey: row.region_key,
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

  const pointsByCategory = new Map<S3DailyCategoryPoint["costCategory"], S3DailyCategoryPoint[]>();
  for (const point of points) {
    const bucket = pointsByCategory.get(point.costCategory) ?? [];
    bucket.push(point);
    pointsByCategory.set(point.costCategory, bucket);
  }

  const candidates: S3CostSpikeCandidate[] = [];
  let observedDaysInWindow = 0;
  let evaluatedDays = 0;
  const targetFromDate = formatDateOnlyUtc(targetFrom);
  const targetToDate = formatDateOnlyUtc(targetTo);

  for (const [category, categoryPoints] of pointsByCategory.entries()) {
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
            description: toDescription(anomalyType, 1),
            bucketName: point.bucketName,
            subAccountKey: point.subAccountKey,
            regionKey: point.regionKey,
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
        description: toDescription(anomalyType, deltaPercent),
        bucketName: point.bucketName,
        subAccountKey: point.subAccountKey,
        regionKey: point.regionKey,
      });
    }
  }

  const sortedStoragePoints = [...storagePoints].sort((a, b) => a.usageDate.localeCompare(b.usageDate));
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
      anomalyType: "S3 Storage Growth Anomaly",
      actualCost: estimatedImpact,
      expectedCost: bytesToGib(expectedBytes) * STORAGE_GIB_TO_ESTIMATED_MONTHLY_USD,
      deltaCost: estimatedImpact - bytesToGib(expectedBytes) * STORAGE_GIB_TO_ESTIMATED_MONTHLY_USD,
      deltaPercent,
      historyCount: historicalBytes.length,
      severity: mapSeverity(deltaPercent),
      recommendation: toRecommendation("S3 Storage Growth Anomaly"),
      description: toDescription("S3 Storage Growth Anomaly", deltaPercent),
      bucketName: point.bucketName,
      subAccountKey: point.subAccountKey,
      regionKey: point.regionKey,
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
    candidates,
    guardrails: {
      historyDaysRequired: MIN_HISTORY_DAYS_REQUIRED,
      minimumExpectedBaseline: MINIMUM_EXPECTED_BASELINE,
      minimumAbsoluteDelta: MINIMUM_ABSOLUTE_DELTA,
      minimumPercentageDelta: MINIMUM_PERCENTAGE_DELTA,
    },
  };
}
