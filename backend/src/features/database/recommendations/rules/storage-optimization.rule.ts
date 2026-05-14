import {
  DB_RECOMMENDATION_WARNING_CODES,
  buildDataQualityWarning,
  buildDbRecommendationMetadata,
} from "../builders/db-recommendation-evidence.builder.js";
import type { DbRecommendationCandidate } from "../types/db-recommendations.types.js";
import type { DbRecommendationRule } from "./index.js";

const MIN_TOTAL_COST = 5;
const MIN_STORAGE_RELATED_COST = 2;
const MIN_STORAGE_COST_SHARE = 0.25;

const isRelationalDbService = (value: string | null | undefined): boolean => {
  const normalized = (value ?? "").toLowerCase();
  return normalized.includes("rds") || normalized.includes("aurora") || normalized.includes("amazonrds");
};

const asNumber = (value: number | null | undefined): number | null => {
  if (value == null) return null;
  return Number.isFinite(value) ? value : null;
};

export const generateDbStorageOptimizationRecommendations: DbRecommendationRule = async ({ resources }) => {
  const candidates: DbRecommendationCandidate[] = [];

  for (const resource of resources) {
    if (!resource.cloudConnectionId) continue;
    if (!isRelationalDbService(resource.dbService)) continue;

    const totalCost = asNumber(resource.totalEffectiveCost) ?? 0;
    if (totalCost < MIN_TOTAL_COST) continue;

    if (!resource.hasCostCategoryBreakdown) continue;

    const storageCost = asNumber(resource.storageCost);
    const backupCost = asNumber(resource.backupCost);
    const ioCost = asNumber(resource.ioCost);
    const computeCost = asNumber(resource.computeCost);
    const otherCost = asNumber(resource.otherCost);

    const knownStorageRelatedCost = [storageCost, backupCost, ioCost].reduce<number>((sum, cost) => {
      return sum + (cost ?? 0);
    }, 0);

    if (knownStorageRelatedCost < MIN_STORAGE_RELATED_COST) continue;

    const storageShare = totalCost > 0 ? knownStorageRelatedCost / totalCost : 0;
    if (storageShare < MIN_STORAGE_COST_SHARE) continue;

    const billingSignals = [
      {
        key: "total_db_cost_lookback",
        label: "Total DB Cost Over Lookback",
        value: totalCost,
        source: "fact_db_resource_daily",
      },
      {
        key: "storage_related_cost_lookback",
        label: "Storage Related Cost Over Lookback",
        value: knownStorageRelatedCost,
        source: "db_cost_history_daily",
      },
      {
        key: "storage_related_cost_share",
        label: "Storage Related Cost Share",
        value: storageShare,
        source: "db_cost_history_daily",
      },
      {
        key: "known_cost_categories",
        label: "Known Cost Categories Used",
        value: {
          storage: storageCost,
          backup: backupCost,
          io: ioCost,
          compute: computeCost,
          other: otherCost,
        },
        source: "db_cost_history_daily",
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
            key: "storage_used_gb",
            label: "Storage Used (GB)",
            value: resource.storageUsedGb,
            source: "db_utilization_daily",
          },
        ]
      : [];

    const signalsMissing = [];
    if (!resource.hasInventory) {
      signalsMissing.push({
        key: "inventory_storage_allocation",
        label: "Inventory Storage Allocation",
        reason: "Current inventory snapshot is unavailable for this resource.",
      });
      signalsMissing.push({
        key: "backup_retention_policy",
        label: "Backup Retention Policy",
        reason: "Backup policy settings are not available in current billing facts.",
      });
    }

    if (!resource.hasTelemetry) {
      signalsMissing.push({
        key: "telemetry_storage_utilization",
        label: "Telemetry Storage Utilization",
        reason: "Utilization telemetry is unavailable for this lookback window.",
      });
    }

    if (
      storageCost == null ||
      backupCost == null ||
      ioCost == null
    ) {
      signalsMissing.push({
        key: "exact_cost_category_breakdown",
        label: "Exact Storage Cost Category Breakdown",
        reason: "One or more storage-related cost categories are unavailable.",
      });
    }

    const warnings = [
      buildDataQualityWarning({
        code: DB_RECOMMENDATION_WARNING_CODES.ESTIMATED_SAVINGS_NOT_AVAILABLE,
        message:
          "Savings are not estimated in v1; validate retention policy, allocated storage, workload profile, and backup strategy before action.",
        severity: "info",
      }),
    ];

    const metadataJson = buildDbRecommendationMetadata({
      recommendationType: "DB_STORAGE_OPTIMIZATION" as const,
      ruleId: "db-storage-optimization",
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
        storage_cost: storageCost,
        compute_cost: computeCost,
        backup_cost: backupCost,
        io_cost: ioCost,
        other_cost: otherCost,
      },
      savingsAssumptions: {
        estimated_monthly_savings: null,
        estimated_savings_percent: null,
        basis: "not_estimated",
        calculation_notes: [
          "Savings require validation of retention policy, allocated storage, workload requirements, and backup strategy.",
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
      recommendationType: "DB_STORAGE_OPTIMIZATION",
      recommendationTitle: "Review database storage-related spend",
      recommendationText:
        "This database resource shows meaningful storage, backup, or IO-related cost within the selected lookback window. Review retention, allocated storage, backup policy, and storage class/configuration before making changes.",
      estimatedMonthlySavings: 0,
      currentMonthlyCost: totalCost,
      projectedMonthlyCost: totalCost,
      metadataJson,
    });
  }

  return candidates;
};

export const DB_STORAGE_OPTIMIZATION_THRESHOLDS = {
  MIN_TOTAL_COST,
  MIN_STORAGE_RELATED_COST,
  MIN_STORAGE_COST_SHARE,
} as const;
