import { Op, QueryTypes } from "sequelize";

import { AnomalyContributor, FactAnomalies } from "../../../../models/index.js";
import { sequelize } from "../../../../models/index.js";

import type { S3CostSpikeAnomalyType, S3CostSpikeCandidate } from "./s3-cost-spike.detector.js";

const BASELINE_TYPE = "rolling_7d";
const SOURCE_GRANULARITY = "daily";
const SOURCE_TABLE = "s3_cost_daily";
const ANOMALY_SCOPE = "service_category";
const ANOMALY_TYPES: S3CostSpikeAnomalyType[] = [
  "S3 Storage Cost Spike",
  "S3 Data Transfer Spike",
  "S3 Request Cost Spike",
  "S3 Storage Growth Anomaly",
];

type S3CostSpikeLifecycleInput = {
  runId: string;
  billingSourceId: string;
  tenantId: string | null;
  cloudConnectionId: string | null;
  effectiveDateFrom: string | null;
  effectiveDateTo: string | null;
  candidates: S3CostSpikeCandidate[];
};

export type S3CostSpikeLifecycleResult = {
  created: number;
  updated: number;
  resolved: number;
  detectedFingerprints: string[];
};

type ContributorInput = {
  dimensionType: string;
  dimensionKey?: string | null;
  dimensionValue?: string | null;
  contributionCost?: number | null;
  contributionPercent?: number | null;
  rank?: number | null;
};

const toFixedString = (value: number, scale: number): string => value.toFixed(scale);
const toConfidenceScore = (severity: "low" | "medium" | "high"): string =>
  severity === "high" ? "95.00" : severity === "medium" ? "80.00" : "65.00";

const normalize = (value: string | null | undefined): string => String(value ?? "").trim().toLowerCase();

const buildFingerprint = ({
  tenantId,
  billingSourceId,
  usageDate,
  anomalyType,
}: {
  tenantId: string | null;
  billingSourceId: string;
  usageDate: string;
  anomalyType: S3CostSpikeAnomalyType;
}): string =>
  `s3_spike:${normalize(tenantId) || "none"}:${normalize(billingSourceId)}:${normalize(usageDate)}:${normalize(anomalyType)}`;

const resolveS3ServiceKey = async (): Promise<string | null> => {
  const [row] = await sequelize.query<{ id: string | null }>(
    `
      SELECT ds.id::text AS id
      FROM dim_service ds
      WHERE LOWER(COALESCE(ds.service_name, '')) LIKE '%s3%'
         OR LOWER(COALESCE(ds.service_name, '')) LIKE '%simple storage service%'
      ORDER BY ds.id ASC
      LIMIT 1
    `,
    { type: QueryTypes.SELECT },
  );
  return row?.id ?? null;
};

const resolveResourceKeysByBucketName = async ({
  tenantId,
  bucketNames,
}: {
  tenantId: string | null;
  bucketNames: string[];
}): Promise<Map<string, string>> => {
  if (!tenantId || bucketNames.length === 0) return new Map();

  const names = Array.from(new Set(bucketNames.map((value) => String(value ?? "").trim()).filter((value) => value.length > 0)));
  if (names.length === 0) return new Map();

  const rows = await sequelize.query<{ id: string; resource_name: string | null; resource_id: string | null }>(
    `
      SELECT
        dr.id::text AS id,
        dr.resource_name,
        dr.resource_id
      FROM dim_resource dr
      WHERE dr.tenant_id = CAST(:tenantId AS UUID)
        AND (
          dr.resource_name IN (:names)
          OR dr.resource_id IN (:names)
          OR dr.resource_id IN (:s3Arns)
          OR dr.resource_id IN (:s3Uris)
        )
    `,
    {
      replacements: {
        tenantId,
        names,
        s3Arns: names.map((name) => `arn:aws:s3:::${name}`),
        s3Uris: names.map((name) => `s3://${name}`),
      },
      type: QueryTypes.SELECT,
    },
  );

  const map = new Map<string, string>();
  for (const row of rows) {
    const id = String(row.id ?? "").trim();
    if (!id) continue;
    const byName = String(row.resource_name ?? "").trim();
    const byId = String(row.resource_id ?? "").trim();
    if (byName.length > 0 && !map.has(byName)) map.set(byName, id);
    if (byId.length > 0 && !map.has(byId)) map.set(byId, id);
    if (byId.startsWith("arn:aws:s3:::")) {
      const bucket = byId.slice("arn:aws:s3:::".length);
      if (bucket.length > 0 && !map.has(bucket)) map.set(bucket, id);
    }
    if (byId.startsWith("s3://")) {
      const bucket = byId.slice("s3://".length).split("/")[0];
      if (bucket.length > 0 && !map.has(bucket)) map.set(bucket, id);
    }
  }
  return map;
};

async function replaceContributorsForAnomaly({
  anomalyId,
  contributors,
}: {
  anomalyId: string;
  contributors: ContributorInput[];
}): Promise<void> {
  await AnomalyContributor.destroy({ where: { anomalyId } });
  if (contributors.length === 0) return;

  await AnomalyContributor.bulkCreate(
    contributors.map((entry) => ({
      anomalyId,
      dimensionType: entry.dimensionType,
      dimensionKey: entry.dimensionKey ?? null,
      dimensionValue: entry.dimensionValue ?? null,
      contributionCost:
        entry.contributionCost === undefined || entry.contributionCost === null
          ? null
          : toFixedString(entry.contributionCost, 6),
      contributionPercent:
        entry.contributionPercent === undefined || entry.contributionPercent === null
          ? null
          : toFixedString(entry.contributionPercent, 4),
      rank: entry.rank ?? null,
    })),
  );
}

const buildContributors = (candidate: S3CostSpikeCandidate): ContributorInput[] => {
  const contributors: ContributorInput[] = [
    {
      dimensionType: "s3_cost_category",
      dimensionValue: candidate.anomalyType,
      contributionCost: candidate.deltaCost,
      contributionPercent: 100,
      rank: 1,
    },
  ];

  if (candidate.regionKey) {
    contributors.push({
      dimensionType: "region",
      dimensionKey: candidate.regionKey,
      rank: 2,
    });
  }

  if (candidate.subAccountKey) {
    contributors.push({
      dimensionType: "sub_account",
      dimensionKey: candidate.subAccountKey,
      rank: 3,
    });
  }

  return contributors;
};

async function upsertDetectedCandidates(input: S3CostSpikeLifecycleInput): Promise<{
  created: number;
  updated: number;
  detectedFingerprints: string[];
}> {
  const now = new Date();
  const serviceKey = await resolveS3ServiceKey();
  const resourceKeyByBucket = await resolveResourceKeysByBucketName({
    tenantId: input.tenantId,
    bucketNames: input.candidates
      .map((candidate) => candidate.bucketName)
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0),
  });
  const detectedFingerprints = input.candidates.map((candidate) =>
    buildFingerprint({
      tenantId: input.tenantId,
      billingSourceId: input.billingSourceId,
      usageDate: candidate.usageDate,
      anomalyType: candidate.anomalyType,
    }),
  );

  const existingByFingerprint = new Map<string, InstanceType<typeof FactAnomalies>>();
  if (detectedFingerprints.length > 0) {
    const existing = await FactAnomalies.findAll({
      where: {
        fingerprint: {
          [Op.in]: detectedFingerprints,
        },
      },
    });
    for (const row of existing) {
      if (row.fingerprint) {
        existingByFingerprint.set(String(row.fingerprint), row);
      }
    }
  }

  let created = 0;
  let updated = 0;

  for (const candidate of input.candidates) {
    const fingerprint = buildFingerprint({
      tenantId: input.tenantId,
      billingSourceId: input.billingSourceId,
      usageDate: candidate.usageDate,
      anomalyType: candidate.anomalyType,
    });
    const existing = existingByFingerprint.get(fingerprint);
    const normalizedBucket = String(candidate.bucketName ?? "").trim();
    const resourceKey =
      normalizedBucket.length > 0
        ? resourceKeyByBucket.get(normalizedBucket) ??
          resourceKeyByBucket.get(`arn:aws:s3:::${normalizedBucket}`) ??
          resourceKeyByBucket.get(`s3://${normalizedBucket}`) ??
          null
        : null;

    const patch = {
      tenantId: input.tenantId,
      cloudConnectionId: input.cloudConnectionId,
      billingSourceId: input.billingSourceId,
      serviceKey,
      resourceKey,
      detectedAt: now,
      usageDate: candidate.usageDate,
      anomalyType: candidate.anomalyType,
      anomalyScope: ANOMALY_SCOPE,
      baselineType: BASELINE_TYPE,
      sourceGranularity: SOURCE_GRANULARITY,
      sourceTable: SOURCE_TABLE,
      expectedCost: toFixedString(candidate.expectedCost, 6),
      actualCost: toFixedString(candidate.actualCost, 6),
      deltaCost: toFixedString(candidate.deltaCost, 6),
      deltaPercent: toFixedString(candidate.deltaPercent * 100, 4),
      confidenceScore: toConfidenceScore(candidate.severity),
      subAccountKey: candidate.subAccountKey,
      regionKey: candidate.regionKey,
      severity: candidate.severity,
      rootCauseHint: candidate.description,
      explanationJson: {
        detector: "s3_cost_spike",
        insightTitle: candidate.anomalyType,
        insightDescription: candidate.description,
        recommendation: candidate.recommendation,
        historyCount: candidate.historyCount,
      },
      metadataJson: {
        detectionRunId: input.runId,
        detector: "s3_cost_spike",
        insightTitle: candidate.anomalyType,
        recommendation: candidate.recommendation,
      },
      lastSeenAt: now,
      fingerprint,
    };

    if (!existing) {
      const createdRow = await FactAnomalies.create({
        ...patch,
        status: "open",
        firstSeenAt: now,
        resolvedAt: null,
      });
      await replaceContributorsForAnomaly({
        anomalyId: String(createdRow.id),
        contributors: buildContributors(candidate),
      });
      created += 1;
      continue;
    }

    const existingStatus = String(existing.status ?? "open");
    const shouldReopen = existingStatus === "resolved";
    const shouldKeepIgnored = existingStatus === "ignored";
    await existing.update({
      ...patch,
      firstSeenAt: existing.firstSeenAt ?? now,
      status: shouldKeepIgnored ? "ignored" : shouldReopen ? "open" : existingStatus,
      resolvedAt: shouldReopen ? null : existing.resolvedAt,
    });
    await replaceContributorsForAnomaly({
      anomalyId: String(existing.id),
      contributors: buildContributors(candidate),
    });
    updated += 1;
  }

  return {
    created,
    updated,
    detectedFingerprints,
  };
}

async function resolveMissingOpenAnomaliesInScope(input: {
  billingSourceId: string;
  cloudConnectionId: string | null;
  effectiveDateFrom: string | null;
  effectiveDateTo: string | null;
  detectedFingerprints: string[];
}): Promise<number> {
  if (!input.effectiveDateFrom || !input.effectiveDateTo) {
    return 0;
  }

  const openRows = await FactAnomalies.findAll({
    where: {
      billingSourceId: input.billingSourceId,
      cloudConnectionId: input.cloudConnectionId ?? { [Op.is]: null },
      anomalyType: { [Op.in]: ANOMALY_TYPES },
      anomalyScope: ANOMALY_SCOPE,
      sourceGranularity: SOURCE_GRANULARITY,
      sourceTable: SOURCE_TABLE,
      status: "open",
      usageDate: { [Op.between]: [input.effectiveDateFrom, input.effectiveDateTo] },
    },
  });

  const seen = new Set(input.detectedFingerprints);
  const now = new Date();
  let resolved = 0;

  for (const row of openRows) {
    const rowFingerprint = row.fingerprint ? String(row.fingerprint) : null;
    if (rowFingerprint && seen.has(rowFingerprint)) continue;

    await row.update({
      status: "resolved",
      resolvedAt: now,
    });
    resolved += 1;
  }

  return resolved;
}

export async function applyS3CostSpikeLifecycle(
  input: S3CostSpikeLifecycleInput,
): Promise<S3CostSpikeLifecycleResult> {
  const upsertResult = await upsertDetectedCandidates(input);
  const resolved = await resolveMissingOpenAnomaliesInScope({
    billingSourceId: input.billingSourceId,
    cloudConnectionId: input.cloudConnectionId,
    effectiveDateFrom: input.effectiveDateFrom,
    effectiveDateTo: input.effectiveDateTo,
    detectedFingerprints: upsertResult.detectedFingerprints,
  });

  return {
    created: upsertResult.created,
    updated: upsertResult.updated,
    resolved,
    detectedFingerprints: upsertResult.detectedFingerprints,
  };
}
