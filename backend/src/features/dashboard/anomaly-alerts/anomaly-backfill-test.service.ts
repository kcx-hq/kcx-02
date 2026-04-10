import { QueryTypes } from "sequelize";

import { BadRequestError, NotFoundError } from "../../../errors/http-errors.js";
import {
  BillingIngestionRun,
  BillingSource,
  CloudConnectionV2,
  RawBillingFile,
  sequelize,
} from "../../../models/index.js";
import { upsertCostAggregationsForRun } from "../../billing/services/cost-aggregation.service.js";
import { ingestionOrchestrator } from "../../billing/services/ingestion-orchestrator.service.js";
import {
  manuallyIngestFile,
  manuallyIngestLatestFile,
} from "../../cloud-connections/aws/exports/aws-export-ingestion.service.js";
import { runAnomalyDetectorsForDate } from "./anomaly.engine.js";

type AggregateInspectionRow = {
  usageDate: string;
  serviceKey: string;
  subAccountKey: string;
  regionKey: string;
  effectiveCost: number;
  billedCost: number;
  usageQuantity: number;
};

type SyntheticSpikeSnapshot = {
  usageDate: string;
  billingPeriodStartDate: string;
  tenantId: string;
  billingSourceId: string | null;
  serviceKey: string;
  subAccountKey: string;
  regionKey: string;
  currencyCode: string;
  priorWindowDays: number;
  syntheticBaselineUsageDates: string[];
  originalEffectiveCost: number;
  originalBilledCost: number;
  originalListCost: number;
  patchedEffectiveCost: number;
  patchedBilledCost: number;
  patchedListCost: number;
  prior7DayAverageEffectiveCost: number;
};

type VerifiedAnomalyRow = {
  id: string;
  usageDate: string;
  anomalyType: string;
  expectedCost: number;
  actualCost: number;
  deltaCost: number;
  deltaPercent: number;
  severity: string;
  fingerprint: string;
};

type RunAnomalyBackfillTestInput = {
  tenantId: string;
  connectionId?: string;
  fileKey?: string;
  ingestionRunId?: string;
  billingSourceId?: string;
  from?: string;
  to?: string;
  syntheticIfNoAnomaly?: boolean;
  runCleanup?: boolean;
};

type RunAnomalyBackfillTestResult = {
  ingestion: {
    mode: "connection-manual-ingest" | "existing-run" | "latest-completed-run";
    ingestionRunId: string | null;
    rowsIngested: number;
    aggregateRowsProduced: number;
  };
  dateCoverage: {
    from: string | null;
    to: string | null;
    dates: string[];
  };
  realDataDetectorRun: {
    anomaliesInserted: number;
    duplicatesSkipped: number;
  };
  naturalAnomalies: VerifiedAnomalyRow[];
  syntheticSpike: {
    applied: boolean;
    snapshot: SyntheticSpikeSnapshot | null;
    anomaliesAfterPatch: VerifiedAnomalyRow[];
    dedupeSecondRunInserted: number;
  };
};

type DbRunRow = {
  id: string;
  status: string;
  rows_loaded: number;
  billing_source_id: string;
  raw_billing_file_id: string;
  tenant_id: string;
  cloud_provider_id: string;
  uploaded_by: string | null;
};

type AggregateDateRow = {
  usage_date: string;
};

type AggregateInspectionDbRow = {
  usage_date: string;
  service_key: string;
  sub_account_key: string;
  region_key: string;
  effective_cost: number | string;
  billed_cost: number | string;
  usage_quantity: number | string;
};

type CandidateScopeRow = {
  usage_date: string;
  billing_period_start_date?: string;
  billing_source_id: string | null;
  service_key: string;
  sub_account_key: string;
  region_key: string;
  currency_code: string;
  effective_cost: number | string;
  billed_cost: number | string;
  list_cost: number | string;
  scope_days?: number | string;
};

type AnomalyDbRow = {
  id: string;
  usage_date: string;
  anomaly_type: string;
  expected_cost: number | string;
  actual_cost: number | string;
  delta_cost: number | string;
  delta_percent: number | string;
  severity: string;
  fingerprint: string;
};

const COMPLETED_STATUSES = ["completed", "completed_with_warnings"];

const toFiniteNumber = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const uniqueSortedDates = (dates: string[]): string[] => [...new Set(dates)].sort((a, b) => a.localeCompare(b));

const assertTenantId = (tenantId: string): string => {
  const normalized = String(tenantId ?? "").trim();
  if (!normalized) {
    throw new BadRequestError("tenantId is required");
  }
  return normalized;
};

const ensureCompletedRunOrThrow = async (ingestionRunId: string): Promise<DbRunRow> => {
  const rows = await sequelize.query<DbRunRow>(
    `
SELECT
  bir.id::text AS id,
  bir.status,
  bir.rows_loaded,
  bir.billing_source_id::text AS billing_source_id,
  bir.raw_billing_file_id::text AS raw_billing_file_id,
  rbf.tenant_id,
  rbf.cloud_provider_id::text AS cloud_provider_id,
  rbf.uploaded_by::text AS uploaded_by
FROM billing_ingestion_runs bir
JOIN raw_billing_files rbf ON rbf.id = bir.raw_billing_file_id
WHERE bir.id = :ingestionRunId::bigint
LIMIT 1
`,
    {
      replacements: { ingestionRunId },
      type: QueryTypes.SELECT,
    },
  );

  const run = rows[0];
  if (!run) {
    throw new NotFoundError(`Billing ingestion run not found: ${ingestionRunId}`);
  }

  if (!COMPLETED_STATUSES.includes(String(run.status))) {
    await ingestionOrchestrator.processIngestionRun(ingestionRunId);
  }

  const refreshed = await sequelize.query<DbRunRow>(
    `
SELECT
  bir.id::text AS id,
  bir.status,
  bir.rows_loaded,
  bir.billing_source_id::text AS billing_source_id,
  bir.raw_billing_file_id::text AS raw_billing_file_id,
  rbf.tenant_id,
  rbf.cloud_provider_id::text AS cloud_provider_id,
  rbf.uploaded_by::text AS uploaded_by
FROM billing_ingestion_runs bir
JOIN raw_billing_files rbf ON rbf.id = bir.raw_billing_file_id
WHERE bir.id = :ingestionRunId::bigint
LIMIT 1
`,
    {
      replacements: { ingestionRunId },
      type: QueryTypes.SELECT,
    },
  );

  const finalRun = refreshed[0];
  if (!finalRun) {
    throw new NotFoundError(`Billing ingestion run not found after processing: ${ingestionRunId}`);
  }
  if (!COMPLETED_STATUSES.includes(String(finalRun.status))) {
    throw new BadRequestError(`Ingestion run ${ingestionRunId} did not complete successfully (status: ${finalRun.status})`);
  }
  return finalRun;
};

const findLatestCompletedRun = async (input: {
  tenantId: string;
  billingSourceId?: string;
}): Promise<DbRunRow | null> => {
  const whereClauses = ["rbf.tenant_id = :tenantId", "bir.status IN ('completed', 'completed_with_warnings')"];
  const replacements: Record<string, string> = { tenantId: input.tenantId };
  if (input.billingSourceId) {
    whereClauses.push("bir.billing_source_id = :billingSourceId::bigint");
    replacements.billingSourceId = input.billingSourceId;
  }

  const rows = await sequelize.query<DbRunRow>(
    `
SELECT
  bir.id::text AS id,
  bir.status,
  bir.rows_loaded,
  bir.billing_source_id::text AS billing_source_id,
  bir.raw_billing_file_id::text AS raw_billing_file_id,
  rbf.tenant_id,
  rbf.cloud_provider_id::text AS cloud_provider_id,
  rbf.uploaded_by::text AS uploaded_by
FROM billing_ingestion_runs bir
JOIN raw_billing_files rbf ON rbf.id = bir.raw_billing_file_id
WHERE ${whereClauses.join(" AND ")}
ORDER BY bir.id DESC
LIMIT 1
`,
    {
      replacements,
      type: QueryTypes.SELECT,
    },
  );
  return rows[0] ?? null;
};

const ensureAggregationsForRun = async (run: DbRunRow): Promise<number> => {
  const beforeRows = await sequelize.query<{ row_count: number | string }>(
    `
SELECT COUNT(*)::bigint AS row_count
FROM agg_cost_daily
WHERE ingestion_run_id = :ingestionRunId::bigint
`,
    {
      replacements: { ingestionRunId: run.id },
      type: QueryTypes.SELECT,
    },
  );
  const beforeCount = toFiniteNumber(beforeRows[0]?.row_count);
  if (beforeCount > 0) {
    return beforeCount;
  }

  const rowsLoaded = toFiniteNumber(run.rows_loaded);
  if (rowsLoaded <= 0) {
    return 0;
  }

  await upsertCostAggregationsForRun({
    ingestionRunId: run.id,
    tenantId: run.tenant_id,
    providerId: run.cloud_provider_id,
    billingSourceId: run.billing_source_id,
    uploadedBy: run.uploaded_by,
  });

  const afterRows = await sequelize.query<{ row_count: number | string }>(
    `
SELECT COUNT(*)::bigint AS row_count
FROM agg_cost_daily
WHERE ingestion_run_id = :ingestionRunId::bigint
`,
    {
      replacements: { ingestionRunId: run.id },
      type: QueryTypes.SELECT,
    },
  );
  return toFiniteNumber(afterRows[0]?.row_count);
};

export async function inspectAggCostDailyForRange(input: {
  tenantId: string;
  from: string;
  to: string;
  billingSourceId?: string;
  limit?: number;
}): Promise<AggregateInspectionRow[]> {
  const whereClauses = [
    "acd.tenant_id = :tenantId",
    "acd.usage_date >= :from::date",
    "acd.usage_date <= :to::date",
  ];
  const replacements: Record<string, string | number> = {
    tenantId: input.tenantId,
    from: input.from,
    to: input.to,
    limit: input.limit ?? 500,
  };

  if (input.billingSourceId) {
    whereClauses.push("acd.billing_source_id = :billingSourceId::bigint");
    replacements.billingSourceId = input.billingSourceId;
  }

  const rows = await sequelize.query<AggregateInspectionDbRow>(
    `
SELECT
  acd.usage_date::text,
  acd.service_key::text,
  acd.sub_account_key::text,
  acd.region_key::text,
  acd.effective_cost,
  acd.billed_cost,
  acd.usage_quantity
FROM agg_cost_daily acd
WHERE ${whereClauses.join(" AND ")}
ORDER BY acd.usage_date ASC, acd.effective_cost DESC
LIMIT :limit
`,
    {
      replacements,
      type: QueryTypes.SELECT,
    },
  );

  return rows.map((row) => ({
    usageDate: row.usage_date,
    serviceKey: row.service_key,
    subAccountKey: row.sub_account_key,
    regionKey: row.region_key,
    effectiveCost: toFiniteNumber(row.effective_cost),
    billedCost: toFiniteNumber(row.billed_cost),
    usageQuantity: toFiniteNumber(row.usage_quantity),
  }));
}

const getAggregateDatesForRun = async (input: {
  tenantId: string;
  ingestionRunId?: string;
  billingSourceId?: string;
  from?: string;
  to?: string;
}): Promise<string[]> => {
  const whereClauses = ["acd.tenant_id = :tenantId"];
  const replacements: Record<string, string> = { tenantId: input.tenantId };

  if (input.ingestionRunId) {
    whereClauses.push("acd.ingestion_run_id = :ingestionRunId::bigint");
    replacements.ingestionRunId = input.ingestionRunId;
  } else if (input.billingSourceId) {
    whereClauses.push("acd.billing_source_id = :billingSourceId::bigint");
    replacements.billingSourceId = input.billingSourceId;
  }
  if (input.from) {
    whereClauses.push("acd.usage_date >= :from::date");
    replacements.from = input.from;
  }
  if (input.to) {
    whereClauses.push("acd.usage_date <= :to::date");
    replacements.to = input.to;
  }

  const rows = await sequelize.query<AggregateDateRow>(
    `
SELECT DISTINCT acd.usage_date::text AS usage_date
FROM agg_cost_daily acd
WHERE ${whereClauses.join(" AND ")}
ORDER BY usage_date ASC
`,
    {
      replacements,
      type: QueryTypes.SELECT,
    },
  );

  return rows.map((row) => row.usage_date);
};

const runDetectorsForDates = async (
  dates: string[],
  options?: { fallbackCloudConnectionId?: string },
): Promise<{ anomaliesInserted: number; duplicatesSkipped: number }> => {
  let anomaliesInserted = 0;
  let duplicatesSkipped = 0;
  for (const usageDate of dates) {
    const summary = await runAnomalyDetectorsForDate(usageDate, options);
    anomaliesInserted += summary.anomaliesInserted;
    duplicatesSkipped += summary.duplicatesSkipped;
    console.info("[anomaly-backfill-test] detector-run", {
      usageDate,
      anomaliesInserted: summary.anomaliesInserted,
      duplicatesSkipped: summary.duplicatesSkipped,
      failures: summary.failures,
    });
  }
  return { anomaliesInserted, duplicatesSkipped };
};

export async function verifyDetectedAnomalies(input: {
  tenantId: string;
  from: string;
  to: string;
}): Promise<VerifiedAnomalyRow[]> {
  const rows = await sequelize.query<AnomalyDbRow>(
    `
SELECT
  fa.id::text,
  fa.usage_date::text,
  fa.anomaly_type,
  fa.expected_cost,
  fa.actual_cost,
  fa.delta_cost,
  fa.delta_percent,
  fa.severity,
  fa.fingerprint
FROM fact_anomalies fa
WHERE fa.tenant_id = :tenantId
  AND fa.usage_date >= :from::date
  AND fa.usage_date <= :to::date
ORDER BY fa.detected_at DESC
`,
    {
      replacements: {
        tenantId: input.tenantId,
        from: input.from,
        to: input.to,
      },
      type: QueryTypes.SELECT,
    },
  );

  return rows.map((row) => ({
    id: row.id,
    usageDate: row.usage_date,
    anomalyType: row.anomaly_type,
    expectedCost: toFiniteNumber(row.expected_cost),
    actualCost: toFiniteNumber(row.actual_cost),
    deltaCost: toFiniteNumber(row.delta_cost),
    deltaPercent: toFiniteNumber(row.delta_percent),
    severity: row.severity,
    fingerprint: row.fingerprint,
  }));
}

export async function createSyntheticAggregateSpikeTestData(input: {
  tenantId: string;
  billingSourceId?: string;
  from: string;
  to: string;
}): Promise<SyntheticSpikeSnapshot | null> {
  const whereClauses = [
    "acd.tenant_id = :tenantId",
    "acd.usage_date >= :from::date",
    "acd.usage_date <= :to::date",
    "acd.effective_cost > 0",
  ];
  const replacements: Record<string, string> = {
    tenantId: input.tenantId,
    from: input.from,
    to: input.to,
  };
  if (input.billingSourceId) {
    whereClauses.push("acd.billing_source_id = :billingSourceId::bigint");
    replacements.billingSourceId = input.billingSourceId;
  }

  const candidates = await sequelize.query<CandidateScopeRow>(
    `
WITH scoped AS (
  SELECT
    acd.usage_date,
    acd.billing_period_start_date,
    acd.billing_source_id::text AS billing_source_id,
    acd.service_key::text AS service_key,
    acd.sub_account_key::text AS sub_account_key,
    acd.region_key::text AS region_key,
    acd.currency_code,
    acd.effective_cost,
    acd.billed_cost,
    acd.list_cost,
    COUNT(*) OVER (
      PARTITION BY acd.tenant_id, acd.billing_source_id, acd.service_key, acd.sub_account_key, acd.region_key, acd.currency_code
    ) AS scope_days,
    ROW_NUMBER() OVER (
      PARTITION BY acd.tenant_id, acd.billing_source_id, acd.service_key, acd.sub_account_key, acd.region_key, acd.currency_code
      ORDER BY acd.usage_date
    ) AS row_seq
  FROM agg_cost_daily acd
  WHERE ${whereClauses.join(" AND ")}
)
SELECT
  usage_date::text,
  billing_period_start_date::text,
  billing_source_id,
  service_key,
  sub_account_key,
  region_key,
  currency_code,
  effective_cost,
  billed_cost,
  list_cost,
  scope_days
FROM scoped
WHERE row_seq >= 2
ORDER BY scope_days DESC, usage_date DESC, effective_cost DESC
LIMIT 1
`,
    {
      replacements,
      type: QueryTypes.SELECT,
    },
  );

  const candidate = candidates[0];
  let candidateToPatch = candidate ?? null;

  if (!candidateToPatch) {
    const coarseCandidates = await sequelize.query<CandidateScopeRow>(
      `
WITH scoped AS (
  SELECT
    acd.usage_date,
    acd.billing_period_start_date,
    acd.billing_source_id::text AS billing_source_id,
    acd.service_key::text AS service_key,
    acd.sub_account_key::text AS sub_account_key,
    acd.region_key::text AS region_key,
    acd.currency_code,
    acd.effective_cost,
    acd.billed_cost,
    acd.list_cost,
    COUNT(*) OVER (
      PARTITION BY acd.tenant_id, acd.billing_source_id, acd.currency_code
    ) AS scope_days,
    ROW_NUMBER() OVER (
      PARTITION BY acd.tenant_id, acd.billing_source_id, acd.currency_code
      ORDER BY acd.usage_date DESC, acd.effective_cost DESC
    ) AS pick_rank
  FROM agg_cost_daily acd
  WHERE ${whereClauses.join(" AND ")}
)
SELECT
  usage_date::text,
  billing_period_start_date::text,
  billing_source_id,
  service_key,
  sub_account_key,
  region_key,
  currency_code,
  effective_cost,
  billed_cost,
  list_cost,
  scope_days
FROM scoped
WHERE scope_days >= 2
  AND pick_rank = 1
ORDER BY scope_days DESC, usage_date DESC, effective_cost DESC
LIMIT 1
`,
      {
        replacements,
        type: QueryTypes.SELECT,
      },
    );

    candidateToPatch = coarseCandidates[0] ?? null;
  }

  if (!candidateToPatch) {
    const fallbackCandidates = await sequelize.query<CandidateScopeRow>(
      `
SELECT
  acd.usage_date::text AS usage_date,
  acd.billing_period_start_date::text AS billing_period_start_date,
  acd.billing_source_id::text AS billing_source_id,
  acd.service_key::text AS service_key,
  acd.sub_account_key::text AS sub_account_key,
  acd.region_key::text AS region_key,
  acd.currency_code,
  acd.effective_cost,
  acd.billed_cost,
  acd.list_cost,
  1::bigint AS scope_days
FROM agg_cost_daily acd
WHERE ${whereClauses.join(" AND ")}
ORDER BY acd.usage_date DESC, acd.effective_cost DESC
LIMIT 1
`,
      {
        replacements,
        type: QueryTypes.SELECT,
      },
    );
    candidateToPatch = fallbackCandidates[0] ?? null;
  }

  if (!candidateToPatch) {
    return null;
  }

  let priorRows = await sequelize.query<{ effective_cost: number | string }>(
    `
SELECT acd.effective_cost
FROM agg_cost_daily acd
WHERE acd.tenant_id = :tenantId
  AND acd.usage_date < :usageDate::date
  AND acd.service_key IS NOT DISTINCT FROM :serviceKey::bigint
  AND acd.sub_account_key IS NOT DISTINCT FROM :subAccountKey::bigint
  AND acd.region_key IS NOT DISTINCT FROM :regionKey::bigint
  AND acd.currency_code IS NOT DISTINCT FROM :currencyCode
  AND acd.billing_source_id IS NOT DISTINCT FROM :billingSourceId::bigint
ORDER BY acd.usage_date DESC
LIMIT 7
`,
    {
      replacements: {
        tenantId: input.tenantId,
        usageDate: candidateToPatch.usage_date,
        serviceKey: candidateToPatch.service_key,
        subAccountKey: candidateToPatch.sub_account_key,
        regionKey: candidateToPatch.region_key,
        currencyCode: candidateToPatch.currency_code,
        billingSourceId: candidateToPatch.billing_source_id,
      },
      type: QueryTypes.SELECT,
    },
  );

  if (priorRows.length < 1) {
    priorRows = await sequelize.query<{ effective_cost: number | string }>(
      `
SELECT SUM(COALESCE(acd.effective_cost, 0))::double precision AS effective_cost
FROM agg_cost_daily acd
WHERE acd.tenant_id = :tenantId
  AND acd.usage_date < :usageDate::date
  AND acd.currency_code IS NOT DISTINCT FROM :currencyCode
  AND acd.billing_source_id IS NOT DISTINCT FROM :billingSourceId::bigint
GROUP BY acd.usage_date
ORDER BY acd.usage_date DESC
LIMIT 7
`,
      {
        replacements: {
          tenantId: input.tenantId,
          usageDate: candidateToPatch.usage_date,
          currencyCode: candidateToPatch.currency_code,
          billingSourceId: candidateToPatch.billing_source_id,
        },
        type: QueryTypes.SELECT,
      },
    );
  }

  const syntheticBaselineUsageDates: string[] = [];
  if (priorRows.length < 1) {
    const baselineCost = Math.max(
      80,
      Math.min(200, toFiniteNumber(candidateToPatch.effective_cost)),
    );
    const seededRows = await sequelize.query<{ usage_date: string }>(
      `
WITH src AS (
  SELECT
    acd.tenant_id,
    acd.billing_period_start_date,
    acd.billing_source_id,
    acd.ingestion_run_id,
    acd.provider_id,
    acd.uploaded_by,
    acd.service_key,
    acd.sub_account_key,
    acd.region_key,
    acd.currency_code
  FROM agg_cost_daily acd
  WHERE acd.tenant_id = :tenantId
    AND acd.usage_date = :usageDate::date
    AND acd.service_key IS NOT DISTINCT FROM :serviceKey::bigint
    AND acd.sub_account_key IS NOT DISTINCT FROM :subAccountKey::bigint
    AND acd.region_key IS NOT DISTINCT FROM :regionKey::bigint
    AND acd.currency_code IS NOT DISTINCT FROM :currencyCode
    AND acd.billing_source_id IS NOT DISTINCT FROM :billingSourceId::bigint
  LIMIT 1
),
ins AS (
  INSERT INTO agg_cost_daily (
    usage_date,
    billing_period_start_date,
    tenant_id,
    billing_source_id,
    ingestion_run_id,
    provider_id,
    uploaded_by,
    service_key,
    sub_account_key,
    region_key,
    billed_cost,
    effective_cost,
    list_cost,
    usage_quantity,
    currency_code,
    created_at,
    updated_at
  )
  SELECT
    (:usageDate::date - (g.day_offset || ' days')::interval)::date AS usage_date,
    src.billing_period_start_date,
    src.tenant_id,
    src.billing_source_id,
    src.ingestion_run_id,
    src.provider_id,
    src.uploaded_by,
    src.service_key,
    src.sub_account_key,
    src.region_key,
    :baselineCost::numeric AS billed_cost,
    :baselineCost::numeric AS effective_cost,
    :baselineCost::numeric AS list_cost,
    1::numeric AS usage_quantity,
    src.currency_code,
    NOW(),
    NOW()
  FROM src
  CROSS JOIN generate_series(1, 7) AS g(day_offset)
  ON CONFLICT (usage_date, tenant_id, service_key, sub_account_key, region_key, currency_code, billing_period_start_date)
  DO NOTHING
  RETURNING usage_date::text
)
SELECT usage_date FROM ins
`,
      {
        replacements: {
          tenantId: input.tenantId,
          usageDate: candidateToPatch.usage_date,
          serviceKey: candidateToPatch.service_key,
          subAccountKey: candidateToPatch.sub_account_key,
          regionKey: candidateToPatch.region_key,
          currencyCode: candidateToPatch.currency_code,
          billingSourceId: candidateToPatch.billing_source_id,
          baselineCost,
        },
        type: QueryTypes.SELECT,
      },
    );

    syntheticBaselineUsageDates.push(...seededRows.map((row) => row.usage_date));

    priorRows = await sequelize.query<{ effective_cost: number | string }>(
      `
SELECT acd.effective_cost
FROM agg_cost_daily acd
WHERE acd.tenant_id = :tenantId
  AND acd.usage_date < :usageDate::date
  AND acd.service_key IS NOT DISTINCT FROM :serviceKey::bigint
  AND acd.sub_account_key IS NOT DISTINCT FROM :subAccountKey::bigint
  AND acd.region_key IS NOT DISTINCT FROM :regionKey::bigint
  AND acd.currency_code IS NOT DISTINCT FROM :currencyCode
  AND acd.billing_source_id IS NOT DISTINCT FROM :billingSourceId::bigint
ORDER BY acd.usage_date DESC
LIMIT 7
`,
      {
        replacements: {
          tenantId: input.tenantId,
          usageDate: candidateToPatch.usage_date,
          serviceKey: candidateToPatch.service_key,
          subAccountKey: candidateToPatch.sub_account_key,
          regionKey: candidateToPatch.region_key,
          currencyCode: candidateToPatch.currency_code,
          billingSourceId: candidateToPatch.billing_source_id,
        },
        type: QueryTypes.SELECT,
      },
    );
  }

  if (priorRows.length < 1) {
    return null;
  }

  const average = priorRows.reduce((sum, row) => sum + toFiniteNumber(row.effective_cost), 0) / priorRows.length;
  // Ensure synthetic spike clears strict detector thresholds even on sparse datasets.
  const patchedEffectiveCost = Math.max(
    average * 3,
    average + 150,
    toFiniteNumber(candidateToPatch.effective_cost) + 150,
  );
  const originalEffectiveCost = toFiniteNumber(candidateToPatch.effective_cost);
  const originalBilledCost = toFiniteNumber(candidateToPatch.billed_cost);
  const originalListCost = toFiniteNumber(candidateToPatch.list_cost);
  const patchedBilledCost = Math.max(originalBilledCost, patchedEffectiveCost);
  const patchedListCost = Math.max(originalListCost, patchedEffectiveCost);

  await sequelize.query(
    `
UPDATE agg_cost_daily
SET
  effective_cost = :patchedEffectiveCost,
  billed_cost = :patchedBilledCost,
  list_cost = :patchedListCost,
  updated_at = NOW()
WHERE tenant_id = :tenantId
  AND usage_date = :usageDate::date
  AND service_key IS NOT DISTINCT FROM :serviceKey::bigint
  AND sub_account_key IS NOT DISTINCT FROM :subAccountKey::bigint
  AND region_key IS NOT DISTINCT FROM :regionKey::bigint
  AND currency_code IS NOT DISTINCT FROM :currencyCode
  AND billing_source_id IS NOT DISTINCT FROM :billingSourceId::bigint
`,
    {
      replacements: {
        tenantId: input.tenantId,
        usageDate: candidateToPatch.usage_date,
        serviceKey: candidateToPatch.service_key,
        subAccountKey: candidateToPatch.sub_account_key,
        regionKey: candidateToPatch.region_key,
        currencyCode: candidateToPatch.currency_code,
        billingSourceId: candidateToPatch.billing_source_id,
        patchedEffectiveCost,
        patchedBilledCost,
        patchedListCost,
      },
      type: QueryTypes.UPDATE,
    },
  );

  return {
    usageDate: candidateToPatch.usage_date,
    billingPeriodStartDate: String(candidateToPatch.billing_period_start_date ?? candidateToPatch.usage_date),
    tenantId: input.tenantId,
    billingSourceId: candidateToPatch.billing_source_id,
    serviceKey: candidateToPatch.service_key,
    subAccountKey: candidateToPatch.sub_account_key,
    regionKey: candidateToPatch.region_key,
    currencyCode: candidateToPatch.currency_code,
    priorWindowDays: priorRows.length,
    syntheticBaselineUsageDates,
    originalEffectiveCost,
    originalBilledCost,
    originalListCost,
    patchedEffectiveCost,
    patchedBilledCost,
    patchedListCost,
    prior7DayAverageEffectiveCost: average,
  };
}

export async function cleanupSyntheticAggregateSpikeTestData(input: {
  snapshot: SyntheticSpikeSnapshot;
  anomalyIdsToDelete?: string[];
}): Promise<void> {
  const { snapshot } = input;

  await sequelize.query(
    `
UPDATE agg_cost_daily
SET
  effective_cost = :originalEffectiveCost,
  billed_cost = :originalBilledCost,
  list_cost = :originalListCost,
  updated_at = NOW()
WHERE tenant_id = :tenantId
  AND usage_date = :usageDate::date
  AND service_key IS NOT DISTINCT FROM :serviceKey::bigint
  AND sub_account_key IS NOT DISTINCT FROM :subAccountKey::bigint
  AND region_key IS NOT DISTINCT FROM :regionKey::bigint
  AND currency_code IS NOT DISTINCT FROM :currencyCode
  AND billing_source_id IS NOT DISTINCT FROM :billingSourceId::bigint
`,
    {
      replacements: {
        tenantId: snapshot.tenantId,
        usageDate: snapshot.usageDate,
        serviceKey: snapshot.serviceKey,
        subAccountKey: snapshot.subAccountKey,
        regionKey: snapshot.regionKey,
        currencyCode: snapshot.currencyCode,
        billingSourceId: snapshot.billingSourceId,
        originalEffectiveCost: snapshot.originalEffectiveCost,
        originalBilledCost: snapshot.originalBilledCost,
        originalListCost: snapshot.originalListCost,
      },
      type: QueryTypes.UPDATE,
    },
  );

  if (snapshot.syntheticBaselineUsageDates.length > 0) {
    await sequelize.query(
      `
DELETE FROM agg_cost_daily
WHERE tenant_id = :tenantId
  AND usage_date::text = ANY(:usageDates)
  AND service_key IS NOT DISTINCT FROM :serviceKey::bigint
  AND sub_account_key IS NOT DISTINCT FROM :subAccountKey::bigint
  AND region_key IS NOT DISTINCT FROM :regionKey::bigint
  AND currency_code IS NOT DISTINCT FROM :currencyCode
  AND billing_source_id IS NOT DISTINCT FROM :billingSourceId::bigint
`,
      {
        replacements: {
          tenantId: snapshot.tenantId,
          usageDates: snapshot.syntheticBaselineUsageDates,
          serviceKey: snapshot.serviceKey,
          subAccountKey: snapshot.subAccountKey,
          regionKey: snapshot.regionKey,
          currencyCode: snapshot.currencyCode,
          billingSourceId: snapshot.billingSourceId,
        },
        type: QueryTypes.DELETE,
      },
    );
  }

  if (Array.isArray(input.anomalyIdsToDelete) && input.anomalyIdsToDelete.length > 0) {
    await sequelize.query(
      `
DELETE FROM fact_anomalies
WHERE tenant_id = :tenantId
  AND id::text = ANY(:anomalyIds)
`,
      {
        replacements: {
          tenantId: snapshot.tenantId,
          anomalyIds: input.anomalyIdsToDelete,
        },
        type: QueryTypes.DELETE,
      },
    );
  }
}

export async function runAnomalyBackfillTest(input: RunAnomalyBackfillTestInput): Promise<RunAnomalyBackfillTestResult> {
  const tenantId = assertTenantId(input.tenantId);
  let mode: RunAnomalyBackfillTestResult["ingestion"]["mode"] = "latest-completed-run";
  let ingestionRun: DbRunRow | null = null;
  let resolvedBillingSourceId = input.billingSourceId ? String(input.billingSourceId) : undefined;
  let resolvedCloudConnectionId = input.connectionId ? String(input.connectionId) : undefined;

  console.info("[anomaly-backfill-test] start", {
    tenantId,
    connectionId: input.connectionId ?? null,
    fileKey: input.fileKey ?? null,
    ingestionRunId: input.ingestionRunId ?? null,
    billingSourceId: resolvedBillingSourceId ?? null,
  });

  if (input.connectionId) {
    mode = "connection-manual-ingest";
    if (input.fileKey) {
      console.info("[anomaly-backfill-test] parquet-ingestion:start", { connectionId: input.connectionId, fileKey: input.fileKey });
      await manuallyIngestFile(input.connectionId, input.fileKey);
    } else {
      console.info("[anomaly-backfill-test] parquet-ingestion:start", { connectionId: input.connectionId, mode: "latest-file" });
      await manuallyIngestLatestFile(input.connectionId);
    }
    console.info("[anomaly-backfill-test] parquet-ingestion:done");

    const source = await BillingSource.findOne({
      where: { cloudConnectionId: String(input.connectionId) },
      order: [["updatedAt", "DESC"]],
    });
    if (!source) {
      throw new NotFoundError(`No billing source linked to connection ${input.connectionId}`);
    }
    resolvedBillingSourceId = String(source.id);
    resolvedCloudConnectionId = String(input.connectionId);
    const latestRun = await findLatestCompletedRun({
      tenantId,
      billingSourceId: resolvedBillingSourceId,
    });
    if (!latestRun) {
      throw new NotFoundError("No completed ingestion run found after manual ingestion");
    }
    ingestionRun = latestRun;
  } else if (input.ingestionRunId) {
    mode = "existing-run";
    ingestionRun = await ensureCompletedRunOrThrow(String(input.ingestionRunId));
    resolvedBillingSourceId = String(ingestionRun.billing_source_id);
  } else {
    const latestRun = await findLatestCompletedRun({
      tenantId,
      ...(resolvedBillingSourceId ? { billingSourceId: resolvedBillingSourceId } : {}),
    });
    if (latestRun) {
      ingestionRun = latestRun;
      resolvedBillingSourceId = String(latestRun.billing_source_id);
    }
  }

  if (!resolvedCloudConnectionId && resolvedBillingSourceId) {
    const source = await BillingSource.findByPk(resolvedBillingSourceId, {
      attributes: ["id", "cloudConnectionId"],
    });
    const sourceCloudConnectionId = source?.get("cloudConnectionId");
    if (sourceCloudConnectionId) {
      resolvedCloudConnectionId = String(sourceCloudConnectionId);
    }
  }

  const aggregateRowsProduced = ingestionRun ? await ensureAggregationsForRun(ingestionRun) : 0;
  const rowsIngested = ingestionRun ? toFiniteNumber(ingestionRun.rows_loaded) : 0;

  const dates = uniqueSortedDates(
    await getAggregateDatesForRun({
      tenantId,
      ...(ingestionRun ? { ingestionRunId: ingestionRun.id } : {}),
      ...(resolvedBillingSourceId ? { billingSourceId: resolvedBillingSourceId } : {}),
      ...(input.from ? { from: input.from } : {}),
      ...(input.to ? { to: input.to } : {}),
    }),
  );

  if (dates.length === 0) {
    throw new NotFoundError("No agg_cost_daily rows found for selected tenant/run scope");
  }

  const from = input.from ?? dates[0];
  const to = input.to ?? dates[dates.length - 1];

  const aggregateSample = await inspectAggCostDailyForRange({
    tenantId,
    from,
    to,
    ...(resolvedBillingSourceId ? { billingSourceId: resolvedBillingSourceId } : {}),
    limit: 50,
  });
  console.info("[anomaly-backfill-test] aggregate-inspection", {
    tenantId,
    from,
    to,
    rowsSampled: aggregateSample.length,
    sample: aggregateSample.slice(0, 5),
  });

  const detectorSummary = await runDetectorsForDates(dates, {
    ...(resolvedCloudConnectionId ? { fallbackCloudConnectionId: resolvedCloudConnectionId } : {}),
  });

  const naturalAnomalies = await verifyDetectedAnomalies({
    tenantId,
    from,
    to,
  });
  console.info("[anomaly-backfill-test] natural-anomaly-check", {
    tenantId,
    from,
    to,
    anomalyCount: naturalAnomalies.length,
    naturalAnomaliesFound: naturalAnomalies.length > 0,
  });

  let syntheticSnapshot: SyntheticSpikeSnapshot | null = null;
  let anomaliesAfterPatch: VerifiedAnomalyRow[] = [];
  let dedupeSecondRunInserted = 0;
  let cleanupAnomalyIds: string[] = [];

  if (naturalAnomalies.length === 0 && input.syntheticIfNoAnomaly !== false) {
    syntheticSnapshot = await createSyntheticAggregateSpikeTestData({
      tenantId,
      ...(resolvedBillingSourceId ? { billingSourceId: resolvedBillingSourceId } : {}),
      from,
      to,
    });

    if (!syntheticSnapshot) {
      throw new NotFoundError("No stable aggregate scope found for synthetic spike test data");
    }

    console.info("[anomaly-backfill-test] synthetic-spike-created", syntheticSnapshot);

    const beforeSynthetic = await verifyDetectedAnomalies({
      tenantId,
      from: syntheticSnapshot.usageDate,
      to: syntheticSnapshot.usageDate,
    });

    const firstSyntheticRun = await runAnomalyDetectorsForDate(syntheticSnapshot.usageDate, {
      ...(resolvedCloudConnectionId ? { fallbackCloudConnectionId: resolvedCloudConnectionId } : {}),
    });
    console.info("[anomaly-backfill-test] synthetic-detector-run:first", {
      usageDate: syntheticSnapshot.usageDate,
      anomaliesInserted: firstSyntheticRun.anomaliesInserted,
      duplicatesSkipped: firstSyntheticRun.duplicatesSkipped,
    });

    anomaliesAfterPatch = await verifyDetectedAnomalies({
      tenantId,
      from: syntheticSnapshot.usageDate,
      to: syntheticSnapshot.usageDate,
    });

    const beforeIds = new Set(beforeSynthetic.map((item) => item.id));
    let afterNew = anomaliesAfterPatch.filter((item) => !beforeIds.has(item.id));
    cleanupAnomalyIds = afterNew.map((item) => item.id);

    if (afterNew.length === 0) {
      const intensifiedEffectiveCost = Math.max(
        syntheticSnapshot.patchedEffectiveCost * 10,
        syntheticSnapshot.originalEffectiveCost + 5000,
        syntheticSnapshot.prior7DayAverageEffectiveCost * 20,
      );
      const intensifiedBilledCost = Math.max(syntheticSnapshot.patchedBilledCost, intensifiedEffectiveCost);
      const intensifiedListCost = Math.max(syntheticSnapshot.patchedListCost, intensifiedEffectiveCost);

      await sequelize.query(
        `
UPDATE agg_cost_daily
SET
  effective_cost = :patchedEffectiveCost,
  billed_cost = :patchedBilledCost,
  list_cost = :patchedListCost,
  updated_at = NOW()
WHERE tenant_id = :tenantId
  AND usage_date = :usageDate::date
  AND service_key IS NOT DISTINCT FROM :serviceKey::bigint
  AND sub_account_key IS NOT DISTINCT FROM :subAccountKey::bigint
  AND region_key IS NOT DISTINCT FROM :regionKey::bigint
  AND currency_code IS NOT DISTINCT FROM :currencyCode
  AND billing_source_id IS NOT DISTINCT FROM :billingSourceId::bigint
`,
        {
          replacements: {
            tenantId: syntheticSnapshot.tenantId,
            usageDate: syntheticSnapshot.usageDate,
            serviceKey: syntheticSnapshot.serviceKey,
            subAccountKey: syntheticSnapshot.subAccountKey,
            regionKey: syntheticSnapshot.regionKey,
            currencyCode: syntheticSnapshot.currencyCode,
            billingSourceId: syntheticSnapshot.billingSourceId,
            patchedEffectiveCost: intensifiedEffectiveCost,
            patchedBilledCost: intensifiedBilledCost,
            patchedListCost: intensifiedListCost,
          },
          type: QueryTypes.UPDATE,
        },
      );

      syntheticSnapshot.patchedEffectiveCost = intensifiedEffectiveCost;
      syntheticSnapshot.patchedBilledCost = intensifiedBilledCost;
      syntheticSnapshot.patchedListCost = intensifiedListCost;

      const retrySyntheticRun = await runAnomalyDetectorsForDate(syntheticSnapshot.usageDate, {
        ...(resolvedCloudConnectionId ? { fallbackCloudConnectionId: resolvedCloudConnectionId } : {}),
      });
      console.info("[anomaly-backfill-test] synthetic-detector-run:retry", {
        usageDate: syntheticSnapshot.usageDate,
        anomaliesInserted: retrySyntheticRun.anomaliesInserted,
        duplicatesSkipped: retrySyntheticRun.duplicatesSkipped,
      });

      anomaliesAfterPatch = await verifyDetectedAnomalies({
        tenantId,
        from: syntheticSnapshot.usageDate,
        to: syntheticSnapshot.usageDate,
      });

      afterNew = anomaliesAfterPatch.filter((item) => !beforeIds.has(item.id));
      cleanupAnomalyIds = afterNew.map((item) => item.id);

      if (afterNew.length === 0 && anomaliesAfterPatch.length === 0) {
        throw new BadRequestError(
          `Synthetic spike applied but no new anomaly row was inserted (examined=${firstSyntheticRun.examined}, duplicatesSkipped=${firstSyntheticRun.duplicatesSkipped}, failures=${firstSyntheticRun.failures})`,
        );
      }

      if (afterNew.length === 0 && anomaliesAfterPatch.length > 0) {
        console.info("[anomaly-backfill-test] synthetic-dedupe-existing-anomaly", {
          usageDate: syntheticSnapshot.usageDate,
          existingCount: anomaliesAfterPatch.length,
        });
      }
    }

    const preDedupeCount = anomaliesAfterPatch.length;
    const secondSyntheticRun = await runAnomalyDetectorsForDate(syntheticSnapshot.usageDate, {
      ...(resolvedCloudConnectionId ? { fallbackCloudConnectionId: resolvedCloudConnectionId } : {}),
    });
    dedupeSecondRunInserted = secondSyntheticRun.anomaliesInserted;

    const afterDedupe = await verifyDetectedAnomalies({
      tenantId,
      from: syntheticSnapshot.usageDate,
      to: syntheticSnapshot.usageDate,
    });

    if (afterDedupe.length !== preDedupeCount) {
      throw new BadRequestError("Dedupe verification failed: anomaly count changed on second identical run");
    }

    console.info("[anomaly-backfill-test] dedupe-verification", {
      usageDate: syntheticSnapshot.usageDate,
      preDedupeCount,
      postDedupeCount: afterDedupe.length,
      secondRunInserted: secondSyntheticRun.anomaliesInserted,
      secondRunDuplicatesSkipped: secondSyntheticRun.duplicatesSkipped,
    });
  }

  if (input.runCleanup && syntheticSnapshot) {
    await cleanupSyntheticAggregateSpikeTestData({
      snapshot: syntheticSnapshot,
      anomalyIdsToDelete: cleanupAnomalyIds,
    });
    console.info("[anomaly-backfill-test] cleanup-complete", {
      usageDate: syntheticSnapshot.usageDate,
      restoredAggregateRow: true,
      deletedSyntheticAnomalies: cleanupAnomalyIds.length,
    });
  }

  return {
    ingestion: {
      mode,
      ingestionRunId: ingestionRun?.id ?? null,
      rowsIngested,
      aggregateRowsProduced,
    },
    dateCoverage: {
      from,
      to,
      dates,
    },
    realDataDetectorRun: detectorSummary,
    naturalAnomalies,
    syntheticSpike: {
      applied: syntheticSnapshot !== null,
      snapshot: syntheticSnapshot,
      anomaliesAfterPatch,
      dedupeSecondRunInserted,
    },
  };
}
