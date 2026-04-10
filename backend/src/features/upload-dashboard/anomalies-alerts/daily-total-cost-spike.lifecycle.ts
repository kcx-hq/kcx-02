import { Op } from "sequelize";

import { FactAnomalies } from "../../../models/index.js";

import { buildDailyTotalCostSpikeFingerprint } from "./anomaly-fingerprint.js";
import type { DailyTotalCostSpikeCandidate } from "./daily-total-cost-spike.detector.js";

const ANOMALY_TYPE = "spike";
const BASELINE_TYPE = "rolling_7d";
const SOURCE_GRANULARITY = "daily";
const SOURCE_TABLE = "agg_cost_daily";
const DETECTOR_SCOPE = "source_total_daily";

type DailySpikeLifecycleInput = {
  runId: string;
  billingSourceId: string;
  tenantId: string | null;
  cloudConnectionId: string | null;
  effectiveDateFrom: string | null;
  effectiveDateTo: string | null;
  candidates: DailyTotalCostSpikeCandidate[];
};

export type DailySpikeLifecycleResult = {
  created: number;
  updated: number;
  resolved: number;
  detectedFingerprints: string[];
};

const toFixedString = (value: number, scale: number): string => value.toFixed(scale);

const toRootCauseHint = (candidate: DailyTotalCostSpikeCandidate): string =>
  `Daily total billed cost spiked by ${Math.round(candidate.deltaPercent * 100)}% versus rolling 7-day median baseline`;

const buildFingerprint = ({
  tenantId,
  billingSourceId,
  usageDate,
}: {
  tenantId: string | null;
  billingSourceId: string;
  usageDate: string;
}): string =>
  buildDailyTotalCostSpikeFingerprint({
    tenantId,
    billingSourceId,
    usageDate,
    anomalyType: ANOMALY_TYPE,
    sourceGranularity: SOURCE_GRANULARITY,
    sourceTable: SOURCE_TABLE,
    detectorScope: DETECTOR_SCOPE,
  });

const buildLegacyFingerprint = ({
  billingSourceId,
  usageDate,
}: {
  billingSourceId: string;
  usageDate: string;
}): string => `daily_total_spike:${billingSourceId}:${usageDate}`;

async function upsertDetectedCandidates(input: DailySpikeLifecycleInput): Promise<{
  created: number;
  updated: number;
  detectedFingerprints: string[];
}> {
  const now = new Date();
  const detectedFingerprints = input.candidates.map((candidate) =>
    buildFingerprint({
      tenantId: input.tenantId,
      billingSourceId: input.billingSourceId,
      usageDate: candidate.usageDate,
    }),
  );
  const legacyFingerprints = input.candidates.map((candidate) =>
    buildLegacyFingerprint({
      billingSourceId: input.billingSourceId,
      usageDate: candidate.usageDate,
    }),
  );

  const existingByFingerprint = new Map<string, InstanceType<typeof FactAnomalies>>();
  if (detectedFingerprints.length > 0 || legacyFingerprints.length > 0) {
    const allCandidateFingerprints = Array.from(new Set([...detectedFingerprints, ...legacyFingerprints]));
    const existing = await FactAnomalies.findAll({
      where: {
        fingerprint: {
          [Op.in]: allCandidateFingerprints,
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
      usageDate: candidate.usageDate,
    });
    const legacyFingerprint = buildLegacyFingerprint({
      billingSourceId: input.billingSourceId,
      usageDate: candidate.usageDate,
    });

    const existing = existingByFingerprint.get(fingerprint) ?? existingByFingerprint.get(legacyFingerprint);

    const patch = {
      tenantId: input.tenantId,
      cloudConnectionId: input.cloudConnectionId ?? existing?.cloudConnectionId ?? null,
      billingSourceId: input.billingSourceId,
      detectedAt: now,
      usageDate: candidate.usageDate,
      expectedCost: toFixedString(candidate.expectedCost, 6),
      actualCost: toFixedString(candidate.actualCost, 6),
      deltaCost: toFixedString(candidate.deltaCost, 6),
      deltaPercent: toFixedString(candidate.deltaPercent * 100, 4),
      anomalyType: ANOMALY_TYPE,
      baselineType: BASELINE_TYPE,
      sourceGranularity: SOURCE_GRANULARITY,
      sourceTable: SOURCE_TABLE,
      anomalyScope: DETECTOR_SCOPE,
      severity: candidate.severity,
      rootCauseHint: toRootCauseHint(candidate),
      explanationJson: {
        detector: "daily_total_cost_spike",
        baseline: "rolling_7d_median",
        historyCount: candidate.historyCount,
      },
      metadataJson: {
        detectionRunId: input.runId,
        detector: "daily_total_cost_spike",
        historyCount: candidate.historyCount,
      },
      lastSeenAt: now,
      fingerprint,
    };

    if (!existing) {
      await FactAnomalies.create({
        ...patch,
        status: "open",
        firstSeenAt: now,
        resolvedAt: null,
      });
      created += 1;
      continue;
    }

    // Status preservation rules:
    // - open + detected again -> keep open
    // - resolved + detected again -> reopen to open
    // - ignored + detected again -> keep ignored (do not auto-open)
    const existingStatus = String(existing.status ?? "open");
    const shouldReopen = existingStatus === "resolved";
    const shouldKeepIgnored = existingStatus === "ignored";

    await existing.update({
      ...patch,
      firstSeenAt: existing.firstSeenAt ?? now,
      status: shouldKeepIgnored ? "ignored" : shouldReopen ? "open" : existingStatus,
      resolvedAt: shouldReopen ? null : existing.resolvedAt,
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
      anomalyType: ANOMALY_TYPE,
      sourceGranularity: SOURCE_GRANULARITY,
      sourceTable: SOURCE_TABLE,
      anomalyScope: DETECTOR_SCOPE,
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

export async function applyDailyTotalCostSpikeLifecycle(input: DailySpikeLifecycleInput): Promise<DailySpikeLifecycleResult> {
  const upsertResult = await upsertDetectedCandidates(input);

  const resolved = await resolveMissingOpenAnomaliesInScope({
    billingSourceId: input.billingSourceId,
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

export const dailyTotalCostSpikeLifecycleScope = {
  anomalyType: ANOMALY_TYPE,
  baselineType: BASELINE_TYPE,
  sourceGranularity: SOURCE_GRANULARITY,
  sourceTable: SOURCE_TABLE,
  detectorScope: DETECTOR_SCOPE,
};
