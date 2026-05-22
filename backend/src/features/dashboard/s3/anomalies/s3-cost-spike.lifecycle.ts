import { Op, QueryTypes } from "sequelize";

import { AnomalyContributor, FactAnomalies } from "../../../../models/index.js";
import { sequelize } from "../../../../models/index.js";

import type { S3CostSpikeAnomalyType, S3CostSpikeCandidate } from "./s3-cost-spike.detector.js";

const BASELINE_TYPE = "rolling_7d";
const SOURCE_GRANULARITY = "daily";
const SOURCE_TABLE = "s3_cost_daily";
const SOURCE_TABLES = ["s3_cost_daily", "s3_storage_lens_daily", "s3_bucket_config_snapshot"] as const;
const ANOMALY_SCOPE = "service_category";
const ANOMALY_TYPES: S3CostSpikeAnomalyType[] = [
  "S3_STORAGE_COST_SPIKE",
  "S3_DATA_TRANSFER_COST_SPIKE",
  "S3_REQUEST_COST_SPIKE",
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

const toInsightTitle = (anomalyType: S3CostSpikeAnomalyType): string => {
  if (anomalyType === "S3_STORAGE_COST_SPIKE") return "S3 Storage Cost Spike";
  if (anomalyType === "S3_DATA_TRANSFER_COST_SPIKE") return "S3 Data Transfer Spike";
  if (anomalyType === "S3_REQUEST_COST_SPIKE") return "S3 Request Cost Spike";
  return anomalyType;
};

const toInsightDescription = (candidate: S3CostSpikeCandidate): string => {
  const percentage = Number.isFinite(candidate.deltaPercent) ? Math.max(0, candidate.deltaPercent * 100) : 0;
  const roundedPercent = Math.round(percentage);
  if (candidate.anomalyType === "S3_STORAGE_COST_SPIKE") {
    return `S3 storage cost increased by ${roundedPercent}% compared to normal daily usage.`;
  }
  if (candidate.anomalyType === "S3_DATA_TRANSFER_COST_SPIKE") {
    return "Unexpected increase in S3 internet egress traffic detected.";
  }
  if (candidate.anomalyType === "S3_REQUEST_COST_SPIKE") {
    return "S3 API request charges significantly exceeded baseline usage.";
  }
  return candidate.description;
};

const buildFingerprint = ({
  tenantId,
  billingSourceId,
  usageDate,
  anomalyType,
  subAccountId,
  regionKey,
}: {
  tenantId: string | null;
  billingSourceId: string;
  usageDate: string;
  anomalyType: S3CostSpikeAnomalyType;
  subAccountId: string | null;
  regionKey: string | null;
}): string =>
  `s3_spike:${normalize(tenantId) || "none"}:${normalize(billingSourceId)}:${normalize(subAccountId) || "unknown_account"}:${normalize(regionKey) || "global_unknown"}:${normalize(usageDate)}:${normalize(anomalyType)}`;

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
  const detectedFingerprints = input.candidates.map((candidate) =>
    buildFingerprint({
      tenantId: input.tenantId,
      billingSourceId: input.billingSourceId,
      usageDate: candidate.usageDate,
      anomalyType: candidate.anomalyType,
      subAccountId: candidate.subAccountId,
      regionKey: candidate.regionKey,
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
      subAccountId: candidate.subAccountId,
      regionKey: candidate.regionKey,
    });
    const existing = existingByFingerprint.get(fingerprint);

    const patch = {
      tenantId: input.tenantId,
      cloudConnectionId: input.cloudConnectionId,
      billingSourceId: input.billingSourceId,
      serviceKey,
      resourceKey: null,
      detectedAt: now,
      usageDate: candidate.usageDate,
      anomalyType: candidate.anomalyType,
      anomalyScope: ANOMALY_SCOPE,
      baselineType: BASELINE_TYPE,
      sourceGranularity: SOURCE_GRANULARITY,
      sourceTable: candidate.sourceTable ?? SOURCE_TABLE,
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
        insightTitle: toInsightTitle(candidate.anomalyType),
        insightDescription: toInsightDescription(candidate),
        recommendation: candidate.recommendation,
        historyCount: candidate.historyCount,
        region: candidate.regionName ?? "Global/Unknown",
        usageType: candidate.usageType ?? null,
      },
      metadataJson: {
        detectionRunId: input.runId,
        detector: "s3_cost_spike",
        insightTitle: toInsightTitle(candidate.anomalyType),
        recommendation: candidate.recommendation,
        anomalyKey: [
          candidate.subAccountId ?? "unknown_account",
          "amazon_s3",
          candidate.regionKey ?? "global_unknown",
          candidate.anomalyType,
          candidate.usageDate,
        ].join("|"),
        subAccountId: candidate.subAccountId ?? null,
        subAccountName: candidate.subAccountName ?? null,
        accountId: candidate.accountId ?? candidate.subAccountId ?? null,
        bucketName: candidate.bucketName ?? null,
        regionName: candidate.regionName ?? "Global/Unknown",
        usageType: candidate.usageType ?? null,
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
      sourceTable: {
        [Op.in]: SOURCE_TABLES as unknown as string[],
      },
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
