import { QueryTypes } from "sequelize";
import { ClientCloudAccount, sequelize } from "../../../../models/index.js";
import { logger } from "../../../../utils/logger.js";
import { enrichRightsizingRecommendations } from "./enrichment.service.js";
import { enrichIdleRecommendations } from "./idle-enrichment.service.js";
import { normalizeAwsIdleRecommendations } from "./idle-normalization.service.js";
import { normalizeAwsEc2Recommendations } from "./normalization.service.js";
import {
  replaceOpenIdleRecommendationsForTenant,
  replaceOpenRightsizingRecommendationsForTenant,
} from "./storage.repository.js";
import {
  fetchAwsEc2RightsizingRecommendationsFromComputeOptimizer,
  fetchAwsIdleRecommendations,
  resolveAwsSyncContext,
} from "./aws-recommendations.source.js";
import type {
  AwsComputeOptimizerEc2RecommendationInput,
  AwsIdleResourceRecommendationInput,
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

  const accountIdForTracking = String(context.connection.cloudAccountId ?? "").trim();
  if (accountIdForTracking) {
    const existing = await ClientCloudAccount.findOne({
      where: {
        tenantId,
        providerId: context.providerId,
        accountId: accountIdForTracking,
      },
    });

    const trackingPatch = {
      cloudConnectionId: context.connection.id,
      onboardingStatus: "connected",
      computeOptimizerEnabled: fetched.skipped ? false : true,
      lastRecommendationSyncAt: new Date(),
      lastSyncStatus: fetched.skipped ? "skipped" : "success",
      lastSyncMessage: fetched.reason,
      updatedAt: new Date(),
    };

    if (!existing) {
      await ClientCloudAccount.create({
        tenantId,
        providerId: context.providerId,
        cloudConnectionId: context.connection.id,
        accountId: accountIdForTracking,
        accountName: context.connection.connectionName ?? null,
        onboardingStatus: "connected",
        computeOptimizerEnabled: fetched.skipped ? false : true,
        lastRecommendationSyncAt: new Date(),
        lastSyncStatus: fetched.skipped ? "skipped" : "success",
        lastSyncMessage: fetched.reason,
      });
    } else {
      await existing.update(trackingPatch);
    }
  }

  if (fetched.recommendations.length === 0) {
    if (!fetched.skipped) {
      const accountIdForCleanup = String(context.connection.cloudAccountId ?? "").trim();
      await replaceOpenRightsizingRecommendationsForTenant({
        tenantId,
        sourceSystem: "AWS_COMPUTE_OPTIMIZER",
        cloudConnectionId: context.connection.id,
        billingSourceId: String(context.billingSource.id),
        awsAccountIds: accountIdForCleanup ? [accountIdForCleanup] : undefined,
        records: [],
      });
    }

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
  if (normalized.length === 0) {
    return {
      trigger,
      tenantId,
      fetchedCount: fetched.recommendations.length,
      normalizedCount: 0,
      enrichedCount: 0,
      insertedCount: 0,
      skipped: true,
      reason:
        "Rightsizing candidates were fetched from AWS, but none passed normalization (missing required account/region/resource fields)",
    };
  }

  const enriched = await enrichRightsizingRecommendations({
    tenantId,
    providerId: context.providerId,
    cloudConnectionId: context.connection.id,
    billingSourceId: String(context.billingSource.id),
    normalizedRecords: normalized,
  });
  const insertedCount = await replaceOpenRightsizingRecommendationsForTenant({
    tenantId,
    sourceSystem: "AWS_COMPUTE_OPTIMIZER",
    cloudConnectionId: context.connection.id,
    billingSourceId: String(context.billingSource.id),
    awsAccountIds: Array.from(new Set(normalized.map((record) => record.awsAccountId))),
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

export async function syncAwsIdleRecommendations({
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
  recommendations?: AwsIdleResourceRecommendationInput[];
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
        reason: "Idle recommendations provided by caller",
        recommendations,
      }
    : await fetchAwsIdleRecommendations({
        connection: context.connection,
      });

  if (fetched.recommendations.length === 0) {
    if (!fetched.skipped) {
      const accountIdForCleanup = String(context.connection.cloudAccountId ?? "").trim();
      await replaceOpenIdleRecommendationsForTenant({
        tenantId,
        sourceSystem: "AWS_IDLE_DETECTION",
        cloudConnectionId: context.connection.id,
        billingSourceId: String(context.billingSource.id),
        awsAccountIds: accountIdForCleanup ? [accountIdForCleanup] : undefined,
        records: [],
      });
    }

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

  const normalized = normalizeAwsIdleRecommendations({
    tenantId,
    recommendations: fetched.recommendations,
  });
  if (normalized.length === 0) {
    return {
      trigger,
      tenantId,
      fetchedCount: fetched.recommendations.length,
      normalizedCount: 0,
      enrichedCount: 0,
      insertedCount: 0,
      skipped: true,
      reason:
        "Idle candidates were fetched from AWS, but none passed normalization (missing required account/region/resource fields)",
    };
  }

  const enriched = await enrichIdleRecommendations({
    tenantId,
    providerId: context.providerId,
    cloudConnectionId: context.connection.id,
    billingSourceId: String(context.billingSource.id),
    normalizedRecords: normalized,
  });
  const insertedCount = await replaceOpenIdleRecommendationsForTenant({
    tenantId,
    sourceSystem: "AWS_IDLE_DETECTION",
    cloudConnectionId: context.connection.id,
    billingSourceId: String(context.billingSource.id),
    awsAccountIds: Array.from(new Set(normalized.map((record) => record.awsAccountId))),
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

  logger.info("Idle recommendations sync completed", {
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

export async function syncAwsIdleRecommendationsAfterIngestion({
  tenantId,
  billingSourceId,
  ingestionRunId,
}: {
  tenantId: string;
  billingSourceId: string;
  ingestionRunId: string;
}): Promise<void> {
  const result = await syncAwsIdleRecommendations({
    tenantId,
    trigger: "INGESTION_COMPLETED",
    billingSourceId,
  });

  if (result.skipped) {
    logger.info("Idle recommendations sync skipped after ingestion", {
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
        AND (
          REGEXP_REPLACE(UPPER(COALESCE(fr.category, '')), '[^A-Z]', '', 'g') = 'RIGHTSIZING'
          OR REGEXP_REPLACE(UPPER(COALESCE(fr.recommendation_type, '')), '[^A-Z]', '', 'g') = 'RIGHTSIZING'
        );
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

export async function syncAwsRightsizingRecommendationsOnRecommendationsOpen({
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
        AND (
          REGEXP_REPLACE(UPPER(COALESCE(fr.category, '')), '[^A-Z]', '', 'g') = 'RIGHTSIZING'
          OR REGEXP_REPLACE(UPPER(COALESCE(fr.recommendation_type, '')), '[^A-Z]', '', 'g') = 'RIGHTSIZING'
        );
    `,
    {
      bind: [tenantId],
      type: QueryTypes.SELECT,
    },
  );

  const latestUpdatedAt = rows[0]?.last_updated_at ?? null;
  if (isSyncFresh(latestUpdatedAt, maxAgeMinutes)) {
    return {
      trigger: "RECOMMENDATIONS_OPEN",
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
    trigger: "RECOMMENDATIONS_OPEN",
  });
}

export async function syncAwsIdleRecommendationsOnRecommendationsOpen({
  tenantId,
  maxAgeMinutes = 100,
}: {
  tenantId: string;
  maxAgeMinutes?: number;
}): Promise<OptimizationSyncResult> {
  const rows = await sequelize.query<LatestSyncRow>(
    `
      SELECT MAX(fr.updated_at) AS last_updated_at
      FROM fact_recommendations fr
      WHERE fr.tenant_id = $1
        AND fr.source_system = 'AWS_IDLE_DETECTION'
        AND REGEXP_REPLACE(UPPER(COALESCE(fr.category, '')), '[^A-Z]', '', 'g') = 'IDLE';
    `,
    {
      bind: [tenantId],
      type: QueryTypes.SELECT,
    },
  );

  const latestUpdatedAt = rows[0]?.last_updated_at ?? null;
  if (isSyncFresh(latestUpdatedAt, maxAgeMinutes)) {
    return {
      trigger: "RECOMMENDATIONS_OPEN",
      tenantId,
      fetchedCount: 0,
      normalizedCount: 0,
      enrichedCount: 0,
      insertedCount: 0,
      skipped: true,
      reason: `Idle recommendations are fresh (updated within ${maxAgeMinutes} minutes)`,
    };
  }

  return syncAwsIdleRecommendations({
    tenantId,
    trigger: "RECOMMENDATIONS_OPEN",
  });
}
