import { QueryTypes, type Transaction } from "sequelize";

import { FactRecommendations, sequelize } from "../../../models/index.js";
import { logger } from "../../../utils/logger.js";
import { buildDbRecommendationMetadata } from "./builders/db-recommendation-evidence.builder.js";
import { dbRecommendationRulesRegistry } from "./rules/index.js";
import type {
  DbRecommendationCandidate,
  DbRecommendationsGenerateResult,
  DbRecommendationsGenerateInput,
  EligibleDbResource,
} from "./types/db-recommendations.types.js";
import { dedupeDbRecommendationCandidates } from "./utils/db-recommendation-dedupe.js";
import { isActionableDbResource } from "./utils/db-recommendation-eligibility.js";

const SOURCE_SYSTEM = "KCX_DB_RECOMMENDATIONS_V1";
const DB_CATEGORY = "DB";

const identity = (candidate: DbRecommendationCandidate): string =>
  [
    candidate.tenantId,
    candidate.cloudConnectionId,
    candidate.resourceId,
    candidate.recommendationType,
  ].join("|");

export class DbRecommendationsGenerator {
  private static readonly DEFAULT_LOOKBACK_DAYS = 30;

  async generate(input: DbRecommendationsGenerateInput): Promise<DbRecommendationsGenerateResult> {
    const lookbackEnd = new Date();
    const lookbackStart = new Date(lookbackEnd);
    lookbackStart.setUTCDate(lookbackStart.getUTCDate() - (DbRecommendationsGenerator.DEFAULT_LOOKBACK_DAYS - 1));

    const resources = await this.loadEligibleResources(input, lookbackStart, lookbackEnd);
    const actionableResources = resources.filter((resource) => isActionableDbResource(resource));

    const ruleResultsRaw: Array<{
      rule: string;
      candidates: DbRecommendationCandidate[];
      durationMs: number;
      failed: number;
      warning?: string;
    }> = [];
    for (const rule of dbRecommendationRulesRegistry) {
      const ruleName = rule.name || "anonymous_rule";
      const startedAt = Date.now();
      try {
        const candidates = await rule({ scope: input, resources: actionableResources });
        ruleResultsRaw.push({
          rule: ruleName,
          candidates,
          durationMs: Date.now() - startedAt,
          failed: 0,
        });
      } catch (error) {
        const warning = `Rule ${ruleName} failed: ${error instanceof Error ? error.message : String(error)}`;
        logger.warn("DB recommendation rule execution failed", {
          tenantId: input.tenantId,
          cloudConnectionId: input.cloudConnectionId ?? null,
          rule: ruleName,
          reason: error instanceof Error ? error.message : String(error),
        });
        ruleResultsRaw.push({
          rule: ruleName,
          candidates: [],
          durationMs: Date.now() - startedAt,
          failed: 1,
          warning,
        });
      }
    }

    const warnings = ruleResultsRaw.flatMap((item) => (item.warning ? [item.warning] : []));
    const allCandidates = ruleResultsRaw.flatMap((item) => item.candidates);
    const deduped = dedupeDbRecommendationCandidates(allCandidates);
    const persistence = await this.upsertCandidates(input, deduped);
    const candidatesEvaluated = actionableResources.length;
    const distinctRecommendedResources = new Set(deduped.map((candidate) => candidate.resourceId)).size;
    const skipped = Math.max(candidatesEvaluated - distinctRecommendedResources, 0);
    const distinctConnections = new Set(
      actionableResources
        .map((resource) => resource.cloudConnectionId)
        .filter((value): value is string => Boolean(value)),
    );
    const failed = ruleResultsRaw.reduce((sum, item) => sum + item.failed, 0);

    return {
      generatedAt: new Date().toISOString(),
      category: "DB",
      tenantsProcessed: 1,
      connectionsProcessed: input.cloudConnectionId ? 1 : distinctConnections.size,
      resourcesEvaluated: actionableResources.length,
      candidatesEvaluated,
      created: persistence.created,
      updated: persistence.updated,
      resolved: persistence.resolved,
      skipped,
      failed,
      activeRules: dbRecommendationRulesRegistry.map((rule) => rule.name || "anonymous_rule"),
      ruleResults: ruleResultsRaw.map((item) => ({
        rule: item.rule,
        evaluated: actionableResources.length,
        candidates: item.candidates.length,
        created: 0,
        updated: 0,
        resolved: 0,
        skipped: Math.max(actionableResources.length - item.candidates.length, 0),
        failed: item.failed,
        durationMs: item.durationMs,
      })),
      warnings,
    };
  }

  private async loadEligibleResources(
    input: DbRecommendationsGenerateInput,
    lookbackStart: Date,
    lookbackEnd: Date,
  ): Promise<EligibleDbResource[]> {
    return sequelize.query<EligibleDbResource>(
      `
      WITH fact_rollup AS (
        SELECT
          f.tenant_id AS "tenantId",
          f.cloud_connection_id AS "cloudConnectionId",
          f.billing_source_id::bigint AS "billingSourceId",
          COALESCE(sa.sub_account_id, f.sub_account_key::text) AS "awsAccountId",
          r.region_id AS "awsRegionCode",
          f.resource_id AS "resourceId",
          MAX(f.resource_arn) AS "resourceArn",
          MAX(f.resource_name) AS "resourceName",
          MAX(f.db_service) AS "dbService",
          MAX(f.db_engine) AS "dbEngine",
          MAX(f.resource_type) AS "resourceType",
          MAX(f.cluster_id) AS "clusterId",
          COALESCE(BOOL_OR(COALESCE(f.is_cluster_resource, FALSE)), FALSE) AS "isClusterResource",
          MAX(f.status) AS "status",
          COALESCE(SUM(f.total_effective_cost), 0)::double precision AS "totalEffectiveCost",
          COUNT(DISTINCT f.usage_date)::int AS "usageDays",
          MAX(f.usage_date)::text AS "latestUsageDate",
          MAX(f.currency_code) AS "currencyCode"
        FROM fact_db_resource_daily f
        LEFT JOIN dim_sub_account sa ON sa.id = f.sub_account_key
        LEFT JOIN dim_region r ON r.id = f.region_key
        WHERE f.tenant_id = :tenantId::uuid
          AND (:cloudConnectionId::uuid IS NULL OR f.cloud_connection_id = :cloudConnectionId::uuid)
          AND f.usage_date >= :lookbackStart::date
          AND f.usage_date <= :lookbackEnd::date
        GROUP BY
          f.tenant_id,
          f.cloud_connection_id,
          f.billing_source_id,
          COALESCE(sa.sub_account_id, f.sub_account_key::text),
          r.region_id,
          f.resource_id
      ),
      cost_rollup AS (
        SELECT
          ch.tenant_id AS "tenantId",
          ch.cloud_connection_id AS "cloudConnectionId",
          ch.resource_id AS "resourceId",
          COUNT(*) > 0 AS "hasCostCategoryBreakdown",
          COALESCE(
            SUM(CASE WHEN ch.cost_category NOT IN ('tax', 'credit', 'refund') THEN ch.effective_cost ELSE 0 END),
            0
          )::double precision AS "totalEffectiveCostCostHistory",
          CASE WHEN COUNT(*) > 0 THEN COALESCE(SUM(CASE WHEN ch.cost_category = 'compute' THEN ch.effective_cost ELSE 0 END), 0)::double precision ELSE NULL END AS "computeCost",
          CASE WHEN COUNT(*) > 0 THEN COALESCE(SUM(CASE WHEN ch.cost_category = 'storage' THEN ch.effective_cost ELSE 0 END), 0)::double precision ELSE NULL END AS "storageCost",
          CASE WHEN COUNT(*) > 0 THEN COALESCE(SUM(CASE WHEN ch.cost_category = 'backup' THEN ch.effective_cost ELSE 0 END), 0)::double precision ELSE NULL END AS "backupCost",
          CASE WHEN COUNT(*) > 0 THEN COALESCE(SUM(CASE WHEN ch.cost_category = 'io' THEN ch.effective_cost ELSE 0 END), 0)::double precision ELSE NULL END AS "ioCost",
          CASE WHEN COUNT(*) > 0 THEN COALESCE(SUM(CASE WHEN ch.cost_category = 'other' THEN ch.effective_cost ELSE 0 END), 0)::double precision ELSE NULL END AS "otherCost"
        FROM db_cost_history_daily ch
        WHERE ch.tenant_id = :tenantId::uuid
          AND (:cloudConnectionId::uuid IS NULL OR ch.cloud_connection_id = :cloudConnectionId::uuid)
          AND ch.usage_date >= :lookbackStart::date
          AND ch.usage_date <= :lookbackEnd::date
        GROUP BY ch.tenant_id, ch.cloud_connection_id, ch.resource_id
      ),
      inventory_rollup AS (
        SELECT
          inv.tenant_id AS "tenantId",
          inv.cloud_connection_id AS "cloudConnectionId",
          inv.resource_id AS "resourceId",
          COUNT(*) > 0 AS "hasInventory",
          MAX(inv.allocated_storage_gb)::double precision AS "allocatedStorageGb",
          MAX(inv.instance_class) AS "instanceClass",
          MAX(inv.capacity_mode) AS "capacityMode",
          MAX(inv.cluster_id) AS "inventoryClusterId",
          COALESCE(BOOL_OR(COALESCE(inv.is_cluster_resource, FALSE)), FALSE) AS "inventoryIsClusterResource",
          MAX(inv.status) AS "inventoryStatus"
        FROM db_resource_inventory_snapshots inv
        WHERE inv.tenant_id = :tenantId::uuid
          AND (:cloudConnectionId::uuid IS NULL OR inv.cloud_connection_id = :cloudConnectionId::uuid)
          AND inv.is_current = TRUE
        GROUP BY inv.tenant_id, inv.cloud_connection_id, inv.resource_id
      ),
      utilization_rollup AS (
        SELECT
          util.tenant_id AS "tenantId",
          util.cloud_connection_id AS "cloudConnectionId",
          util.resource_id AS "resourceId",
          COUNT(*) > 0 AS "hasTelemetry",
          COUNT(DISTINCT util.usage_date)::int AS "telemetryDays",
          AVG(util.storage_used_gb)::double precision AS "storageUsedGb",
          AVG(util.cpu_avg)::double precision AS "cpuAvg",
          MAX(util.cpu_max)::double precision AS "cpuMax",
          AVG(util.connections_avg)::double precision AS "connectionsAvg",
          MAX(util.connections_max)::double precision AS "connectionsMax",
          AVG(util.read_iops)::double precision AS "readIopsAvg",
          AVG(util.write_iops)::double precision AS "writeIopsAvg"
        FROM db_utilization_daily util
        WHERE util.tenant_id = :tenantId::uuid
          AND (:cloudConnectionId::uuid IS NULL OR util.cloud_connection_id = :cloudConnectionId::uuid)
          AND util.usage_date >= :lookbackStart::date
          AND util.usage_date <= :lookbackEnd::date
        GROUP BY util.tenant_id, util.cloud_connection_id, util.resource_id
      )
      SELECT
        fr."tenantId",
        fr."cloudConnectionId",
        fr."billingSourceId",
        fr."awsAccountId",
        fr."awsRegionCode",
        fr."resourceId",
        fr."resourceArn",
        fr."resourceName",
        fr."dbService",
        fr."dbEngine",
        fr."resourceType",
        fr."clusterId",
        fr."isClusterResource",
        fr."status",
        inv."instanceClass",
        inv."capacityMode",
        COALESCE(cr."totalEffectiveCostCostHistory", fr."totalEffectiveCost") AS "totalEffectiveCost",
        fr."usageDays",
        :lookbackStart::date::text AS "lookbackStart",
        :lookbackEnd::date::text AS "lookbackEnd",
        fr."latestUsageDate",
        fr."currencyCode",
        cr."computeCost",
        cr."storageCost",
        cr."backupCost",
        cr."ioCost",
        cr."otherCost",
        COALESCE(cr."hasCostCategoryBreakdown", FALSE) AS "hasCostCategoryBreakdown",
        inv."allocatedStorageGb",
        inv."inventoryClusterId",
        COALESCE(inv."inventoryIsClusterResource", FALSE) AS "inventoryIsClusterResource",
        inv."inventoryStatus",
        util."storageUsedGb",
        COALESCE(inv."hasInventory", FALSE) AS "hasInventory",
        COALESCE(util."hasTelemetry", FALSE) AS "hasTelemetry",
        COALESCE(util."telemetryDays", 0)::int AS "telemetryDays",
        util."cpuAvg",
        util."cpuMax",
        util."connectionsAvg",
        util."connectionsMax",
        util."readIopsAvg",
        util."writeIopsAvg"
      FROM fact_rollup fr
      LEFT JOIN cost_rollup cr
        ON cr."tenantId" = fr."tenantId"
       AND cr."cloudConnectionId" IS NOT DISTINCT FROM fr."cloudConnectionId"
       AND cr."resourceId" = fr."resourceId"
      LEFT JOIN inventory_rollup inv
        ON inv."tenantId" = fr."tenantId"
       AND inv."cloudConnectionId" IS NOT DISTINCT FROM fr."cloudConnectionId"
       AND inv."resourceId" = fr."resourceId"
      LEFT JOIN utilization_rollup util
        ON util."tenantId" = fr."tenantId"
       AND util."cloudConnectionId" IS NOT DISTINCT FROM fr."cloudConnectionId"
       AND util."resourceId" = fr."resourceId"
      `,
      {
        replacements: {
          tenantId: input.tenantId,
          cloudConnectionId: input.cloudConnectionId ?? null,
          lookbackStart,
          lookbackEnd,
        },
        type: QueryTypes.SELECT,
      },
    );
  }

  private async upsertCandidates(
    scope: DbRecommendationsGenerateInput,
    candidates: DbRecommendationCandidate[],
  ): Promise<{ created: number; updated: number; resolved: number }> {
    const now = new Date();
    let created = 0;
    let updated = 0;
    let resolved = 0;

    return sequelize.transaction(async (transaction: Transaction) => {
      const existing = await FactRecommendations.findAll({
        where: {
          tenantId: scope.tenantId,
          category: DB_CATEGORY,
          sourceSystem: SOURCE_SYSTEM,
          ...(scope.cloudConnectionId ? { cloudConnectionId: scope.cloudConnectionId } : {}),
        },
        transaction,
      });

      const existingByIdentity = new Map<string, (typeof existing)[number]>();
      for (const row of existing) {
        const key = [
          row.tenantId,
          row.cloudConnectionId ?? "",
          row.resourceId ?? "",
          row.recommendationType,
        ].join("|");
        existingByIdentity.set(key, row);
      }

      const seen = new Set<string>();
      for (const candidate of candidates) {
        const key = identity(candidate);
        seen.add(key);
        const existingRow = existingByIdentity.get(key);

        const payload = {
          tenantId: candidate.tenantId,
          cloudConnectionId: candidate.cloudConnectionId,
          billingSourceId: candidate.billingSourceId,
          awsAccountId: candidate.awsAccountId,
          awsRegionCode: candidate.awsRegionCode,
          category: DB_CATEGORY,
          recommendationType: candidate.recommendationType,
          resourceId: candidate.resourceId,
          resourceArn: candidate.resourceArn,
          resourceName: candidate.resourceName,
          resourceType: candidate.resourceType,
          recommendationTitle: candidate.recommendationTitle,
          recommendationText: candidate.recommendationText,
          currentMonthlyCost: candidate.currentMonthlyCost,
          estimatedMonthlySavings: candidate.estimatedMonthlySavings,
          projectedMonthlyCost: candidate.projectedMonthlyCost,
          sourceSystem: SOURCE_SYSTEM,
          status: ["IN_PROGRESS", "SNOOZED", "DISMISSED"].includes(String(existingRow?.status))
            ? existingRow?.status
            : "OPEN",
          metadataJson: (() => {
            const fallbackMetadata = buildDbRecommendationMetadata({
            recommendationType: candidate.recommendationType,
            ruleId: "db-rule-registry",
            ruleVersion: "1.0.0",
            lineage: {
              tenant_id: candidate.tenantId,
              cloud_connection_id: candidate.cloudConnectionId,
              resource_id: candidate.resourceId,
              provider: "AWS",
              service: "AmazonRDS",
              resource_type: candidate.resourceType ?? null,
              region: candidate.awsRegionCode ?? null,
              account_id: candidate.awsAccountId ?? null,
            },
            billingSignals: [
              {
                key: "current_monthly_cost",
                label: "Current Monthly Cost",
                value: candidate.currentMonthlyCost,
                source: "fact_db_resource_daily",
              },
            ],
            inventorySignals: [],
            telemetrySignals: [],
            signalsMissing: [
              {
                key: "telemetry",
                label: "Telemetry Signals",
                reason: "Telemetry not available in current rule execution.",
              },
            ],
            costBreakdown: {
              currency: "USD",
              lookback_days: 30,
              total_cost: candidate.currentMonthlyCost ?? 0,
            },
            savingsAssumptions: {
              estimated_monthly_savings: Number.isFinite(candidate.estimatedMonthlySavings)
                ? candidate.estimatedMonthlySavings
                : null,
              estimated_savings_percent: null,
              basis: "not_estimated",
              calculation_notes: [
                "Rule-specific savings assumptions are pending Prompt-3 and beyond.",
              ],
            },
            sourceTables: [
              "fact_db_resource_daily",
              "db_cost_history_daily",
              "db_resource_inventory_snapshots",
              "db_utilization_daily",
            ],
            });
            if (candidate.metadataJson && typeof candidate.metadataJson === "object") {
              return { ...fallbackMetadata, ...(candidate.metadataJson as Record<string, unknown>) };
            }
            return fallbackMetadata;
          })(),
          detectedAt: existingRow?.detectedAt ?? now,
          lastSeenAt: now,
          updatedAt: now,
        };

        if (existingRow) {
          await existingRow.update(payload, { transaction, returning: false });
          updated += 1;
        } else {
          await FactRecommendations.create({ ...payload, createdAt: now }, { transaction, returning: false });
          created += 1;
        }
      }

      for (const row of existing) {
        const key = [
          row.tenantId,
          row.cloudConnectionId ?? "",
          row.resourceId ?? "",
          row.recommendationType,
        ].join("|");

        if (seen.has(key) || String(row.status) === "COMPLETED") continue;

        await row.update({ status: "COMPLETED", updatedAt: now }, { transaction, returning: false });
        resolved += 1;
      }

      logger.info("DB recommendations generation finished", {
        tenantId: scope.tenantId,
        cloudConnectionId: scope.cloudConnectionId ?? null,
        candidates: candidates.length,
        created,
        updated,
        resolved,
      });

      return { created, updated, resolved };
    });
  }
}
