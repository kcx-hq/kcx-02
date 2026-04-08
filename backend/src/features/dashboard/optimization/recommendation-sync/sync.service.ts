import { QueryTypes } from "sequelize";
import { sequelize } from "../../../../models/index.js";
import { logger } from "../../../../utils/logger.js";
import { enrichRightsizingRecommendations } from "./enrichment.service.js";
import { normalizeAwsEc2Recommendations } from "./normalization.service.js";
import { replaceOpenRightsizingRecommendationsForTenant } from "./storage.repository.js";
import {
  fetchAwsEc2RightsizingRecommendationsFromComputeOptimizer,
  resolveAwsSyncContext,
} from "./aws-recommendations.source.js";
import type {
  AwsComputeOptimizerEc2RecommendationInput,
  OptimizationSyncResult,
  OptimizationSyncTrigger,
} from "./types.js";

export async function syncAwsRightsizingRecommendations({
  tenantId,
  trigger,
  billingSourceId,
  cloudConnectionId,
  recommendations,
}: {
  tenantId: string;
  trigger: OptimizationSyncTrigger;
  billingSourceId?: string | null;
  cloudConnectionId?: string | null;
  recommendations?: AwsComputeOptimizerEc2RecommendationInput[];
}): Promise<OptimizationSyncResult> {
  const context = await resolveAwsSyncContext({
    tenantId,
    billingSourceId,
    cloudConnectionId,
  });

  if (!context.ok) {
    return {
      trigger,
      tenantId,
      fetchedCount: 0,
      normalizedCount: 0,
      enrichedCount: 0,
      insertedCount: 0,
      skipped: true,
      reason: context.reason,
    };
  }

  const fetched = Array.isArray(recommendations)
    ? {
        skipped: false,
        reason: "Recommendations provided by caller",
        recommendations,
      }
    : await fetchAwsEc2RightsizingRecommendationsFromComputeOptimizer({
        connection: context.connection,
      });

  if (fetched.recommendations.length === 0) {
    return {
      trigger,
      tenantId,
      fetchedCount: 0,
      normalizedCount: 0,
      enrichedCount: 0,
      insertedCount: 0,
      skipped: fetched.skipped,
      reason: fetched.reason,
    };
  }

  const normalized = normalizeAwsEc2Recommendations({
    tenantId,
    recommendations: fetched.recommendations,
  });
  const enriched = await enrichRightsizingRecommendations({
    tenantId,
    providerId: context.providerId,
    normalizedRecords: normalized,
  });
  const insertedCount = await replaceOpenRightsizingRecommendationsForTenant({
    tenantId,
    sourceSystem: "AWS_COMPUTE_OPTIMIZER",
    records: enriched,
  });

  const result: OptimizationSyncResult = {
    trigger,
    tenantId,
    fetchedCount: fetched.recommendations.length,
    normalizedCount: normalized.length,
    enrichedCount: enriched.length,
    insertedCount,
    skipped: false,
    reason: null,
  };

  logger.info("Optimization recommendations sync completed", {
    trigger,
    tenantId,
    billingSourceId: billingSourceId ?? null,
    cloudConnectionId: cloudConnectionId ?? null,
    fetchedCount: result.fetchedCount,
    normalizedCount: result.normalizedCount,
    enrichedCount: result.enrichedCount,
    insertedCount: result.insertedCount,
  });

  return result;
}

export async function syncAwsRightsizingRecommendationsAfterIngestion({
  tenantId,
  billingSourceId,
  ingestionRunId,
}: {
  tenantId: string;
  billingSourceId: string;
  ingestionRunId: string;
}): Promise<void> {
  const result = await syncAwsRightsizingRecommendations({
    tenantId,
    trigger: "INGESTION_COMPLETED",
    billingSourceId,
  });

  if (result.skipped) {
    logger.info("Optimization sync skipped after ingestion", {
      tenantId,
      billingSourceId,
      ingestionRunId,
      reason: result.reason,
    });
  }
}

type LatestSyncRow = {
  last_updated_at: string | Date | null;
};

const isSyncFresh = (lastUpdatedAt: string | Date | null, maxAgeMinutes: number): boolean => {
  if (!lastUpdatedAt) return false;
  const asDate = lastUpdatedAt instanceof Date ? lastUpdatedAt : new Date(String(lastUpdatedAt));
  if (Number.isNaN(asDate.getTime())) return false;
  const ageMs = Date.now() - asDate.getTime();
  return ageMs <= maxAgeMinutes * 60_000;
};

export async function syncAwsRightsizingRecommendationsOnDashboardOpen({
  tenantId,
  maxAgeMinutes = 180,
}: {
  tenantId: string;
  maxAgeMinutes?: number;
}): Promise<OptimizationSyncResult> {
  const rows = await sequelize.query<LatestSyncRow>(
    `
      SELECT MAX(fr.updated_at) AS last_updated_at
      FROM fact_recommendations fr
      WHERE fr.tenant_id = $1
        AND fr.source_system = 'AWS_COMPUTE_OPTIMIZER'
        AND fr.category = 'RIGHTSIZING';
    `,
    {
      bind: [tenantId],
      type: QueryTypes.SELECT,
    },
  );

  const latestUpdatedAt = rows[0]?.last_updated_at ?? null;
  if (isSyncFresh(latestUpdatedAt, maxAgeMinutes)) {
    return {
      trigger: "DASHBOARD_OPEN",
      tenantId,
      fetchedCount: 0,
      normalizedCount: 0,
      enrichedCount: 0,
      insertedCount: 0,
      skipped: true,
      reason: `Recommendations are fresh (updated within ${maxAgeMinutes} minutes)`,
    };
  }

  return syncAwsRightsizingRecommendations({
    tenantId,
    trigger: "DASHBOARD_OPEN",
  });
}
