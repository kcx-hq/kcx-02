import { logger } from "../../../utils/logger.js";
import { ANOMALY_DETECTOR_CONFIGS } from "./anomaly-detector.config.js";
import { AnomalyRepository } from "./anomaly.repository.js";
import type {
  AnomalyRunnerSummary,
  DetectionCandidate,
  DetectorConfig,
  DetectorRunInput,
  DetectorRunStats,
} from "./anomaly.types.js";

const repository = new AnomalyRepository();

const todayDateIso = (): string => new Date().toISOString().slice(0, 10);

async function runDetector(config: DetectorConfig, input: DetectorRunInput): Promise<DetectorRunStats> {
  const usageDate = input.usageDate;
  if (!config.enabled) {
    return {
      detectorKey: config.key,
      anomalyType: config.anomalyType,
      enabled: config.enabled,
      implemented: config.implemented,
      examined: 0,
      inserted: 0,
      duplicatesSkipped: 0,
      failed: 0,
      skippedReason: "disabled",
    };
  }

  if (!config.implemented) {
    return {
      detectorKey: config.key,
      anomalyType: config.anomalyType,
      enabled: config.enabled,
      implemented: config.implemented,
      examined: 0,
      inserted: 0,
      duplicatesSkipped: 0,
      failed: 0,
      skippedReason: "not_implemented",
    };
  }

  let candidates: DetectionCandidate[] = [];
  switch (config.anomalyType) {
    case "cost_spike":
    case "cost_drop":
      candidates = await repository.findCostCandidatesByDimension({
        usageDate,
        config,
        dimension: "global",
      });
      break;
    case "service_cost_anomaly":
      candidates = await repository.findCostCandidatesByDimension({
        usageDate,
        config,
        dimension: "service",
      });
      break;
    case "region_cost_anomaly":
      candidates = await repository.findCostCandidatesByDimension({
        usageDate,
        config,
        dimension: "region",
      });
      break;
    case "sub_account_cost_anomaly":
      candidates = await repository.findCostCandidatesByDimension({
        usageDate,
        config,
        dimension: "sub_account",
      });
      break;
    case "tag_cost_anomaly":
      candidates = await repository.findTagCostCandidates({
        usageDate,
        config,
      });
      break;
    case "usage_spike":
    case "usage_drop":
      candidates = await repository.findUsageCandidates({
        usageDate,
        config,
      });
      break;
    case "usage_mismatch":
      candidates = await repository.findUsageMismatchCandidates({
        usageDate,
        config,
      });
      break;
    case "idle_cost":
      candidates = await repository.findIdleCostCandidates({
        usageDate,
        config,
      });
      break;
    default:
      candidates = [];
      break;
  }

  let inserted = 0;
  let duplicatesSkipped = 0;
  let failed = 0;

  for (const candidate of candidates) {
    try {
      const resolvedCloudConnectionId = candidate.cloudConnectionId ?? input.fallbackCloudConnectionId ?? null;
      if (!resolvedCloudConnectionId) {
        duplicatesSkipped += 1;
        continue;
      }
      const candidateWithConnection: DetectionCandidate = {
        ...candidate,
        cloudConnectionId: resolvedCloudConnectionId,
      };
      const rootCauseHint = await repository.findCloudTrailHint(candidateWithConnection);
      const insertedResult = await repository.insertAnomaly({
        config,
        candidate: candidateWithConnection,
        rootCauseHint,
        explanationJson: null,
        metadataJson: {
          detector_key: config.key,
          rule_type: config.ruleType,
          threshold_multiplier: config.thresholdMultiplier,
          min_absolute_delta: config.minAbsoluteDelta,
          min_expected_value: config.minExpectedValue,
        },
      });

      if (!insertedResult.inserted || !insertedResult.anomalyId) {
        duplicatesSkipped += 1;
        continue;
      }

      const contributors = await repository.buildContributors(config, candidateWithConnection);
      await repository.insertContributors(insertedResult.anomalyId, contributors);
      inserted += 1;
    } catch (error) {
      failed += 1;
      logger.error("Anomaly detector candidate processing failed", {
        detectorKey: config.key,
        anomalyType: config.anomalyType,
        usageDate,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    detectorKey: config.key,
    anomalyType: config.anomalyType,
    enabled: config.enabled,
    implemented: config.implemented,
    examined: candidates.length,
    inserted,
    duplicatesSkipped,
    failed,
  };
}

export async function runAnomalyDetectorsForDate(
  usageDate: string,
  options?: { fallbackCloudConnectionId?: string },
): Promise<AnomalyRunnerSummary> {
  const detectorStats: DetectorRunStats[] = [];
  for (const detectorConfig of ANOMALY_DETECTOR_CONFIGS) {
    logger.info("Anomaly detector start", {
      detectorKey: detectorConfig.key,
      anomalyType: detectorConfig.anomalyType,
      usageDate,
    });
    const stats = await runDetector(detectorConfig, {
      usageDate,
      ...(options?.fallbackCloudConnectionId
        ? { fallbackCloudConnectionId: options.fallbackCloudConnectionId }
        : {}),
    });
    detectorStats.push(stats);
    logger.info("Anomaly detector finish", {
      detectorKey: detectorConfig.key,
      anomalyType: detectorConfig.anomalyType,
      usageDate,
      examined: stats.examined,
      inserted: stats.inserted,
      duplicatesSkipped: stats.duplicatesSkipped,
      failed: stats.failed,
      skippedReason: stats.skippedReason ?? null,
    });
  }

  return {
    usageDate,
    detectorsRun: detectorStats.length,
    examined: detectorStats.reduce((sum, item) => sum + item.examined, 0),
    anomaliesInserted: detectorStats.reduce((sum, item) => sum + item.inserted, 0),
    duplicatesSkipped: detectorStats.reduce((sum, item) => sum + item.duplicatesSkipped, 0),
    failures: detectorStats.reduce((sum, item) => sum + item.failed, 0),
    detectorStats,
  };
}

export async function runAllAnomalyDetectors(): Promise<AnomalyRunnerSummary> {
  const usageDate = todayDateIso();
  return runAnomalyDetectorsForDate(usageDate);
}

export { ANOMALY_DETECTOR_CONFIGS };
