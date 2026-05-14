import {
  DB_RECOMMENDATION_WARNING_CODES,
  buildDataQualityWarning,
  buildDbRecommendationMetadata,
} from "../builders/db-recommendation-evidence.builder.js";
import type { DbRecommendationCandidate } from "../types/db-recommendations.types.js";
import type { DbRecommendationRule } from "./index.js";

const MIN_TOTAL_COST = 10;
const MIN_USAGE_DAYS = 7;
const LOW_CPU_AVG_THRESHOLD = 5;
const LOW_CPU_MAX_THRESHOLD = 15;
const LOW_CONNECTIONS_AVG_THRESHOLD = 1;
const LOW_CONNECTIONS_MAX_THRESHOLD = 3;
const MIN_TELEMETRY_DAYS_FOR_MEDIUM_CONFIDENCE = 7;

const isRelationalDbService = (value: string | null | undefined): boolean => {
  const normalized = (value ?? "").toLowerCase();
  return normalized.includes("rds") || normalized.includes("aurora") || normalized.includes("amazonrds");
};

const asNumber = (value: number | null | undefined): number | null => {
  if (value == null) return null;
  return Number.isFinite(value) ? value : null;
};

const isLowOrMissing = (value: number | null, threshold: number): boolean => value == null || value <= threshold;

export const generateDbIdleCandidateRecommendations: DbRecommendationRule = async ({ resources }) => {
  const candidates: DbRecommendationCandidate[] = [];

  for (const resource of resources) {
    if (!resource.cloudConnectionId) continue;
    if (!isRelationalDbService(resource.dbService)) continue;

    const totalCost = asNumber(resource.totalEffectiveCost) ?? 0;
    if (totalCost < MIN_TOTAL_COST) continue;

    const usageDays = resource.usageDays ?? 0;
    if (usageDays < MIN_USAGE_DAYS) continue;

    const cpuAvg = asNumber(resource.cpuAvg);
    const cpuMax = asNumber(resource.cpuMax);
    const connectionsAvg = asNumber(resource.connectionsAvg);
    const connectionsMax = asNumber(resource.connectionsMax);
    const readIopsAvg = asNumber(resource.readIopsAvg);
    const writeIopsAvg = asNumber(resource.writeIopsAvg);

    const telemetryDays = resource.telemetryDays ?? 0;
    const telemetryUsable = resource.hasTelemetry && telemetryDays >= MIN_TELEMETRY_DAYS_FOR_MEDIUM_CONFIDENCE;

    const lowCpu = isLowOrMissing(cpuAvg, LOW_CPU_AVG_THRESHOLD) && isLowOrMissing(cpuMax, LOW_CPU_MAX_THRESHOLD);
    const lowConnections = isLowOrMissing(connectionsAvg, LOW_CONNECTIONS_AVG_THRESHOLD) && isLowOrMissing(connectionsMax, LOW_CONNECTIONS_MAX_THRESHOLD);
    const lowIops = isLowOrMissing(readIopsAvg, 5) && isLowOrMissing(writeIopsAvg, 5);

    const clearHighActivity =
      (cpuAvg != null && cpuAvg > LOW_CPU_AVG_THRESHOLD) ||
      (cpuMax != null && cpuMax > LOW_CPU_MAX_THRESHOLD) ||
      (connectionsAvg != null && connectionsAvg > LOW_CONNECTIONS_AVG_THRESHOLD) ||
      (connectionsMax != null && connectionsMax > LOW_CONNECTIONS_MAX_THRESHOLD) ||
      (readIopsAvg != null && readIopsAvg > 5) ||
      (writeIopsAvg != null && writeIopsAvg > 5);

    if (clearHighActivity) continue;

    const hasAtLeastOneLowSignal =
      (cpuAvg != null && cpuAvg <= LOW_CPU_AVG_THRESHOLD) ||
      (cpuMax != null && cpuMax <= LOW_CPU_MAX_THRESHOLD) ||
      (connectionsAvg != null && connectionsAvg <= LOW_CONNECTIONS_AVG_THRESHOLD) ||
      (connectionsMax != null && connectionsMax <= LOW_CONNECTIONS_MAX_THRESHOLD) ||
      (readIopsAvg != null && readIopsAvg <= 5) ||
      (writeIopsAvg != null && writeIopsAvg <= 5);

    const mediumPath = telemetryUsable && lowCpu && lowConnections && hasAtLeastOneLowSignal;
    const lowPath = !telemetryUsable && usageDays >= MIN_USAGE_DAYS;

    if (!mediumPath && !lowPath) continue;

    const billingSignals = [
      {
        key: "total_db_cost_lookback",
        label: "Total DB Cost Over Lookback",
        value: totalCost,
        source: "fact_db_resource_daily",
      },
      {
        key: "billing_usage_days",
        label: "Billing Usage Days",
        value: usageDays,
        source: "fact_db_resource_daily",
      },
      {
        key: "latest_usage_date",
        label: "Latest Usage Date",
        value: resource.latestUsageDate,
        source: "fact_db_resource_daily",
      },
      {
        key: "telemetry_days_available",
        label: "Telemetry Days Available",
        value: telemetryDays,
        source: "db_utilization_daily",
      },
    ];

    const inventorySignals = resource.hasInventory
      ? [
          {
            key: "allocated_storage_gb",
            label: "Allocated Storage (GB)",
            value: resource.allocatedStorageGb,
            source: "db_resource_inventory_snapshots",
          },
        ]
      : [];

    const telemetrySignals = resource.hasTelemetry
      ? [
          {
            key: "cpu_avg",
            label: "Average CPU Utilization",
            value: cpuAvg,
            source: "db_utilization_daily",
          },
          {
            key: "cpu_max",
            label: "Maximum CPU Utilization",
            value: cpuMax,
            source: "db_utilization_daily",
          },
          {
            key: "connections_avg",
            label: "Average Connections",
            value: connectionsAvg,
            source: "db_utilization_daily",
          },
          {
            key: "connections_max",
            label: "Maximum Connections",
            value: connectionsMax,
            source: "db_utilization_daily",
          },
          {
            key: "read_iops_avg",
            label: "Average Read IOPS",
            value: readIopsAvg,
            source: "db_utilization_daily",
          },
          {
            key: "write_iops_avg",
            label: "Average Write IOPS",
            value: writeIopsAvg,
            source: "db_utilization_daily",
          },
        ]
      : [];

    const signalsMissing = [];

    if (cpuAvg == null || cpuMax == null) {
      signalsMissing.push({
        key: "cpu_utilization",
        label: "CPU Utilization",
        reason: "CPU telemetry is missing or sparse for the selected lookback.",
      });
    }

    if (connectionsAvg == null || connectionsMax == null) {
      signalsMissing.push({
        key: "connection_metrics",
        label: "Connection Metrics",
        reason: "Connection telemetry is missing or sparse for the selected lookback.",
      });
    }

    if (readIopsAvg == null && writeIopsAvg == null) {
      signalsMissing.push({
        key: "io_activity_metrics",
        label: "IO Activity Metrics",
        reason: "Read/write IOPS telemetry is missing for the selected lookback.",
      });
    }

    if (!resource.hasInventory) {
      signalsMissing.push({
        key: "inventory_status",
        label: "Inventory Status",
        reason: "Current inventory status is unavailable for this resource.",
      });
    }

    signalsMissing.push({
      key: "workload_ownership_context",
      label: "Workload Ownership Context",
      reason: "Business ownership and criticality context must be confirmed before action.",
    });

    const warnings = [
      buildDataQualityWarning({
        code: DB_RECOMMENDATION_WARNING_CODES.ESTIMATED_SAVINGS_NOT_AVAILABLE,
        message:
          "Savings are not estimated in v1; confirm workload ownership, availability requirements, backup policy, and safe decommission/stop behavior.",
        severity: "info",
      }),
    ];

    if (!resource.hasTelemetry || telemetryDays < MIN_TELEMETRY_DAYS_FOR_MEDIUM_CONFIDENCE) {
      warnings.push(
        buildDataQualityWarning({
          code: DB_RECOMMENDATION_WARNING_CODES.MISSING_TELEMETRY,
          message: "Telemetry is missing or too sparse for strong idle-confidence validation.",
          severity: "warning",
        }),
      );
    }

    const metadataJson = buildDbRecommendationMetadata({
      recommendationType: "DB_IDLE_CANDIDATE",
      ruleId: "db-idle-candidate",
      ruleVersion: "1.0.0",
      lookbackStart: resource.lookbackStart,
      lookbackEnd: resource.lookbackEnd,
      lineage: {
        tenant_id: resource.tenantId,
        cloud_connection_id: resource.cloudConnectionId,
        resource_id: resource.resourceId,
        provider: "AWS",
        service: "AmazonRDS",
        resource_type: resource.resourceType,
        region: resource.awsRegionCode,
        account_id: resource.awsAccountId,
      },
      billingSignals,
      inventorySignals,
      telemetrySignals,
      signalsMissing,
      costBreakdown: {
        currency: resource.currencyCode ?? "USD",
        lookback_days: 30,
        total_cost: totalCost,
        storage_cost: asNumber(resource.storageCost),
        compute_cost: asNumber(resource.computeCost),
        backup_cost: asNumber(resource.backupCost),
        io_cost: asNumber(resource.ioCost),
        other_cost: asNumber(resource.otherCost),
      },
      savingsAssumptions: {
        estimated_monthly_savings: null,
        estimated_savings_percent: null,
        basis: "not_estimated",
        calculation_notes: [
          "Savings require confirming workload ownership, availability requirements, backup/retention policy, and safe decommission/stop behavior.",
        ],
      },
      dataQualityWarnings: warnings,
      sourceTables: [
        "fact_db_resource_daily",
        "db_cost_history_daily",
        "db_resource_inventory_snapshots",
        "db_utilization_daily",
      ],
    });

    candidates.push({
      tenantId: resource.tenantId,
      cloudConnectionId: resource.cloudConnectionId,
      billingSourceId: resource.billingSourceId,
      awsAccountId: resource.awsAccountId ?? "unknown",
      awsRegionCode: resource.awsRegionCode,
      resourceId: resource.resourceId,
      resourceArn: resource.resourceArn,
      resourceName: resource.resourceName,
      resourceType: resource.resourceType,
      recommendationType: "DB_IDLE_CANDIDATE",
      recommendationTitle: "Review possible idle database resource",
      recommendationText:
        "This database resource shows continued spend with limited or missing activity evidence during the lookback window. Validate workload ownership, connection activity, and business criticality before taking action.",
      estimatedMonthlySavings: 0,
      currentMonthlyCost: totalCost,
      projectedMonthlyCost: totalCost,
      metadataJson,
    });
  }

  return candidates;
};

export const DB_IDLE_CANDIDATE_THRESHOLDS = {
  MIN_TOTAL_COST,
  MIN_USAGE_DAYS,
  LOW_CPU_AVG_THRESHOLD,
  LOW_CPU_MAX_THRESHOLD,
  LOW_CONNECTIONS_AVG_THRESHOLD,
  LOW_CONNECTIONS_MAX_THRESHOLD,
  MIN_TELEMETRY_DAYS_FOR_MEDIUM_CONFIDENCE,
} as const;
