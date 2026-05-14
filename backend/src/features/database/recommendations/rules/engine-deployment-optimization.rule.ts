import {
  DB_RECOMMENDATION_WARNING_CODES,
  buildDataQualityWarning,
  buildDbRecommendationMetadata,
} from "../builders/db-recommendation-evidence.builder.js";
import type { DbRecommendationCandidate } from "../types/db-recommendations.types.js";
import type { DbRecommendationRule } from "./index.js";

const MIN_TOTAL_COST = 15;
const MIN_USAGE_DAYS = 7;
const MIN_TELEMETRY_DAYS_FOR_ACTIVITY_CONTEXT = 7;
const LOW_ACTIVITY_CPU_AVG_THRESHOLD = 10;
const LOW_ACTIVITY_CONNECTIONS_AVG_THRESHOLD = 2;

const isRelationalDbService = (value: string | null | undefined): boolean => {
  const normalized = (value ?? "").toLowerCase();
  return normalized.includes("rds") || normalized.includes("aurora") || normalized.includes("amazonrds");
};

const asNumber = (value: number | null | undefined): number | null => {
  if (value == null) return null;
  return Number.isFinite(value) ? value : null;
};

const buildEngineDeploymentEvidence = (resource: {
  dbService: string | null;
  dbEngine: string | null;
  resourceType: string | null;
  instanceClass: string | null;
  capacityMode: string | null;
  clusterId: string | null;
  inventoryClusterId: string | null;
  isClusterResource: boolean;
  inventoryIsClusterResource: boolean;
  hasInventory: boolean;
}): {
  hasEvidence: boolean;
  evidenceSignals: Array<{ key: string; label: string; value: unknown; source: string }>;
  missingSignals: Array<{ key: string; label: string; reason: string }>;
} => {
  const signals: Array<{ key: string; label: string; value: unknown; source: string }> = [];
  const missing: Array<{ key: string; label: string; reason: string }> = [];

  if (resource.dbEngine) {
    signals.push({ key: "db_engine", label: "Database Engine", value: resource.dbEngine, source: "fact_db_resource_daily" });
  } else {
    missing.push({ key: "engine", label: "Engine", reason: "Database engine metadata is missing." });
  }

  if (resource.resourceType) {
    signals.push({ key: "resource_type", label: "Resource Type", value: resource.resourceType, source: "fact_db_resource_daily" });
  } else {
    missing.push({ key: "resource_type", label: "Resource Type", reason: "Resource type metadata is missing." });
  }

  if (resource.capacityMode) {
    signals.push({ key: "capacity_mode", label: "Capacity Mode", value: resource.capacityMode, source: "fact_db_resource_daily" });
  } else {
    missing.push({ key: "capacity_mode", label: "Capacity Mode", reason: "Deployment capacity mode is unavailable." });
  }

  if (resource.instanceClass) {
    signals.push({ key: "instance_class", label: "Instance Class", value: resource.instanceClass, source: "fact_db_resource_daily" });
  }

  const clusterId = resource.clusterId ?? resource.inventoryClusterId;
  if (clusterId || resource.isClusterResource || resource.inventoryIsClusterResource) {
    signals.push({
      key: "cluster_topology",
      label: "Cluster Topology",
      value: {
        cluster_id: clusterId,
        is_cluster_resource: resource.isClusterResource || resource.inventoryIsClusterResource,
      },
      source: resource.hasInventory ? "db_resource_inventory_snapshots" : "fact_db_resource_daily",
    });
  } else {
    missing.push({ key: "cluster_relationship", label: "Cluster Relationship", reason: "Cluster/replica topology context is missing." });
  }

  return {
    hasEvidence: signals.length > 0,
    evidenceSignals: signals,
    missingSignals: missing,
  };
};

export const generateDbEngineDeploymentOptimizationRecommendations: DbRecommendationRule = async ({ resources }) => {
  const candidates: DbRecommendationCandidate[] = [];

  for (const resource of resources) {
    if (!resource.cloudConnectionId) continue;
    if (!isRelationalDbService(resource.dbService)) continue;

    const totalCost = asNumber(resource.totalEffectiveCost) ?? 0;
    if (totalCost < MIN_TOTAL_COST) continue;

    const usageDays = resource.usageDays ?? 0;
    if (usageDays < MIN_USAGE_DAYS) continue;

    const evidence = buildEngineDeploymentEvidence(resource);
    if (!evidence.hasEvidence) continue;

    const telemetryDays = resource.telemetryDays ?? 0;
    const telemetryContextAvailable = resource.hasTelemetry && telemetryDays >= MIN_TELEMETRY_DAYS_FOR_ACTIVITY_CONTEXT;

    const cpuAvg = asNumber(resource.cpuAvg);
    const connectionsAvg = asNumber(resource.connectionsAvg);
    const lowActivityContext = telemetryContextAvailable &&
      (cpuAvg == null || cpuAvg <= LOW_ACTIVITY_CPU_AVG_THRESHOLD) &&
      (connectionsAvg == null || connectionsAvg <= LOW_ACTIVITY_CONNECTIONS_AVG_THRESHOLD);

    const looksAurora = `${resource.dbEngine ?? ""} ${resource.resourceType ?? ""}`.toLowerCase().includes("aurora");
    const sparseMetadata = !resource.capacityMode || !resource.resourceType || !resource.dbEngine;

    const patternA = telemetryContextAvailable && lowActivityContext;
    const patternB = looksAurora;
    const patternC = sparseMetadata;

    if (!patternA && !patternB && !patternC) continue;

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
        key: "cost_category_context",
        label: "Cost Category Context",
        value: {
          compute: asNumber(resource.computeCost),
          storage: asNumber(resource.storageCost),
          backup: asNumber(resource.backupCost),
          io: asNumber(resource.ioCost),
          other: asNumber(resource.otherCost),
        },
        source: "db_cost_history_daily",
      },
      ...evidence.evidenceSignals,
    ];

    const inventorySignals = resource.hasInventory
      ? [
          {
            key: "inventory_deployment_context",
            label: "Inventory Deployment Context",
            value: {
              status: resource.inventoryStatus ?? resource.status,
              cluster_id: resource.inventoryClusterId ?? resource.clusterId,
              is_cluster_resource: resource.inventoryIsClusterResource || resource.isClusterResource,
              capacity_mode: resource.capacityMode,
              instance_class: resource.instanceClass,
            },
            source: "db_resource_inventory_snapshots",
          },
        ]
      : [];

    const telemetrySignals = resource.hasTelemetry
      ? [
          {
            key: "telemetry_days_available",
            label: "Telemetry Days Available",
            value: telemetryDays,
            source: "db_utilization_daily",
          },
          {
            key: "cpu_avg",
            label: "Average CPU Utilization",
            value: cpuAvg,
            source: "db_utilization_daily",
          },
          {
            key: "connections_avg",
            label: "Average Connections",
            value: connectionsAvg,
            source: "db_utilization_daily",
          },
        ]
      : [];

    const signalsMissing = [
      ...evidence.missingSignals,
      {
        key: "workload_pattern_context",
        label: "Workload Pattern Context",
        reason: "Workload pattern and seasonality context is required for deployment-model decisions.",
      },
      {
        key: "migration_compatibility_context",
        label: "Migration/Compatibility Context",
        reason: "Compatibility, migration risk, and operational constraints must be validated before action.",
      },
    ];

    if (!resource.hasTelemetry || telemetryDays < MIN_TELEMETRY_DAYS_FOR_ACTIVITY_CONTEXT) {
      signalsMissing.push({
        key: "telemetry_activity_context",
        label: "Telemetry Activity Context",
        reason: "Telemetry activity context is missing or sparse for this review.",
      });
    }

    if (!resource.hasInventory) {
      signalsMissing.push({
        key: "inventory_metadata",
        label: "Inventory Metadata",
        reason: "Inventory metadata is missing for deployment posture validation.",
      });
    }

    const warnings = [
      buildDataQualityWarning({
        code: DB_RECOMMENDATION_WARNING_CODES.ESTIMATED_SAVINGS_NOT_AVAILABLE,
        message:
          "Savings are not estimated in v1; validate workload pattern, compatibility, migration risk, licensing, HA requirements, and operational constraints.",
        severity: "info",
      }),
    ];

    const metadataJson = buildDbRecommendationMetadata({
      recommendationType: "DB_ENGINE_DEPLOYMENT_OPTIMIZATION",
      ruleId: "db-engine-deployment-optimization",
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
          "Savings require validating workload pattern, compatibility, migration risk, licensing constraints, HA requirements, and operational readiness.",
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
      recommendationType: "DB_ENGINE_DEPLOYMENT_OPTIMIZATION",
      recommendationTitle: "Review database engine and deployment cost posture",
      recommendationText:
        "This database resource has meaningful spend and deployment metadata that may justify reviewing whether the current engine or deployment model still matches workload behavior, availability needs, and cost objectives.",
      estimatedMonthlySavings: 0,
      currentMonthlyCost: totalCost,
      projectedMonthlyCost: totalCost,
      metadataJson,
    });
  }

  return candidates;
};

export const DB_ENGINE_DEPLOYMENT_OPTIMIZATION_THRESHOLDS = {
  MIN_TOTAL_COST,
  MIN_USAGE_DAYS,
  MIN_TELEMETRY_DAYS_FOR_ACTIVITY_CONTEXT,
  LOW_ACTIVITY_CPU_AVG_THRESHOLD,
  LOW_ACTIVITY_CONNECTIONS_AVG_THRESHOLD,
} as const;
