import { Op } from "sequelize";

import { AnomalyContributor, FactAnomalies } from "../../../models/index.js";

import { buildEc2InstanceCostSpikeFingerprint } from "./anomaly-fingerprint.js";
import type { Ec2InstanceCostSpikeCandidate } from "./ec2-instance-cost-spike.detector.js";

const BASELINE_TYPE = "rolling_7d";
const SOURCE_GRANULARITY = "daily";
const SOURCE_TABLE = "fact_ec2_instance_daily";
const ANOMALY_SCOPE = "resource";
const EC2_ANOMALY_TYPES = ["new_high_cost_instance", "sudden_cost_spike", "cost_drop"] as const;

type Ec2InstanceCostSpikeLifecycleInput = {
  runId: string;
  billingSourceId: string;
  tenantId: string | null;
  cloudConnectionId: string | null;
  effectiveDateFrom: string | null;
  effectiveDateTo: string | null;
  candidates: Ec2InstanceCostSpikeCandidate[];
};

export type Ec2InstanceCostSpikeLifecycleResult = {
  created: number;
  updated: number;
  resolved: number;
  detectedFingerprints: string[];
};

const toFixedString = (value: number, scale: number): string => value.toFixed(scale);
const toConfidenceScore = (severity: "low" | "medium" | "high"): string =>
  severity === "high" ? "95.00" : severity === "medium" ? "80.00" : "65.00";

const toRootCauseHint = (candidate: Ec2InstanceCostSpikeCandidate): string =>
  candidate.anomalyType === "cost_drop"
    ? `EC2 instance ${candidate.instanceId} cost dropped by ${Math.round(candidate.deltaPercent * 100)}% versus rolling 7-day baseline`
    : `EC2 instance ${candidate.instanceId} cost spiked by ${Math.round(candidate.deltaPercent * 100)}% versus rolling 7-day baseline`;

const buildFingerprint = ({
  tenantId,
  billingSourceId,
  cloudConnectionId,
  usageDate,
  instanceId,
  anomalyType,
}: {
  tenantId: string | null;
  billingSourceId: string;
  cloudConnectionId: string | null;
  usageDate: string;
  instanceId: string;
  anomalyType: string;
}): string =>
  buildEc2InstanceCostSpikeFingerprint({
    tenantId,
    billingSourceId,
    cloudConnectionId,
    usageDate,
    instanceId,
    anomalyType,
    sourceGranularity: SOURCE_GRANULARITY,
    sourceTable: SOURCE_TABLE,
    anomalyScope: ANOMALY_SCOPE,
  });

type ContributorInput = {
  dimensionType: string;
  dimensionKey?: string | null;
  dimensionValue?: string | null;
  contributionCost?: number | null;
  contributionPercent?: number | null;
  rank?: number | null;
};

async function replaceContributorsForAnomaly({
  anomalyId,
  contributors,
}: {
  anomalyId: string;
  contributors: ContributorInput[];
}): Promise<void> {
  await AnomalyContributor.destroy({
    where: {
      anomalyId,
    },
  });

  if (contributors.length === 0) {
    return;
  }

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

const buildContributors = (candidate: Ec2InstanceCostSpikeCandidate): ContributorInput[] => {
  const contributors: ContributorInput[] = [
    {
      dimensionType: "instance_id",
      dimensionValue: candidate.instanceId,
      contributionCost: candidate.deltaCost,
      contributionPercent: 100,
      rank: 1,
    },
  ];

  if (candidate.resourceKey) {
    contributors.push({
      dimensionType: "resource",
      dimensionKey: candidate.resourceKey,
      contributionCost: candidate.deltaCost,
      contributionPercent: 100,
      rank: 2,
    });
  }

  if (candidate.regionKey) {
    contributors.push({
      dimensionType: "region",
      dimensionKey: candidate.regionKey,
      rank: 3,
    });
  }

  if (candidate.subAccountKey) {
    contributors.push({
      dimensionType: "sub_account",
      dimensionKey: candidate.subAccountKey,
      rank: 4,
    });
  }

  return contributors;
};

async function upsertDetectedCandidates(input: Ec2InstanceCostSpikeLifecycleInput): Promise<{
  created: number;
  updated: number;
  detectedFingerprints: string[];
}> {
  const now = new Date();
  const detectedFingerprints = input.candidates.map((candidate) =>
    buildFingerprint({
      tenantId: input.tenantId,
      billingSourceId: input.billingSourceId,
      cloudConnectionId: input.cloudConnectionId,
      usageDate: candidate.usageDate,
      instanceId: candidate.instanceId,
      anomalyType: candidate.anomalyType,
    }),
  );
  const candidateFingerprintsForLookup = Array.from(
    new Set(
      input.candidates.flatMap((candidate) =>
        EC2_ANOMALY_TYPES.map((anomalyType) =>
          buildFingerprint({
            tenantId: input.tenantId,
            billingSourceId: input.billingSourceId,
            cloudConnectionId: input.cloudConnectionId,
            usageDate: candidate.usageDate,
            instanceId: candidate.instanceId,
            anomalyType,
          }),
        ),
      ),
    ),
  );

  const existingByFingerprint = new Map<string, InstanceType<typeof FactAnomalies>>();
  if (candidateFingerprintsForLookup.length > 0) {
    const existing = await FactAnomalies.findAll({
      where: {
        fingerprint: {
          [Op.in]: candidateFingerprintsForLookup,
        },
      },
    });

    for (const row of existing) {
      if (row.fingerprint) {
        existingByFingerprint.set(row.fingerprint, row);
      }
    }
  }

  let created = 0;
  let updated = 0;

  for (const candidate of input.candidates) {
    const fingerprint = buildFingerprint({
      tenantId: input.tenantId,
      billingSourceId: input.billingSourceId,
      cloudConnectionId: input.cloudConnectionId,
      usageDate: candidate.usageDate,
      instanceId: candidate.instanceId,
      anomalyType: candidate.anomalyType,
    });

    const companionAnomalyType =
      candidate.anomalyType === "new_high_cost_instance"
        ? "sudden_cost_spike"
        : candidate.anomalyType === "sudden_cost_spike"
          ? "new_high_cost_instance"
          : "cost_drop";
    const companionFingerprint = buildFingerprint({
      tenantId: input.tenantId,
      billingSourceId: input.billingSourceId,
      cloudConnectionId: input.cloudConnectionId,
      usageDate: candidate.usageDate,
      instanceId: candidate.instanceId,
      anomalyType: companionAnomalyType,
    });

    const existing = existingByFingerprint.get(fingerprint) ?? existingByFingerprint.get(companionFingerprint);

    const patch = {
      tenantId: input.tenantId,
      cloudConnectionId: input.cloudConnectionId,
      billingSourceId: input.billingSourceId,
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
      resourceKey: candidate.resourceKey,
      regionKey: candidate.regionKey,
      subAccountKey: candidate.subAccountKey,
      severity: candidate.severity,
      rootCauseHint: toRootCauseHint(candidate),
      explanationJson: {
        detector: "ec2_instance_cost_spike",
        baseline: "rolling_7d_median",
        historyCount: candidate.historyCount,
        instanceId: candidate.instanceId,
      },
      metadataJson: {
        detectionRunId: input.runId,
        detector: "ec2_instance_cost_spike",
        historyCount: candidate.historyCount,
        instanceId: candidate.instanceId,
      },
      lastSeenAt: now,
      fingerprint,
    };

    if (!existing) {
      const firstSeenAt = now;
      const lastSeenAt = now;
      const createdRow = await FactAnomalies.create({
        ...patch,
        status: "open",
        firstSeenAt,
        lastSeenAt,
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
    const firstSeenAt = existing.firstSeenAt ?? now;
    const lastSeenAt = now;

    await existing.update({
      ...patch,
      firstSeenAt,
      lastSeenAt,
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

  const openRowsInScope = await FactAnomalies.findAll({
    where: {
      billingSourceId: input.billingSourceId,
      cloudConnectionId: input.cloudConnectionId ?? { [Op.is]: null },
      anomalyType: {
        [Op.in]: ["new_high_cost_instance", "sudden_cost_spike", "cost_drop"],
      },
      anomalyScope: ANOMALY_SCOPE,
      sourceGranularity: SOURCE_GRANULARITY,
      sourceTable: SOURCE_TABLE,
      status: "open",
      usageDate: {
        [Op.between]: [input.effectiveDateFrom, input.effectiveDateTo],
      },
    },
  });

  const seenFingerprints = new Set(input.detectedFingerprints);
  const now = new Date();
  let resolved = 0;

  for (const row of openRowsInScope) {
    const rowFingerprint = row.fingerprint ? String(row.fingerprint) : null;
    if (rowFingerprint && seenFingerprints.has(rowFingerprint)) {
      continue;
    }

    await row.update({
      status: "resolved",
      resolvedAt: now,
    });

    resolved += 1;
  }

  return resolved;
}

export async function applyEc2InstanceCostSpikeLifecycle(
  input: Ec2InstanceCostSpikeLifecycleInput,
): Promise<Ec2InstanceCostSpikeLifecycleResult> {
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

export const ec2InstanceCostSpikeLifecycleScope = {
  anomalyType: "new_high_cost_instance_or_sudden_cost_spike_or_cost_drop",
  anomalyScope: ANOMALY_SCOPE,
  baselineType: BASELINE_TYPE,
  sourceGranularity: SOURCE_GRANULARITY,
  sourceTable: SOURCE_TABLE,
};
