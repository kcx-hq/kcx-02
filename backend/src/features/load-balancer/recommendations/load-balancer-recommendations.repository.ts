import { QueryTypes } from "sequelize";

import { FactRecommendations, sequelize } from "../../../models/index.js";
import type { LoadBalancerRecommendationType } from "./load-balancer-recommendations.types.js";

const SOURCE_SYSTEM = "KCX_LOAD_BALANCER_OPTIMIZATION_V1";

type RefreshInput = {
  tenantId: string;
  dateFrom: string;
  dateTo: string;
  cloudConnectionId: string | null;
  billingSourceId: number | null;
};

type RecommendationStatus = "open" | "in_progress" | "snoozed" | "dismissed" | "completed";

type CandidateRow = {
  cloudConnectionId: string | null;
  accountId: string | null;
  region: string | null;
  loadBalancerArn: string;
  loadBalancerName: string | null;
  loadBalancerType: string | null;
  loadBalancerState: string | null;
  tags: Record<string, unknown> | null;
  activeDays: number;
  totalCost: number;
  dataProcessingCost: number;
  requestCount: number;
  processedGb: number;
  avgActiveConnections: number;
  avgHealthyHosts: number;
  avgUnhealthyHosts: number;
  maxHealthyHosts: number;
  maxUnhealthyHosts: number;
  unhealthyDays: number;
  errorCount: number;
};

const toUpperStatus = (status: RecommendationStatus): string => status.toUpperCase();
const toLowerStatus = (status: string | null | undefined): RecommendationStatus => {
  const normalized = (status ?? "OPEN").trim().toLowerCase();
  if (
    normalized === "open" ||
    normalized === "in_progress" ||
    normalized === "snoozed" ||
    normalized === "dismissed" ||
    normalized === "completed"
  ) {
    return normalized;
  }
  return "open";
};

export class LoadBalancerRecommendationsRepository {
  private factRecommendationsColumnsCache: Set<string> | null = null;

  private async getFactRecommendationsColumns(): Promise<Set<string>> {
    if (this.factRecommendationsColumnsCache) return this.factRecommendationsColumnsCache;
    const rows = await sequelize.query<{ column_name: string }>(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'fact_recommendations';
      `,
      { type: QueryTypes.SELECT },
    );
    this.factRecommendationsColumnsCache = new Set(rows.map((row) => row.column_name));
    return this.factRecommendationsColumnsCache;
  }

  private pickPayloadByExistingColumns(payload: Record<string, unknown>, existingColumns: Set<string>): Record<string, unknown> {
    const attrs = FactRecommendations.getAttributes() as Record<string, { field?: string }>;
    const next: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload)) {
      const fieldName = attrs[key]?.field ?? key;
      if (existingColumns.has(fieldName)) {
        next[key] = value;
      }
    }
    return next;
  }

  async getCandidates(input: RefreshInput): Promise<CandidateRow[]> {
    return sequelize.query<CandidateRow>(
      `
      WITH cost_rollup AS (
        SELECT
          c.cloud_connection_id AS "cloudConnectionId",
          c.account_id AS "accountId",
          c.region AS region,
          c.load_balancer_arn AS "loadBalancerArn",
          COUNT(DISTINCT c.usage_date)::int AS "activeDays",
          COALESCE(SUM(c.total_cost), 0)::double precision AS "totalCost",
          COALESCE(SUM(c.data_processing_cost), 0)::double precision AS "dataProcessingCost"
        FROM load_balancer_cost_daily c
        WHERE c.cloud_connection_id = :cloudConnectionId::uuid
          AND c.usage_date >= :dateFrom::date
          AND c.usage_date <= :dateTo::date
        GROUP BY c.cloud_connection_id, c.account_id, c.region, c.load_balancer_arn
      ),
      metrics_rollup AS (
        SELECT
          m.cloud_connection_id AS "cloudConnectionId",
          m.account_id AS "accountId",
          m.region AS region,
          m.load_balancer_arn AS "loadBalancerArn",
          COALESCE(SUM(m.request_count), 0)::double precision AS "requestCount",
          COALESCE(SUM(m.processed_gb), 0)::double precision AS "processedGb",
          COALESCE(AVG(m.active_connection_count), 0)::double precision AS "avgActiveConnections",
          COALESCE(AVG(m.healthy_host_count), 0)::double precision AS "avgHealthyHosts",
          COALESCE(AVG(m.unhealthy_host_count), 0)::double precision AS "avgUnhealthyHosts",
          COALESCE(MAX(m.healthy_host_count), 0)::double precision AS "maxHealthyHosts",
          COALESCE(MAX(m.unhealthy_host_count), 0)::double precision AS "maxUnhealthyHosts",
          COALESCE(
            COUNT(DISTINCT CASE WHEN COALESCE(m.unhealthy_host_count, 0) > 0 THEN m.metric_date END),
            0
          )::int AS "unhealthyDays",
          COALESCE(SUM(COALESCE(m.elb_5xx_count, 0) + COALESCE(m.target_5xx_count, 0)), 0)::double precision AS "errorCount"
        FROM load_balancer_metrics_daily m
        WHERE m.cloud_connection_id = :cloudConnectionId::uuid
          AND m.metric_date >= :dateFrom::date
          AND m.metric_date <= :dateTo::date
        GROUP BY m.cloud_connection_id, m.account_id, m.region, m.load_balancer_arn
      ),
      inventory AS (
        SELECT
          lb.cloud_connection_id AS "cloudConnectionId",
          lb.account_id AS "accountId",
          lb.region AS region,
          lb.arn AS "loadBalancerArn",
          lb.name AS "loadBalancerName",
          lb.type AS "loadBalancerType",
          lb.state AS "loadBalancerState",
          lb.tags AS tags
        FROM load_balancers lb
        WHERE lb.cloud_connection_id = :cloudConnectionId::uuid
      )
      SELECT
        inv."cloudConnectionId",
        inv."accountId",
        inv.region,
        inv."loadBalancerArn",
        inv."loadBalancerName",
        inv."loadBalancerType",
        inv."loadBalancerState",
        inv.tags,
        COALESCE(cr."activeDays", 0)::int AS "activeDays",
        COALESCE(cr."totalCost", 0)::double precision AS "totalCost",
        COALESCE(cr."dataProcessingCost", 0)::double precision AS "dataProcessingCost",
        COALESCE(mr."requestCount", 0)::double precision AS "requestCount",
        COALESCE(mr."processedGb", 0)::double precision AS "processedGb",
        COALESCE(mr."avgActiveConnections", 0)::double precision AS "avgActiveConnections",
        COALESCE(mr."avgHealthyHosts", 0)::double precision AS "avgHealthyHosts",
        COALESCE(mr."avgUnhealthyHosts", 0)::double precision AS "avgUnhealthyHosts",
        COALESCE(mr."maxHealthyHosts", 0)::double precision AS "maxHealthyHosts",
        COALESCE(mr."maxUnhealthyHosts", 0)::double precision AS "maxUnhealthyHosts",
        COALESCE(mr."unhealthyDays", 0)::int AS "unhealthyDays",
        COALESCE(mr."errorCount", 0)::double precision AS "errorCount"
      FROM inventory inv
      LEFT JOIN cost_rollup cr
        ON cr."cloudConnectionId" IS NOT DISTINCT FROM inv."cloudConnectionId"
       AND cr."accountId" = inv."accountId"
       AND cr.region = inv.region
       AND cr."loadBalancerArn" = inv."loadBalancerArn"
      LEFT JOIN metrics_rollup mr
        ON mr."cloudConnectionId" IS NOT DISTINCT FROM inv."cloudConnectionId"
       AND mr."accountId" = inv."accountId"
       AND mr.region = inv.region
       AND mr."loadBalancerArn" = inv."loadBalancerArn";
      `,
      {
        replacements: input,
        type: QueryTypes.SELECT,
      },
    );
  }

  async upsertGeneratedRecommendations(
    records: Array<Record<string, unknown>>,
    scope: {
      tenantId: string;
      cloudConnectionId: string | null;
      billingSourceId: number | null;
    },
  ): Promise<{ created: number; updated: number; resolved: number }> {
    const now = new Date();
    let created = 0;
    let updated = 0;
    let resolved = 0;
    const identity = (r: {
      tenantId: string;
      cloudConnectionId: string | null;
      billingSourceId: number | null;
      category: string;
      type: string;
      resourceType: string;
      resourceId: string;
    }) =>
      `${r.tenantId}|${r.cloudConnectionId ?? ""}|${r.billingSourceId ?? ""}|${r.category}|${r.type}|${r.resourceType}|${r.resourceId}`;

    return sequelize.transaction(async (transaction) => {
      const tenantId = scope.tenantId;
      const scopeCloudConnectionId = scope.cloudConnectionId;
      const scopeBillingSourceId = scope.billingSourceId;
      const recommendationColumns = await this.getFactRecommendationsColumns();

      const existing = await FactRecommendations.findAll({
        attributes: [
          "id",
          "tenantId",
          "cloudConnectionId",
          "billingSourceId",
          "category",
          "recommendationType",
          "resourceType",
          "resourceId",
          "status",
          ...(recommendationColumns.has("detected_at") ? ["detectedAt"] : []),
        ],
        where: {
          tenantId,
          sourceSystem: SOURCE_SYSTEM,
          cloudConnectionId: scopeCloudConnectionId,
          ...(scopeBillingSourceId == null ? {} : { billingSourceId: scopeBillingSourceId }),
        },
        transaction,
      });

      const existingByKey = new Map<string, (typeof existing)[number]>();
      for (const row of existing) {
        const key = identity({
          tenantId: row.tenantId,
          cloudConnectionId: row.cloudConnectionId,
          billingSourceId: row.billingSourceId ? Number(row.billingSourceId) : null,
          category: String(row.category).toLowerCase(),
          type: String(row.recommendationType),
          resourceType: String(row.resourceType),
          resourceId: String(row.resourceId ?? ""),
        });
        existingByKey.set(key, row);
      }

      const seenKeys = new Set<string>();
      for (const record of records) {
        const rec = record as Record<string, unknown>;
        const key = identity({
          tenantId: String(rec.tenantId),
          cloudConnectionId: (rec.cloudConnectionId as string | null) ?? null,
          billingSourceId: (rec.billingSourceId as number | null) ?? null,
          category: String(rec.category).toLowerCase(),
          type: String(rec.type),
          resourceType: String(rec.resourceType),
          resourceId: String(rec.resourceId),
        });
        seenKeys.add(key);
        const existingRow = existingByKey.get(key);
        const existingStatus = toLowerStatus(existingRow?.status);
        const preserveStatus =
          existingStatus === "in_progress" ||
          existingStatus === "dismissed" ||
          existingStatus === "snoozed";

        const payload: Record<string, unknown> = {
          tenantId: rec.tenantId,
          cloudConnectionId: rec.cloudConnectionId,
          billingSourceId: rec.billingSourceId,
          awsAccountId: rec.accountId,
          awsRegionCode: rec.region,
          category: String(rec.category).toUpperCase(),
          recommendationType: rec.type as LoadBalancerRecommendationType,
          resourceType: rec.resourceType,
          resourceId: rec.resourceId,
          resourceName: rec.resourceName,
          recommendationTitle: rec.problem,
          recommendationText: rec.evidence,
          idleObservationValue: rec.action,
          currentMonthlyCost: rec.currentMonthlyCost,
          estimatedMonthlySavings: rec.estimatedMonthlySaving,
          projectedMonthlyCost: rec.projectedMonthlyCost,
          riskLevel: String(rec.risk).toUpperCase(),
          effortLevel: rec.effort ? String(rec.effort).toUpperCase() : null,
          status: preserveStatus ? toUpperStatus(existingStatus) : "OPEN",
          sourceSystem: SOURCE_SYSTEM,
          metadataJson: rec.metadata,
          detectedAt: existingRow?.detectedAt ?? now,
          lastSeenAt: now,
          observationStart: rec.observationStart,
          observationEnd: rec.observationEnd,
          updatedAt: now,
        };
        const safePayload = this.pickPayloadByExistingColumns(payload, recommendationColumns);

        if (existingRow) {
          await existingRow.update(safePayload as never, { transaction, returning: false });
          updated += 1;
        } else {
          const createPayload = this.pickPayloadByExistingColumns(
            {
              ...payload,
              createdAt: now,
            },
            recommendationColumns,
          );
          await FactRecommendations.create(
            createPayload as never,
            { transaction, returning: false },
          );
          created += 1;
        }
      }

      for (const row of existing) {
        const key = identity({
          tenantId: row.tenantId,
          cloudConnectionId: row.cloudConnectionId,
          billingSourceId: row.billingSourceId ? Number(row.billingSourceId) : null,
          category: String(row.category).toLowerCase(),
          type: String(row.recommendationType),
          resourceType: String(row.resourceType),
          resourceId: String(row.resourceId ?? ""),
        });
        if (seenKeys.has(key)) continue;
        if (toLowerStatus(row.status) === "completed") continue;
        const resolvePayload = this.pickPayloadByExistingColumns(
          { status: "COMPLETED", updatedAt: now },
          recommendationColumns,
        );
        await row.update(resolvePayload as never, { transaction, returning: false });
        resolved += 1;
      }

      return { created, updated, resolved };
    });
  }
}
