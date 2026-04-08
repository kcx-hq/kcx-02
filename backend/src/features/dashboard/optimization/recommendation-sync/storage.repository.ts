import { FactRecommendations, sequelize } from "../../../../models/index.js";
import type { EnrichedRightsizingRecommendation } from "./types.js";

export async function replaceOpenRightsizingRecommendationsForTenant({
  tenantId,
  sourceSystem,
  records,
}: {
  tenantId: string;
  sourceSystem: string;
  records: EnrichedRightsizingRecommendation[];
}): Promise<number> {
  const now = new Date();
  return sequelize.transaction(async (transaction) => {
    await FactRecommendations.destroy({
      where: {
        tenantId,
        sourceSystem,
        category: "RIGHTSIZING",
        status: "OPEN",
      },
      transaction,
    });

    if (records.length === 0) {
      return 0;
    }

    await FactRecommendations.bulkCreate(
      records.map((item) => ({
        tenantId: item.tenantId,
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
