import { Op, QueryTypes } from "sequelize";

import { AnomalyContributor, CloudEvent, FactAnomalies, sequelize } from "../../../models/index.js";
import { logger } from "../../../utils/logger.js";
import { buildAnomalyFingerprint, defaultExplanation, resolveSeverity, toFiniteNumber } from "./anomaly.helpers.js";
import type { DetectionCandidate, DetectorConfig, Severity } from "./anomaly.types.js";

type RawCandidateRow = {
  tenant_id: string;
  cloud_connection_id: string | null;
  billing_source_id: string | null;
  provider_id: string | null;
  usage_date: string;
  currency_code: string | null;
  service_key: string | null;
  region_key: string | null;
  sub_account_key: string | null;
  resource_key: string | null;
  expected_value: number | string | null;
  actual_value: number | string | null;
  anomaly_scope: string | null;
  dimension_value: string | null;
};

type SimpleContributor = {
  dimensionType: string;
  dimensionKey: string | null;
  dimensionValue: string | null;
  contributionCost: number;
  contributionPercent: number;
  rank: number;
};

type CloudEventHint = {
  eventName: string | null;
  eventTime: Date;
  resourceId: string | null;
  userArn: string | null;
};

const normalizeCandidate = (row: RawCandidateRow): DetectionCandidate => {
  const expectedValue = toFiniteNumber(row.expected_value);
  const actualValue = toFiniteNumber(row.actual_value);
  const deltaValue = actualValue - expectedValue;
  const deltaPercent = expectedValue !== 0 ? (deltaValue / Math.abs(expectedValue)) * 100 : 0;

  return {
    tenantId: row.tenant_id,
    cloudConnectionId: row.cloud_connection_id,
    billingSourceId: row.billing_source_id,
    providerId: row.provider_id,
    usageDate: row.usage_date,
    currencyCode: row.currency_code,
    serviceKey: row.service_key,
    regionKey: row.region_key,
    subAccountKey: row.sub_account_key,
    resourceKey: row.resource_key,
    anomalyScope: row.anomaly_scope ?? "global",
    expectedValue,
    actualValue,
    deltaValue,
    deltaPercent,
    dimensionValue: row.dimension_value,
    metadata: {},
  };
};

export class AnomalyRepository {
  async findCostCandidatesByDimension(input: {
    usageDate: string;
    config: DetectorConfig;
    dimension: "global" | "service" | "region" | "sub_account";
  }): Promise<DetectionCandidate[]> {
    const { usageDate, config, dimension } = input;

    const dimensionSelectMap: Record<typeof dimension, string> = {
      global: "NULL::bigint AS service_key, NULL::bigint AS region_key, NULL::bigint AS sub_account_key, 'global'::text AS dimension_value",
      service: "c.service_key, NULL::bigint AS region_key, NULL::bigint AS sub_account_key, c.service_key::text AS dimension_value",
      region: "NULL::bigint AS service_key, c.region_key, NULL::bigint AS sub_account_key, c.region_key::text AS dimension_value",
      sub_account: "NULL::bigint AS service_key, NULL::bigint AS region_key, c.sub_account_key, c.sub_account_key::text AS dimension_value",
    };

    const dimensionGroupMap: Record<typeof dimension, string> = {
      global: "c.tenant_id, c.cloud_connection_id, c.billing_source_id, c.provider_id, c.usage_date, c.currency_code, c.actual_value",
      service: "c.tenant_id, c.cloud_connection_id, c.billing_source_id, c.provider_id, c.usage_date, c.currency_code, c.service_key, c.actual_value",
      region: "c.tenant_id, c.cloud_connection_id, c.billing_source_id, c.provider_id, c.usage_date, c.currency_code, c.region_key, c.actual_value",
      sub_account:
        "c.tenant_id, c.cloud_connection_id, c.billing_source_id, c.provider_id, c.usage_date, c.currency_code, c.sub_account_key, c.actual_value",
    };

    const dimensionJoinFilterMap: Record<typeof dimension, string> = {
      global: "1=1",
      service: "b.service_key = c.service_key",
      region: "b.region_key = c.region_key",
      sub_account: "b.sub_account_key = c.sub_account_key",
    };

    const comparator =
      config.ruleType === "drop"
        ? `AND c.actual_value <= (b.expected_value * :thresholdMultiplier)
           AND (b.expected_value - c.actual_value) >= :minAbsoluteDelta`
        : `AND c.actual_value >= (b.expected_value * :thresholdMultiplier)
           AND (c.actual_value - b.expected_value) >= :minAbsoluteDelta`;

    const rows = await sequelize.query<RawCandidateRow>(
      `
WITH curr AS (
  SELECT
    acd.tenant_id,
    acd.billing_source_id,
    acd.provider_id,
    bs.cloud_connection_id,
    acd.usage_date,
    acd.currency_code,
    acd.service_key,
    acd.region_key,
    acd.sub_account_key,
    SUM(COALESCE(acd.effective_cost, 0))::double precision AS actual_value
  FROM agg_cost_daily acd
  LEFT JOIN billing_sources bs ON bs.id = acd.billing_source_id
  WHERE acd.usage_date = :usageDate::date
  GROUP BY
    acd.tenant_id, acd.billing_source_id, acd.provider_id, bs.cloud_connection_id,
    acd.usage_date, acd.currency_code, acd.service_key, acd.region_key, acd.sub_account_key
),
baseline AS (
  SELECT
    acd.tenant_id,
    acd.billing_source_id,
    acd.provider_id,
    bs.cloud_connection_id,
    acd.currency_code,
    acd.service_key,
    acd.region_key,
    acd.sub_account_key,
    ${
      config.baselineType === "rolling_median"
        ? "PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY COALESCE(acd.effective_cost, 0))::double precision"
        : "AVG(COALESCE(acd.effective_cost, 0))::double precision"
    } AS expected_value
  FROM agg_cost_daily acd
  LEFT JOIN billing_sources bs ON bs.id = acd.billing_source_id
  WHERE acd.usage_date < :usageDate::date
    AND acd.usage_date >= (:usageDate::date - interval '28 days')
    ${
      config.baselineType === "same_weekday_4w"
        ? "AND EXTRACT(DOW FROM acd.usage_date) = EXTRACT(DOW FROM :usageDate::date)"
        : ""
    }
  GROUP BY
    acd.tenant_id, acd.billing_source_id, acd.provider_id, bs.cloud_connection_id,
    acd.currency_code, acd.service_key, acd.region_key, acd.sub_account_key
)
SELECT
  c.tenant_id,
  c.cloud_connection_id,
  c.billing_source_id,
  c.provider_id,
  c.usage_date,
  c.currency_code,
  ${dimensionSelectMap[dimension]},
  NULL::bigint AS resource_key,
  b.expected_value,
  c.actual_value,
  :anomalyScope::text AS anomaly_scope
FROM curr c
JOIN baseline b ON
  b.tenant_id = c.tenant_id
  AND COALESCE(b.cloud_connection_id::text, '') = COALESCE(c.cloud_connection_id::text, '')
  AND COALESCE(b.billing_source_id::text, '') = COALESCE(c.billing_source_id::text, '')
  AND COALESCE(b.provider_id::text, '') = COALESCE(c.provider_id::text, '')
  AND COALESCE(b.currency_code, '') = COALESCE(c.currency_code, '')
  AND ${dimensionJoinFilterMap[dimension]}
WHERE b.expected_value >= :minExpectedValue
  ${comparator}
GROUP BY ${dimensionGroupMap[dimension]}, b.expected_value
`,
      {
        replacements: {
          usageDate,
          thresholdMultiplier: config.thresholdMultiplier,
          minAbsoluteDelta: config.minAbsoluteDelta,
          minExpectedValue: config.minExpectedValue,
          anomalyScope: dimension,
        },
        type: QueryTypes.SELECT,
      },
    );

    return rows.map(normalizeCandidate);
  }

  async findUsageCandidates(input: {
    usageDate: string;
    config: DetectorConfig;
  }): Promise<DetectionCandidate[]> {
    const { usageDate, config } = input;
    const comparator =
      config.ruleType === "drop"
        ? `AND c.actual_value <= (b.expected_value * :thresholdMultiplier)
           AND (b.expected_value - c.actual_value) >= :minAbsoluteDelta`
        : `AND c.actual_value >= (b.expected_value * :thresholdMultiplier)
           AND (c.actual_value - b.expected_value) >= :minAbsoluteDelta`;

    const rows = await sequelize.query<RawCandidateRow>(
      `
WITH curr AS (
  SELECT
    acd.tenant_id,
    acd.billing_source_id,
    acd.provider_id,
    bs.cloud_connection_id,
    acd.usage_date,
    acd.currency_code,
    SUM(COALESCE(acd.usage_quantity, 0))::double precision AS actual_value
  FROM agg_cost_daily acd
  LEFT JOIN billing_sources bs ON bs.id = acd.billing_source_id
  WHERE acd.usage_date = :usageDate::date
  GROUP BY acd.tenant_id, acd.billing_source_id, acd.provider_id, bs.cloud_connection_id, acd.usage_date, acd.currency_code
),
baseline AS (
  SELECT
    acd.tenant_id,
    acd.billing_source_id,
    acd.provider_id,
    bs.cloud_connection_id,
    acd.currency_code,
    AVG(COALESCE(acd.usage_quantity, 0))::double precision AS expected_value
  FROM agg_cost_daily acd
  LEFT JOIN billing_sources bs ON bs.id = acd.billing_source_id
  WHERE acd.usage_date < :usageDate::date
    AND acd.usage_date >= (:usageDate::date - interval '28 days')
  GROUP BY acd.tenant_id, acd.billing_source_id, acd.provider_id, bs.cloud_connection_id, acd.currency_code
)
SELECT
  c.tenant_id,
  c.cloud_connection_id,
  c.billing_source_id,
  c.provider_id,
  c.usage_date,
  c.currency_code,
  NULL::bigint AS service_key,
  NULL::bigint AS region_key,
  NULL::bigint AS sub_account_key,
  NULL::bigint AS resource_key,
  b.expected_value,
  c.actual_value,
  'usage_global'::text AS anomaly_scope,
  NULL::text AS dimension_value
FROM curr c
JOIN baseline b ON
  b.tenant_id = c.tenant_id
  AND COALESCE(b.cloud_connection_id::text, '') = COALESCE(c.cloud_connection_id::text, '')
  AND COALESCE(b.billing_source_id::text, '') = COALESCE(c.billing_source_id::text, '')
  AND COALESCE(b.provider_id::text, '') = COALESCE(c.provider_id::text, '')
  AND COALESCE(b.currency_code, '') = COALESCE(c.currency_code, '')
WHERE b.expected_value >= :minExpectedValue
  ${comparator}
`,
      {
        replacements: {
          usageDate,
          thresholdMultiplier: config.thresholdMultiplier,
          minAbsoluteDelta: config.minAbsoluteDelta,
          minExpectedValue: config.minExpectedValue,
        },
        type: QueryTypes.SELECT,
      },
    );
    return rows.map(normalizeCandidate);
  }

  async findUsageMismatchCandidates(input: {
    usageDate: string;
    config: DetectorConfig;
  }): Promise<DetectionCandidate[]> {
    const { usageDate, config } = input;
    const rows = await sequelize.query<RawCandidateRow>(
      `
WITH curr AS (
  SELECT
    acd.tenant_id,
    acd.billing_source_id,
    acd.provider_id,
    bs.cloud_connection_id,
    acd.usage_date,
    acd.currency_code,
    (SUM(COALESCE(acd.effective_cost, 0))::double precision / NULLIF(SUM(COALESCE(acd.usage_quantity, 0))::double precision, 0)) AS actual_value
  FROM agg_cost_daily acd
  LEFT JOIN billing_sources bs ON bs.id = acd.billing_source_id
  WHERE acd.usage_date = :usageDate::date
  GROUP BY acd.tenant_id, acd.billing_source_id, acd.provider_id, bs.cloud_connection_id, acd.usage_date, acd.currency_code
),
baseline AS (
  SELECT
    x.tenant_id,
    x.billing_source_id,
    x.provider_id,
    x.cloud_connection_id,
    x.currency_code,
    AVG(x.cost_per_unit)::double precision AS expected_value
  FROM (
    SELECT
      acd.tenant_id,
      acd.billing_source_id,
      acd.provider_id,
      bs.cloud_connection_id,
      acd.currency_code,
      acd.usage_date,
      (SUM(COALESCE(acd.effective_cost, 0))::double precision / NULLIF(SUM(COALESCE(acd.usage_quantity, 0))::double precision, 0)) AS cost_per_unit
    FROM agg_cost_daily acd
    LEFT JOIN billing_sources bs ON bs.id = acd.billing_source_id
    WHERE acd.usage_date < :usageDate::date
      AND acd.usage_date >= (:usageDate::date - interval '28 days')
    GROUP BY acd.tenant_id, acd.billing_source_id, acd.provider_id, bs.cloud_connection_id, acd.currency_code, acd.usage_date
  ) x
  WHERE x.cost_per_unit IS NOT NULL
  GROUP BY x.tenant_id, x.billing_source_id, x.provider_id, x.cloud_connection_id, x.currency_code
)
SELECT
  c.tenant_id,
  c.cloud_connection_id,
  c.billing_source_id,
  c.provider_id,
  c.usage_date,
  c.currency_code,
  NULL::bigint AS service_key,
  NULL::bigint AS region_key,
  NULL::bigint AS sub_account_key,
  NULL::bigint AS resource_key,
  b.expected_value,
  c.actual_value,
  'usage_mismatch'::text AS anomaly_scope,
  NULL::text AS dimension_value
FROM curr c
JOIN baseline b ON
  b.tenant_id = c.tenant_id
  AND COALESCE(b.cloud_connection_id::text, '') = COALESCE(c.cloud_connection_id::text, '')
  AND COALESCE(b.billing_source_id::text, '') = COALESCE(c.billing_source_id::text, '')
  AND COALESCE(b.provider_id::text, '') = COALESCE(c.provider_id::text, '')
  AND COALESCE(b.currency_code, '') = COALESCE(c.currency_code, '')
WHERE c.actual_value IS NOT NULL
  AND b.expected_value >= :minExpectedValue
  AND c.actual_value >= (b.expected_value * :thresholdMultiplier)
  AND (c.actual_value - b.expected_value) >= :minAbsoluteDelta
`,
      {
        replacements: {
          usageDate,
          thresholdMultiplier: config.thresholdMultiplier,
          minAbsoluteDelta: config.minAbsoluteDelta,
          minExpectedValue: config.minExpectedValue,
        },
        type: QueryTypes.SELECT,
      },
    );
    return rows.map(normalizeCandidate);
  }

  async findTagCostCandidates(input: {
    usageDate: string;
    config: DetectorConfig;
  }): Promise<DetectionCandidate[]> {
    const { usageDate, config } = input;
    const tagKey = (config.tagKey ?? "environment").trim();
    const rows = await sequelize.query<RawCandidateRow>(
      `
WITH curr AS (
  SELECT
    fcli.tenant_id,
    fcli.billing_source_id,
    fcli.provider_id,
    bs.cloud_connection_id,
    DATE(dd.full_date) AS usage_date,
    'USD'::text AS currency_code,
    COALESCE(fcli.tags_json ->> :tagKey, '__missing__') AS tag_value,
    SUM(COALESCE(fcli.effective_cost, 0))::double precision AS actual_value
  FROM fact_cost_line_items fcli
  JOIN dim_date dd ON dd.id = fcli.usage_date_key
  LEFT JOIN billing_sources bs ON bs.id = fcli.billing_source_id
  WHERE dd.full_date = :usageDate::date
  GROUP BY fcli.tenant_id, fcli.billing_source_id, fcli.provider_id, bs.cloud_connection_id, DATE(dd.full_date), COALESCE(fcli.tags_json ->> :tagKey, '__missing__')
),
baseline AS (
  SELECT
    x.tenant_id,
    x.billing_source_id,
    x.provider_id,
    x.cloud_connection_id,
    x.tag_value,
    AVG(x.cost_value)::double precision AS expected_value
  FROM (
    SELECT
      fcli.tenant_id,
      fcli.billing_source_id,
      fcli.provider_id,
      bs.cloud_connection_id,
      DATE(dd.full_date) AS usage_date,
      COALESCE(fcli.tags_json ->> :tagKey, '__missing__') AS tag_value,
      SUM(COALESCE(fcli.effective_cost, 0))::double precision AS cost_value
    FROM fact_cost_line_items fcli
    JOIN dim_date dd ON dd.id = fcli.usage_date_key
    LEFT JOIN billing_sources bs ON bs.id = fcli.billing_source_id
    WHERE dd.full_date < :usageDate::date
      AND dd.full_date >= (:usageDate::date - interval '28 days')
    GROUP BY fcli.tenant_id, fcli.billing_source_id, fcli.provider_id, bs.cloud_connection_id, DATE(dd.full_date), COALESCE(fcli.tags_json ->> :tagKey, '__missing__')
  ) x
  GROUP BY x.tenant_id, x.billing_source_id, x.provider_id, x.cloud_connection_id, x.tag_value
)
SELECT
  c.tenant_id,
  c.cloud_connection_id,
  c.billing_source_id,
  c.provider_id,
  c.usage_date::text,
  c.currency_code,
  NULL::bigint AS service_key,
  NULL::bigint AS region_key,
  NULL::bigint AS sub_account_key,
  NULL::bigint AS resource_key,
  b.expected_value,
  c.actual_value,
  'tag'::text AS anomaly_scope,
  c.tag_value AS dimension_value
FROM curr c
JOIN baseline b ON
  b.tenant_id = c.tenant_id
  AND COALESCE(b.cloud_connection_id::text, '') = COALESCE(c.cloud_connection_id::text, '')
  AND COALESCE(b.billing_source_id::text, '') = COALESCE(c.billing_source_id::text, '')
  AND COALESCE(b.provider_id::text, '') = COALESCE(c.provider_id::text, '')
  AND b.tag_value = c.tag_value
WHERE b.expected_value >= :minExpectedValue
  AND c.actual_value >= (b.expected_value * :thresholdMultiplier)
  AND (c.actual_value - b.expected_value) >= :minAbsoluteDelta
`,
      {
        replacements: {
          usageDate,
          tagKey,
          thresholdMultiplier: config.thresholdMultiplier,
          minAbsoluteDelta: config.minAbsoluteDelta,
          minExpectedValue: config.minExpectedValue,
        },
        type: QueryTypes.SELECT,
      },
    );
    return rows.map(normalizeCandidate);
  }

  async findIdleCostCandidates(input: {
    usageDate: string;
    config: DetectorConfig;
  }): Promise<DetectionCandidate[]> {
    const { usageDate, config } = input;
    const maxCpuThreshold = toFiniteNumber(config.metadata?.maxCpuThreshold ?? 10);
    const maxMemoryThreshold = toFiniteNumber(config.metadata?.maxMemoryThreshold ?? 20);
    const minCostThreshold = toFiniteNumber(config.metadata?.minCostThreshold ?? 10);

    const rows = await sequelize.query<RawCandidateRow>(
      `
WITH daily_resource_cost AS (
  SELECT
    fcli.tenant_id,
    fcli.billing_source_id,
    fcli.provider_id,
    bs.cloud_connection_id,
    DATE(dd.full_date) AS usage_date,
    fcli.resource_key,
    fcli.service_key,
    fcli.region_key,
    fcli.sub_account_key,
    SUM(COALESCE(fcli.effective_cost, 0))::double precision AS actual_value
  FROM fact_cost_line_items fcli
  JOIN dim_date dd ON dd.id = fcli.usage_date_key
  LEFT JOIN billing_sources bs ON bs.id = fcli.billing_source_id
  WHERE dd.full_date = :usageDate::date
    AND fcli.resource_key IS NOT NULL
  GROUP BY
    fcli.tenant_id, fcli.billing_source_id, fcli.provider_id, bs.cloud_connection_id,
    DATE(dd.full_date), fcli.resource_key, fcli.service_key, fcli.region_key, fcli.sub_account_key
),
baseline AS (
  SELECT
    x.tenant_id,
    x.billing_source_id,
    x.provider_id,
    x.cloud_connection_id,
    x.resource_key,
    AVG(x.resource_cost)::double precision AS expected_value
  FROM (
    SELECT
      fcli.tenant_id,
      fcli.billing_source_id,
      fcli.provider_id,
      bs.cloud_connection_id,
      DATE(dd.full_date) AS usage_date,
      fcli.resource_key,
      SUM(COALESCE(fcli.effective_cost, 0))::double precision AS resource_cost
    FROM fact_cost_line_items fcli
    JOIN dim_date dd ON dd.id = fcli.usage_date_key
    LEFT JOIN billing_sources bs ON bs.id = fcli.billing_source_id
    WHERE dd.full_date < :usageDate::date
      AND dd.full_date >= (:usageDate::date - interval '28 days')
      AND fcli.resource_key IS NOT NULL
    GROUP BY
      fcli.tenant_id, fcli.billing_source_id, fcli.provider_id, bs.cloud_connection_id,
      DATE(dd.full_date), fcli.resource_key
  ) x
  GROUP BY x.tenant_id, x.billing_source_id, x.provider_id, x.cloud_connection_id, x.resource_key
)
SELECT
  c.tenant_id,
  c.cloud_connection_id,
  c.billing_source_id,
  c.provider_id,
  c.usage_date::text,
  'USD'::text AS currency_code,
  c.service_key::text AS service_key,
  c.region_key::text AS region_key,
  c.sub_account_key::text AS sub_account_key,
  c.resource_key::text AS resource_key,
  b.expected_value,
  c.actual_value,
  'resource_idle'::text AS anomaly_scope,
  c.resource_key::text AS dimension_value
FROM daily_resource_cost c
JOIN baseline b ON
  b.tenant_id = c.tenant_id
  AND COALESCE(b.cloud_connection_id::text, '') = COALESCE(c.cloud_connection_id::text, '')
  AND COALESCE(b.billing_source_id::text, '') = COALESCE(c.billing_source_id::text, '')
  AND COALESCE(b.provider_id::text, '') = COALESCE(c.provider_id::text, '')
  AND b.resource_key = c.resource_key
JOIN resource_utilization_daily rud ON
  rud.tenant_id = c.tenant_id
  AND rud.usage_date = c.usage_date
  AND rud.resource_key = c.resource_key
WHERE c.actual_value >= :minCostThreshold
  AND COALESCE(rud.max_cpu, COALESCE(rud.cpu_avg, 0)) <= :maxCpuThreshold
  AND COALESCE(rud.max_memory, COALESCE(rud.memory_avg, 0)) <= :maxMemoryThreshold
`,
      {
        replacements: {
          usageDate,
          maxCpuThreshold,
          maxMemoryThreshold,
          minCostThreshold,
        },
        type: QueryTypes.SELECT,
      },
    );
    return rows.map(normalizeCandidate);
  }

  async insertAnomaly(input: {
    config: DetectorConfig;
    candidate: DetectionCandidate;
    rootCauseHint: string | null;
    explanationJson: Record<string, unknown> | null;
    metadataJson: Record<string, unknown> | null;
  }): Promise<{ inserted: boolean; anomalyId: string | null }> {
    const { config, candidate, rootCauseHint, explanationJson, metadataJson } = input;
    const fingerprint = buildAnomalyFingerprint({ config, candidate });
    const severity: Severity = resolveSeverity(Math.abs(candidate.deltaPercent));

    const existing = await FactAnomalies.findOne({
      where: {
        fingerprint,
      },
      attributes: ["id"],
    });
    if (existing) {
      return { inserted: false, anomalyId: String(existing.id) };
    }

    const anomaly = await FactAnomalies.create({
      tenantId: candidate.tenantId,
      cloudConnectionId: candidate.cloudConnectionId ?? "",
      detectedAt: new Date(),
      usageDate: candidate.usageDate,
      anomalyScope: candidate.anomalyScope,
      anomalyType: config.anomalyType,
      baselineType: config.baselineType,
      expectedCost: String(candidate.expectedValue),
      actualCost: String(candidate.actualValue),
      deltaCost: String(candidate.deltaValue),
      deltaPercent: String(candidate.deltaPercent),
      severity,
      status: "open",
      sourceGranularity: config.granularity,
      sourceTable:
        config.dimensionType === "resource" || config.anomalyType === "idle_cost"
          ? "resource_utilization_daily"
          : config.dimensionType === "tag"
            ? "fact_cost_line_items"
            : "agg_cost_daily",
      serviceKey: candidate.serviceKey,
      regionKey: candidate.regionKey,
      subAccountKey: candidate.subAccountKey,
      resourceKey: candidate.resourceKey,
      billingSourceId: candidate.billingSourceId,
      currencyCode: candidate.currencyCode ?? "USD",
      rootCauseHint,
      explanationJson: explanationJson ?? defaultExplanation(config, candidate),
      metadataJson: {
        ...candidate.metadata,
        dimension_value: candidate.dimensionValue,
        detector_key: config.key,
      },
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      fingerprint,
    });

    return { inserted: true, anomalyId: String(anomaly.id) };
  }

  async insertContributors(anomalyId: string, contributors: SimpleContributor[]): Promise<void> {
    if (contributors.length === 0) return;
    await AnomalyContributor.bulkCreate(
      contributors.map((entry) => ({
        anomalyId,
        dimensionType: entry.dimensionType,
        dimensionKey: entry.dimensionKey,
        dimensionValue: entry.dimensionValue,
        contributionCost: String(entry.contributionCost),
        contributionPercent: String(entry.contributionPercent),
        rank: entry.rank,
      })),
    );
  }

  async buildContributors(config: DetectorConfig, candidate: DetectionCandidate): Promise<SimpleContributor[]> {
    if (config.dimensionType === "global") {
      const rows = await sequelize.query<{ dimension_key: string; value: number | string; pct: number | string }>(
        `
SELECT
  service_key::text AS dimension_key,
  SUM(COALESCE(effective_cost, 0))::double precision AS value,
  CASE
    WHEN SUM(SUM(COALESCE(effective_cost, 0))) OVER() = 0 THEN 0
    ELSE (SUM(COALESCE(effective_cost, 0)) / SUM(SUM(COALESCE(effective_cost, 0))) OVER()) * 100
  END AS pct
FROM agg_cost_daily
WHERE tenant_id = :tenantId
  AND usage_date = :usageDate::date
GROUP BY service_key
ORDER BY value DESC
LIMIT 3
`,
        {
          replacements: {
            tenantId: candidate.tenantId,
            usageDate: candidate.usageDate,
          },
          type: QueryTypes.SELECT,
        },
      );
      return rows.map((row, idx) => ({
        dimensionType: "service",
        dimensionKey: row.dimension_key,
        dimensionValue: row.dimension_key,
        contributionCost: toFiniteNumber(row.value),
        contributionPercent: toFiniteNumber(row.pct),
        rank: idx + 1,
      }));
    }

    const keyByDimension: Record<string, string | null> = {
      service: candidate.serviceKey,
      region: candidate.regionKey,
      sub_account: candidate.subAccountKey,
      resource: candidate.resourceKey,
      tag: candidate.dimensionValue,
    };

    const dimensionKey = keyByDimension[config.dimensionType] ?? null;
    return [
      {
        dimensionType: config.dimensionType,
        dimensionKey,
        dimensionValue: candidate.dimensionValue ?? dimensionKey,
        contributionCost: Math.abs(candidate.deltaValue),
        contributionPercent: 100,
        rank: 1,
      },
    ];
  }

  async findCloudTrailHint(candidate: DetectionCandidate): Promise<string | null> {
    if (!candidate.cloudConnectionId) return null;

    const relevantEventNames = [
      "RunInstances",
      "StartInstances",
      "StopInstances",
      "TerminateInstances",
      "ModifyInstanceAttribute",
    ];

    const from = `${candidate.usageDate}T00:00:00.000Z`;
    const to = `${candidate.usageDate}T23:59:59.999Z`;

    const event = (await CloudEvent.findOne({
      where: {
        tenantId: candidate.tenantId,
        cloudConnectionId: candidate.cloudConnectionId,
        eventName: relevantEventNames,
        eventTime: {
          [Op.between]: [from, to],
        },
      },
      order: [["eventTime", "DESC"]],
      attributes: ["eventName", "eventTime", "resourceId", "userArn"],
    })) as unknown as CloudEventHint | null;

    if (!event) return null;

    const eventTime = event.eventTime instanceof Date ? event.eventTime.toISOString() : String(event.eventTime);
    return `Nearby change event: ${event.eventName ?? "unknown"} at ${eventTime} for ${event.resourceId ?? "unknown-resource"}`;
  }

  async listAnomalies(input: {
    tenantId: string;
    anomalyType?: string;
    severity?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    serviceKey?: string;
    regionKey?: string;
    subAccountKey?: string;
  }) {
    const where: string[] = ["fa.tenant_id = :tenantId"];
    const replacements: Record<string, string> = { tenantId: input.tenantId };

    if (input.anomalyType) {
      where.push("fa.anomaly_type = :anomalyType");
      replacements.anomalyType = input.anomalyType;
    }
    if (input.severity) {
      where.push("fa.severity = :severity");
      replacements.severity = input.severity;
    }
    if (input.status) {
      where.push("fa.status = :status");
      replacements.status = input.status;
    }
    if (input.dateFrom) {
      where.push("fa.usage_date >= :dateFrom::date");
      replacements.dateFrom = input.dateFrom;
    }
    if (input.dateTo) {
      where.push("fa.usage_date <= :dateTo::date");
      replacements.dateTo = input.dateTo;
    }
    if (input.serviceKey) {
      where.push("fa.service_key = :serviceKey::bigint");
      replacements.serviceKey = input.serviceKey;
    }
    if (input.regionKey) {
      where.push("fa.region_key = :regionKey::bigint");
      replacements.regionKey = input.regionKey;
    }
    if (input.subAccountKey) {
      where.push("fa.sub_account_key = :subAccountKey::bigint");
      replacements.subAccountKey = input.subAccountKey;
    }

    return sequelize.query(
      `
SELECT
  fa.*,
  ds.service_name,
  dr.region_name,
  dsa.sub_account_name
FROM fact_anomalies fa
LEFT JOIN dim_service ds ON ds.id = fa.service_key
LEFT JOIN dim_region dr ON dr.id = fa.region_key
LEFT JOIN dim_sub_account dsa ON dsa.id = fa.sub_account_key
WHERE ${where.join(" AND ")}
ORDER BY fa.detected_at DESC
`,
      {
        replacements,
        type: QueryTypes.SELECT,
      },
    );
  }

  async getAnomalyById(tenantId: string, id: string) {
    const anomalies = await sequelize.query(
      `
SELECT
  fa.*,
  ds.service_name,
  dr.region_name,
  dsa.sub_account_name,
  dres.resource_name
FROM fact_anomalies fa
LEFT JOIN dim_service ds ON ds.id = fa.service_key
LEFT JOIN dim_region dr ON dr.id = fa.region_key
LEFT JOIN dim_sub_account dsa ON dsa.id = fa.sub_account_key
LEFT JOIN dim_resource dres ON dres.id = fa.resource_key
WHERE fa.tenant_id = :tenantId
  AND fa.id = :id
LIMIT 1
`,
      {
        replacements: {
          tenantId,
          id,
        },
        type: QueryTypes.SELECT,
      },
    );

    if (anomalies.length === 0) return null;

    const contributors = await AnomalyContributor.findAll({
      where: { anomalyId: id },
      order: [["rank", "ASC"]],
    });

    logger.debug("Loaded anomaly with contributors", {
      anomalyId: id,
      contributorCount: contributors.length,
    });

    return {
      anomaly: anomalies[0],
      contributors,
    };
  }
}
