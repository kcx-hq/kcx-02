import { FactRecommendations, sequelize } from "../../../../models/index.js";
import { Op } from "sequelize";
import type { EnrichedIdleRecommendation, EnrichedRightsizingRecommendation } from "./types.js";

export async function replaceOpenRightsizingRecommendationsForTenant({
  tenantId,
  sourceSystem,
  cloudConnectionId,
  billingSourceId,
  awsAccountIds,
  records,
}: {
  tenantId: string;
  sourceSystem: string;
  cloudConnectionId?: string | null;
  billingSourceId?: string | number | null;
  awsAccountIds?: string[];
  records: EnrichedRightsizingRecommendation[];
}): Promise<number> {
  const now = new Date();
  return sequelize.transaction(async (transaction) => {
    const normalizedAccountIds = Array.isArray(awsAccountIds)
      ? Array.from(
          new Set(
            awsAccountIds
              .map((item) => String(item).trim())
              .filter((item) => item.length > 0),
          ),
        )
      : [];

    await FactRecommendations.destroy({
      where: {
        tenantId,
        sourceSystem,
        category: "RIGHTSIZING",
        status: "OPEN",
        ...(cloudConnectionId ? { cloudConnectionId } : {}),
        ...(billingSourceId !== null && typeof billingSourceId !== "undefined"
          ? { billingSourceId: String(billingSourceId) }
          : {}),
        ...(normalizedAccountIds.length > 0 ? { awsAccountId: { [Op.in]: normalizedAccountIds } } : {}),
      },
      transaction,
    });

    if (records.length === 0) {
      return 0;
    }

    await FactRecommendations.bulkCreate(
      records.map((item) => ({
        tenantId: item.tenantId,
        cloudConnectionId: item.cloudConnectionId,
        billingSourceId: item.billingSourceId,
        awsAccountId: item.awsAccountId,
        awsRegionCode: item.awsRegionCode,
        category: item.category,
        recommendationType: item.recommendationType,
        serviceKey: item.serviceKey,
        subAccountKey: item.subAccountKey,
        regionKey: item.regionKey,
        resourceId: item.resourceId,
        resourceArn: item.resourceArn,
        resourceName: item.resourceName,
        currentResourceType: item.currentResourceType,
        recommendedResourceType: item.recommendedResourceType,
        currentMonthlyCost: item.currentMonthlyCost,
        estimatedMonthlySavings: item.estimatedMonthlySavings,
        projectedMonthlyCost: item.projectedMonthlyCost,
        performanceRiskScore: item.performanceRiskScore,
        performanceRiskLevel: item.performanceRiskLevel,
        sourceSystem: item.sourceSystem,
        status: item.status,
        effortLevel: item.effortLevel,
        riskLevel: item.riskLevel,
        recommendationTitle: item.recommendationTitle,
        recommendationText: item.recommendationText,
        observationStart: item.observationStart,
        observationEnd: item.observationEnd,
        rawPayloadJson: item.rawPayloadJson,
        createdAt: now,
        updatedAt: now,
      })),
      { transaction },
    );

    return records.length;
  });
}

export async function replaceOpenIdleRecommendationsForTenant({
  tenantId,
  sourceSystem,
  cloudConnectionId,
  billingSourceId,
  awsAccountIds,
  records,
}: {
  tenantId: string;
  sourceSystem: string;
  cloudConnectionId?: string | null;
  billingSourceId?: string | number | null;
  awsAccountIds?: string[];
  records: EnrichedIdleRecommendation[];
}): Promise<number> {
  const now = new Date();
  return sequelize.transaction(async (transaction) => {
    const normalizedAccountIds = Array.isArray(awsAccountIds)
      ? Array.from(
          new Set(
            awsAccountIds
              .map((item) => String(item).trim())
              .filter((item) => item.length > 0),
          ),
        )
      : [];

    await FactRecommendations.destroy({
      where: {
        tenantId,
        sourceSystem,
        category: "IDLE",
        status: "OPEN",
        ...(cloudConnectionId ? { cloudConnectionId } : {}),
        ...(billingSourceId !== null && typeof billingSourceId !== "undefined"
          ? { billingSourceId: String(billingSourceId) }
          : {}),
        ...(normalizedAccountIds.length > 0 ? { awsAccountId: { [Op.in]: normalizedAccountIds } } : {}),
      },
      transaction,
    });

    if (records.length === 0) {
      return 0;
    }

    await FactRecommendations.bulkCreate(
      records.map((item) => ({
        tenantId: item.tenantId,
        cloudConnectionId: item.cloudConnectionId,
        billingSourceId: item.billingSourceId,
        awsAccountId: item.awsAccountId,
        awsRegionCode: item.awsRegionCode,
        category: item.category,
        recommendationType: item.recommendationType,
        serviceKey: item.serviceKey,
        subAccountKey: item.subAccountKey,
        regionKey: item.regionKey,
        resourceId: item.resourceId,
        resourceArn: item.resourceArn,
        resourceName: item.resourceName,
        resourceType: item.resourceType,
        currentResourceType: item.currentResourceType,
        recommendedResourceType: item.recommendedResourceType,
        currentMonthlyCost: item.currentMonthlyCost,
        estimatedMonthlySavings: item.estimatedMonthlySavings,
        projectedMonthlyCost: item.projectedMonthlyCost,
        performanceRiskScore: item.performanceRiskScore,
        performanceRiskLevel: item.performanceRiskLevel,
        sourceSystem: item.sourceSystem,
        status: item.status,
        effortLevel: item.effortLevel,
        riskLevel: item.riskLevel,
        recommendationTitle: item.recommendationTitle,
        recommendationText: item.recommendationText,
        idleReason: item.idleReason,
        idleObservationValue: item.idleObservationValue,
        observationStart: item.observationStart,
        observationEnd: item.observationEnd,
        rawPayloadJson: item.rawPayloadJson,
        createdAt: now,
        updatedAt: now,
      })),
      { transaction },
    );

    return records.length;
  });
}
