import {
  DB_RECOMMENDATION_WARNING_CODES,
  buildDataQualityWarning,
  buildDbRecommendationMetadata,
} from "../builders/db-recommendation-evidence.builder.js";
import type { DbRecommendationCandidate } from "../types/db-recommendations.types.js";
import type { DbRecommendationRule } from "./index.js";

const MIN_TOTAL_COST = 20;
const MIN_COMPUTE_COST = 10;
const MIN_USAGE_DAYS = 7;
const LOW_ACTIVITY_CPU_AVG_THRESHOLD = 10;
const LOW_ACTIVITY_CONNECTIONS_AVG_THRESHOLD = 2;
const MIN_TELEMETRY_DAYS_FOR_ACTIVITY_CONTEXT = 7;

const isRelationalDbService = (value: string | null | undefined): boolean => {
  const normalized = (value ?? "").toLowerCase();
  return normalized.includes("rds") || normalized.includes("aurora") || normalized.includes("amazonrds");
};

const asNumber = (value: number | null | undefined): number | null => {
  if (value == null) return null;
  return Number.isFinite(value) ? value : null;
};

const isHaTopologySignalPresent = (resource: {
  resourceType: string | null;
  clusterId: string | null;
  isClusterResource: boolean;
  inventoryClusterId: string | null;
  inventoryIsClusterResource: boolean;
  instanceClass: string | null;
  capacityMode: string | null;
}): { hasSignal: boolean; signalLabel: string; signalValue: unknown } => {
  const typeLower = (resource.resourceType ?? "").toLowerCase();
  const classLower = (resource.instanceClass ?? "").toLowerCase();
  const modeLower = (resource.capacityMode ?? "").toLowerCase();

  if (resource.isClusterResource || resource.inventoryIsClusterResource || resource.clusterId || resource.inventoryClusterId) {
    return {
      hasSignal: true,
      signalLabel: "Cluster/Replica Topology Signal",
      signalValue: {
        cluster_id: resource.clusterId ?? resource.inventoryClusterId,
        is_cluster_resource: resource.isClusterResource || resource.inventoryIsClusterResource,
      },
    };
  }

  if (typeLower.includes("cluster") || typeLower.includes("replica") || typeLower.includes("reader")) {
    return {
      hasSignal: true,
      signalLabel: "Resource Type HA Topology Signal",
      signalValue: resource.resourceType,
    };
  }

  if (classLower.includes("db.r") || modeLower.includes("provisioned")) {
    return {
      hasSignal: true,
      signalLabel: "Deployment Posture Signal",
      signalValue: { instance_class: resource.instanceClass, capacity_mode: resource.capacityMode },
    };
  }

  return { hasSignal: false, signalLabel: "", signalValue: null };
};

export const generateDbHaCostOptimizationRecommendations: DbRecommendationRule = async ({ resources }) => {
  const candidates: DbRecommendationCandidate[] = [];

  for (const resource of resources) {
    if (!resource.cloudConnectionId) continue;
    if (!isRelationalDbService(resource.dbService)) continue;

    const totalCost = asNumber(resource.totalEffectiveCost) ?? 0;
    const computeCost = asNumber(resource.computeCost) ?? 0;
    const usageDays = resource.usageDays ?? 0;

    if (totalCost < MIN_TOTAL_COST) continue;
    if (usageDays < MIN_USAGE_DAYS) continue;

    const topologySignal = isHaTopologySignalPresent(resource);

    const cpuAvg = asNumber(resource.cpuAvg);
    const connectionsAvg = asNumber(resource.connectionsAvg);
    const telemetryDays = resource.telemetryDays ?? 0;
    const hasActivityContext = resource.hasTelemetry && telemetryDays >= MIN_TELEMETRY_DAYS_FOR_ACTIVITY_CONTEXT;

    const lowActivityContext = hasActivityContext &&
      (cpuAvg == null || cpuAvg <= LOW_ACTIVITY_CPU_AVG_THRESHOLD) &&
      (connectionsAvg == null || connectionsAvg <= LOW_ACTIVITY_CONNECTIONS_AVG_THRESHOLD);

    const billingHaProxySignal = resource.hasCostCategoryBreakdown && computeCost >= MIN_COMPUTE_COST;

    const patternA = topologySignal.hasSignal;
    const patternB = !topologySignal.hasSignal && billingHaProxySignal && Boolean(resource.resourceType);
    const patternC = topologySignal.hasSignal && lowActivityContext;

    if (!patternA && !patternB && !patternC) continue;

    const billingSignals = [
      {
        key: "total_db_cost_lookback",
        label: "Total DB Cost Over Lookback",
        value: totalCost,
        source: "fact_db_resource_daily",
      },
      {
        key: "compute_cost_lookback",
        label: "Compute Cost Over Lookback",
        value: computeCost,
        source: "db_cost_history_daily",
      },
      {
        key: "billing_usage_days",
        label: "Billing Usage Days",
        value: usageDays,
        source: "fact_db_resource_daily",
      },
      {
        key: "ha_topology_indicator",
        label: topologySignal.signalLabel || "HA Topology Indicator",
        value: topologySignal.signalValue,
        source: topologySignal.hasSignal ? "db_resource_inventory_snapshots" : "fact_db_resource_daily",
      },
    ];

    const inventorySignals = resource.hasInventory
      ? [
          {
            key: "inventory_topology",
            label: "Inventory Deployment/Topology",
            value: {
              status: resource.inventoryStatus ?? resource.status,
              cluster_id: resource.inventoryClusterId ?? resource.clusterId,
              is_cluster_resource: resource.inventoryIsClusterResource || resource.isClusterResource,
              resource_type: resource.resourceType,
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

    const signalsMissing = [];
    if (!topologySignal.hasSignal) {
      signalsMissing.push({
        key: "multi_az_or_topology_field",
        label: "HA Topology Field",
        reason: "Explicit Multi-AZ/standby/replica topology field not available in current dataset.",
      });
      signalsMissing.push({
        key: "replica_cluster_relationship",
        label: "Replica/Cluster Relationship",
        reason: "Replica/source and cluster-role mapping is incomplete.",
      });
    }

    if (!resource.hasTelemetry || telemetryDays < MIN_TELEMETRY_DAYS_FOR_ACTIVITY_CONTEXT) {
      signalsMissing.push({
        key: "telemetry_activity_context",
        label: "Telemetry Activity Context",
        reason: "Telemetry activity context is missing or sparse for HA posture review.",
      });
    }

    signalsMissing.push({
      key: "business_criticality_context",
      label: "Business Criticality and RTO/RPO Context",
      reason: "Business criticality, RTO/RPO, and failover requirements must be validated before action.",
    });

    if (!resource.hasCostCategoryBreakdown) {
      signalsMissing.push({
        key: "exact_ha_cost_attribution",
        label: "Exact HA Cost Attribution",
        reason: "Exact HA-linked cost attribution is unavailable from current cost category breakdown.",
      });
    }

    const warnings = [
      buildDataQualityWarning({
        code: DB_RECOMMENDATION_WARNING_CODES.ESTIMATED_SAVINGS_NOT_AVAILABLE,
        message:
          "Savings are not estimated in v1; confirm criticality, RTO/RPO, failover requirements, maintenance windows, and safe architecture alternatives.",
        severity: "info",
      }),
    ];

    if (!resource.hasCostCategoryBreakdown) {
      warnings.push(
        buildDataQualityWarning({
          code: DB_RECOMMENDATION_WARNING_CODES.MISSING_COST_CATEGORY_BREAKDOWN,
          message: "HA-related cost attribution is partial due to missing category-level cost detail.",
          severity: "warning",
        }),
      );
    }

    const metadataJson = buildDbRecommendationMetadata({
      recommendationType: "DB_HA_COST_OPTIMIZATION",
      ruleId: "db-ha-cost-optimization",
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
          "Savings require confirming business criticality, RTO/RPO requirements, failover needs, maintenance windows, and safe resilience architecture alternatives.",
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
      recommendationType: "DB_HA_COST_OPTIMIZATION",
      recommendationTitle: "Review high availability cost posture",
      recommendationText:
        "This database resource appears to have HA or resilience-related cost exposure during the lookback window. Validate the availability configuration against workload criticality, recovery objectives, and business requirements before making changes.",
      estimatedMonthlySavings: 0,
      currentMonthlyCost: totalCost,
      projectedMonthlyCost: totalCost,
      metadataJson,
    });
  }

  return candidates;
};

export const DB_HA_COST_OPTIMIZATION_THRESHOLDS = {
  MIN_TOTAL_COST,
  MIN_COMPUTE_COST,
  MIN_USAGE_DAYS,
  LOW_ACTIVITY_CPU_AVG_THRESHOLD,
  LOW_ACTIVITY_CONNECTIONS_AVG_THRESHOLD,
  MIN_TELEMETRY_DAYS_FOR_ACTIVITY_CONTEXT,
} as const;
