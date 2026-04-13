import { QueryTypes } from "sequelize";
import { ClientCloudAccount, sequelize } from "../../../../models/index.js";
import { logger } from "../../../../utils/logger.js";
import { enrichRightsizingRecommendations } from "./enrichment.service.js";
import { enrichIdleRecommendations } from "./idle-enrichment.service.js";
import { normalizeAwsIdleRecommendations } from "./idle-normalization.service.js";
import { normalizeAwsEc2Recommendations } from "./normalization.service.js";
import {
  replaceOpenCommitmentRecommendationsForTenant,
  replaceOpenIdleRecommendationsForTenant,
  replaceOpenRightsizingRecommendationsForTenant,
} from "./storage.repository.js";
import {
  fetchAwsCommitmentRecommendationsFromCostExplorer,
  fetchAwsEc2RightsizingRecommendationsFromComputeOptimizer,
  fetchAwsIdleRecommendations,
  resolveAwsSyncContext,
} from "./aws-recommendations.source.js";
import type {
  AwsCommitmentRecommendationInput,
  AwsComputeOptimizerEc2RecommendationInput,
  AwsIdleResourceRecommendationInput,
  EnrichedCommitmentRecommendation,
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

const toNumber = (value: unknown): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const toDateOrNull = (value: unknown): Date | null => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

export async function syncAwsCommitmentRecommendations({
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
  recommendations?: AwsCommitmentRecommendationInput[];
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
        reason: "Commitment recommendations provided by caller",
        recommendations,
      }
    : await fetchAwsCommitmentRecommendationsFromCostExplorer({
        connection: context.connection,
      });

  if (fetched.recommendations.length === 0) {
    if (!fetched.skipped) {
      const accountIdForCleanup = String(context.connection.cloudAccountId ?? "").trim();
      await replaceOpenCommitmentRecommendationsForTenant({
        tenantId,
        sourceSystem: "AWS_SAVINGS_PLANS_API",
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

  const normalized = fetched.recommendations
    .map((item) => {
      const awsAccountId = String(item.accountId ?? "").trim();
      if (!awsAccountId) return null;

      const rawPayloadJson =
        typeof item.rawPayload === "undefined" ? null : JSON.stringify(item.rawPayload);

      const row: EnrichedCommitmentRecommendation = {
        tenantId,
        cloudConnectionId: context.connection.id,
        billingSourceId: String(context.billingSource.id),
        awsAccountId,
        awsRegionCode: item.region ? String(item.region) : null,
        category: "COMMITMENT",
        recommendationType: item.recommendationType,
        serviceKey: null,
        subAccountKey: null,
        regionKey: null,
        resourceId: item.resourceId ? String(item.resourceId) : null,
        resourceName: item.resourceName ? String(item.resourceName) : null,
        currentResourceType: item.currentResourceType ? String(item.currentResourceType) : null,
        recommendedResourceType: item.recommendedResourceType ? String(item.recommendedResourceType) : null,
        currentMonthlyCost: toNumber(item.currentMonthlyCost),
        estimatedMonthlySavings: toNumber(item.estimatedMonthlySavings),
        projectedMonthlyCost: toNumber(item.projectedMonthlyCost),
        recommendedHourlyCommitment: toNumber(item.recommendedHourlyCommitment),
        recommendedPaymentOption: item.recommendedPaymentOption ?? null,
        recommendedTerm: item.recommendedTerm ?? null,
        commitmentPlanType: item.commitmentPlanType ?? null,
        performanceRiskScore:
          item.performanceRiskScore === null || typeof item.performanceRiskScore === "undefined"
            ? null
            : toNumber(item.performanceRiskScore),
        performanceRiskLevel: item.performanceRiskLevel ?? null,
        sourceSystem: "AWS_SAVINGS_PLANS_API",
        status: "OPEN",
        effortLevel: item.effortLevel ?? "LOW",
        riskLevel: item.riskLevel ?? "MEDIUM",
        recommendationTitle: item.recommendationTitle ?? null,
        recommendationText: item.recommendationText ?? null,
        observationStart: toDateOrNull(item.observationStart),
        observationEnd: toDateOrNull(item.observationEnd),
        rawPayloadJson,
      };

      return row;
    })
    .filter((item): item is EnrichedCommitmentRecommendation => Boolean(item));

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
        "Commitment candidates were fetched from AWS, but none passed normalization (missing required account fields)",
    };
  }

  const insertedCount = await replaceOpenCommitmentRecommendationsForTenant({
    tenantId,
    sourceSystem: "AWS_SAVINGS_PLANS_API",
    cloudConnectionId: context.connection.id,
    billingSourceId: String(context.billingSource.id),
    awsAccountIds: Array.from(new Set(normalized.map((record) => record.awsAccountId))),
    records: normalized,
  });

  const result: OptimizationSyncResult = {
    trigger,
    tenantId,
    fetchedCount: fetched.recommendations.length,
    normalizedCount: normalized.length,
    enrichedCount: normalized.length,
    insertedCount,
    skipped: false,
    reason: null,
  };

  logger.info("Commitment recommendations sync completed", {
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

export async function syncAwsCommitmentRecommendationsWithFreshness({
  tenantId,
  trigger,
  maxAgeMinutes = 360,
  billingSourceId,
  cloudConnectionId,
  recommendations,
}: {
  tenantId: string;
  trigger: OptimizationSyncTrigger;
  maxAgeMinutes?: number;
  billingSourceId?: string | null;
  cloudConnectionId?: string | null;
  recommendations?: AwsCommitmentRecommendationInput[];
}): Promise<OptimizationSyncResult> {
  if (Array.isArray(recommendations)) {
    return syncAwsCommitmentRecommendations({
      tenantId,
      trigger,
      billingSourceId,
      cloudConnectionId,
      recommendations,
    });
  }

  const rows = await sequelize.query<LatestSyncRow>(
    `
      SELECT MAX(fr.updated_at) AS last_updated_at
      FROM fact_recommendations fr
      WHERE fr.tenant_id = $1
        AND fr.source_system = 'AWS_SAVINGS_PLANS_API'
        AND REGEXP_REPLACE(UPPER(COALESCE(fr.category, '')), '[^A-Z]', '', 'g') = 'COMMITMENT';
    `,
    {
      bind: [tenantId],
      type: QueryTypes.SELECT,
    },
  );

  const latestUpdatedAt = rows[0]?.last_updated_at ?? null;
  if (isSyncFresh(latestUpdatedAt, maxAgeMinutes)) {
    return {
      trigger,
      tenantId,
      fetchedCount: 0,
      normalizedCount: 0,
      enrichedCount: 0,
      insertedCount: 0,
      skipped: true,
      reason: `Commitment recommendations are fresh (updated within ${maxAgeMinutes} minutes)`,
    };
  }

  return syncAwsCommitmentRecommendations({
    tenantId,
    trigger,
    billingSourceId,
    cloudConnectionId,
  });
}
