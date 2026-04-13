import { FactRecommendations, sequelize } from "../../../../models/index.js";
import { Op } from "sequelize";
import type {
  EnrichedCommitmentRecommendation,
  EnrichedIdleRecommendation,
  EnrichedRightsizingRecommendation,
} from "./types.js";

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
        status: {
          [Op.in]: ["OPEN", "NO_ACTION_NEEDED"],
        },
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

    const ignoredRows = await FactRecommendations.findAll({
      attributes: [
        "awsAccountId",
        "awsRegionCode",
        "resourceId",
        "recommendationType",
        "currentResourceType",
        "recommendedResourceType",
      ],
      where: {
        tenantId,
        sourceSystem,
        category: "RIGHTSIZING",
        status: "IGNORED",
        ...(cloudConnectionId ? { cloudConnectionId } : {}),
        ...(billingSourceId !== null && typeof billingSourceId !== "undefined"
          ? { billingSourceId: String(billingSourceId) }
          : {}),
        ...(normalizedAccountIds.length > 0 ? { awsAccountId: { [Op.in]: normalizedAccountIds } } : {}),
      },
      transaction,
    });

    const buildRightsizingKey = (item: {
      awsAccountId: string | null;
      awsRegionCode: string | null;
      resourceId: string | null;
      recommendationType: string | null;
      currentResourceType: string | null;
      recommendedResourceType: string | null;
    }): string =>
      [
        String(item.awsAccountId ?? "").trim(),
        String(item.awsRegionCode ?? "").trim(),
        String(item.resourceId ?? "").trim(),
        String(item.recommendationType ?? "").trim(),
        String(item.currentResourceType ?? "").trim(),
        String(item.recommendedResourceType ?? "").trim(),
      ].join("|");

    const ignoredKeySet = new Set(
      ignoredRows.map((row) =>
        buildRightsizingKey({
          awsAccountId: row.awsAccountId,
          awsRegionCode: row.awsRegionCode,
          resourceId: row.resourceId,
          recommendationType: row.recommendationType,
          currentResourceType: row.currentResourceType,
          recommendedResourceType: row.recommendedResourceType,
        }),
      ),
    );

    const insertableRecords = records.filter(
      (item) =>
        !ignoredKeySet.has(
          buildRightsizingKey({
            awsAccountId: item.awsAccountId,
            awsRegionCode: item.awsRegionCode,
            resourceId: item.resourceId,
            recommendationType: item.recommendationType,
            currentResourceType: item.currentResourceType,
            recommendedResourceType: item.recommendedResourceType,
          }),
        ),
    );

    if (insertableRecords.length === 0) {
      return 0;
    }

    await FactRecommendations.bulkCreate(
      insertableRecords.map((item) => ({
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

    return insertableRecords.length;
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

    const ignoredRows = await FactRecommendations.findAll({
      attributes: [
        "awsAccountId",
        "awsRegionCode",
        "resourceId",
        "recommendationType",
        "resourceType",
      ],
      where: {
        tenantId,
        sourceSystem,
        category: "IDLE",
        status: "IGNORED",
        ...(cloudConnectionId ? { cloudConnectionId } : {}),
        ...(billingSourceId !== null && typeof billingSourceId !== "undefined"
          ? { billingSourceId: String(billingSourceId) }
          : {}),
        ...(normalizedAccountIds.length > 0 ? { awsAccountId: { [Op.in]: normalizedAccountIds } } : {}),
      },
      transaction,
    });

    const buildIdleKey = (item: {
      awsAccountId: string | null;
      awsRegionCode: string | null;
      resourceId: string | null;
      recommendationType: string | null;
      resourceType: string | null;
    }): string =>
      [
        String(item.awsAccountId ?? "").trim(),
        String(item.awsRegionCode ?? "").trim(),
        String(item.resourceId ?? "").trim(),
        String(item.recommendationType ?? "").trim(),
        String(item.resourceType ?? "").trim(),
      ].join("|");

    const ignoredKeySet = new Set(
      ignoredRows.map((row) =>
        buildIdleKey({
          awsAccountId: row.awsAccountId,
          awsRegionCode: row.awsRegionCode,
          resourceId: row.resourceId,
          recommendationType: row.recommendationType,
          resourceType: row.resourceType,
        }),
      ),
    );

    const insertableRecords = records.filter(
      (item) =>
        !ignoredKeySet.has(
          buildIdleKey({
            awsAccountId: item.awsAccountId,
            awsRegionCode: item.awsRegionCode,
            resourceId: item.resourceId,
            recommendationType: item.recommendationType,
            resourceType: item.resourceType,
          }),
        ),
    );

    if (insertableRecords.length === 0) {
      return 0;
    }

    await FactRecommendations.bulkCreate(
      insertableRecords.map((item) => ({
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

    return insertableRecords.length;
  });
}

export async function replaceOpenCommitmentRecommendationsForTenant({
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
  records: EnrichedCommitmentRecommendation[];
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
        category: "COMMITMENT",
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
        resourceName: item.resourceName,
        currentResourceType: item.currentResourceType,
        recommendedResourceType: item.recommendedResourceType,
        currentMonthlyCost: item.currentMonthlyCost,
        estimatedMonthlySavings: item.estimatedMonthlySavings,
        projectedMonthlyCost: item.projectedMonthlyCost,
        recommendedHourlyCommitment: item.recommendedHourlyCommitment,
        recommendedPaymentOption: item.recommendedPaymentOption,
        recommendedTerm: item.recommendedTerm,
        commitmentPlanType: item.commitmentPlanType,
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
