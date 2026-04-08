import { BillingSource, CloudConnectionV2, CloudProvider } from "../../../../models/index.js";
import { assumeRole } from "../../../cloud-connections/aws/infrastructure/aws-sts.service.js";
import type { AwsComputeOptimizerEc2RecommendationInput } from "./types.js";

type ResolveAwsSyncContextResult =
  | {
      ok: true;
      tenantId: string;
      providerId: string;
      connection: InstanceType<typeof CloudConnectionV2>;
      billingSource: InstanceType<typeof BillingSource>;
    }
  | {
      ok: false;
      reason: string;
    };

export async function resolveAwsSyncContext({
  tenantId,
  billingSourceId,
  cloudConnectionId,
}: {
  tenantId: string;
  billingSourceId?: string | null;
  cloudConnectionId?: string | null;
}): Promise<ResolveAwsSyncContextResult> {
  let billingSource: InstanceType<typeof BillingSource> | null = null;

  if (billingSourceId) {
    billingSource = await BillingSource.findOne({
      where: {
        id: billingSourceId,
        tenantId,
      },
    });
  } else if (cloudConnectionId) {
    billingSource = await BillingSource.findOne({
      where: {
        cloudConnectionId,
        tenantId,
      },
      order: [["updatedAt", "DESC"]],
    });
  } else {
    billingSource = await BillingSource.findOne({
      where: {
        tenantId,
      },
      order: [["updatedAt", "DESC"]],
    });
  }

  if (!billingSource) {
    return { ok: false, reason: "No billing source found for tenant context" };
  }

  if (!billingSource.cloudConnectionId) {
    return { ok: false, reason: "Billing source is not connected to a cloud connection" };
  }

  const provider = await CloudProvider.findByPk(String(billingSource.cloudProviderId));
  if (!provider || provider.code.toLowerCase() !== "aws") {
    return { ok: false, reason: "Billing source provider is not AWS" };
  }

  const connection = await CloudConnectionV2.findOne({
    where: {
      id: billingSource.cloudConnectionId,
      tenantId,
    },
  });
  if (!connection) {
    return { ok: false, reason: "Cloud connection not found for billing source" };
  }

  return {
    ok: true,
    tenantId,
    providerId: String(billingSource.cloudProviderId),
    connection,
    billingSource,
  };
}

export async function fetchAwsEc2RightsizingRecommendationsFromComputeOptimizer({
  connection,
}: {
  connection: InstanceType<typeof CloudConnectionV2>;
}): Promise<{
  skipped: boolean;
  reason: string;
  recommendations: AwsComputeOptimizerEc2RecommendationInput[];
}> {
  const roleArn = String(connection.roleArn ?? "").trim();
  if (!roleArn) {
    return {
      skipped: true,
      reason: "Cloud connection role ARN is missing",
      recommendations: [],
    };
  }

  const moduleName = "@aws-sdk/client-compute-optimizer";
  let computeOptimizerSdk: Record<string, unknown>;
  try {
    computeOptimizerSdk = (await import(moduleName)) as Record<string, unknown>;
  } catch {
    return {
      skipped: true,
      reason: "Missing dependency @aws-sdk/client-compute-optimizer",
      recommendations: [],
    };
  }

  const ComputeOptimizerClient = computeOptimizerSdk.ComputeOptimizerClient as
    | (new (args: {
        region: string;
        credentials: {
          accessKeyId: string;
          secretAccessKey: string;
          sessionToken: string;
        };
      }) => {
        send: (command: unknown) => Promise<{
          instanceRecommendations?: unknown[];
          nextToken?: string;
        }>;
      })
    | undefined;
  const GetEC2InstanceRecommendationsCommand =
    computeOptimizerSdk.GetEC2InstanceRecommendationsCommand as
      | (new (args: Record<string, unknown>) => unknown)
      | undefined;

  if (!ComputeOptimizerClient || !GetEC2InstanceRecommendationsCommand) {
    return {
      skipped: true,
      reason: "Compute Optimizer SDK symbols not available",
      recommendations: [],
    };
  }

  const credentials = await assumeRole(roleArn, connection.externalId ?? null);
  const accountId = String(connection.cloudAccountId ?? "").trim();
  const region = String(connection.exportRegion ?? connection.region ?? "us-east-1").trim() || "us-east-1";
  const client = new ComputeOptimizerClient({
    region,
    credentials,
  });

  const allRecommendations: AwsComputeOptimizerEc2RecommendationInput[] = [];
  let nextToken: string | undefined;

  const toRiskBand = (riskValue: unknown): "LOW" | "MEDIUM" | "HIGH" | null => {
    const normalized = String(riskValue ?? "")
      .trim()
      .toLowerCase();
    if (!normalized) return null;
    if (normalized.includes("high")) return "HIGH";
    if (normalized.includes("low")) return "LOW";
    if (normalized.includes("medium")) return "MEDIUM";
    return null;
  };

  const toRiskScore = (riskValue: unknown): number | null => {
    const normalized = String(riskValue ?? "")
      .trim()
      .toLowerCase();
    if (!normalized) return null;
    if (normalized.includes("very_low")) return 0.1;
    if (normalized.includes("low")) return 0.3;
    if (normalized.includes("medium")) return 0.6;
    if (normalized.includes("high")) return 0.9;
    return null;
  };

  const toStringOrNumber = (value: unknown): string | number | null => {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "string") {
      const normalized = value.trim();
      return normalized.length > 0 ? normalized : null;
    }
    return null;
  };

  const parseResourceIdFromArn = (arn: string | null): string | null => {
    if (!arn) return null;
    const slashIndex = arn.lastIndexOf("/");
    if (slashIndex === -1) return arn;
    const parsed = arn.slice(slashIndex + 1).trim();
    return parsed.length > 0 ? parsed : null;
  };

  const parseRegionFromArn = (arn: string | null): string | null => {
    if (!arn) return null;
    const parts = arn.split(":");
    if (parts.length < 4) return null;
    const parsed = parts[3].trim();
    return parsed.length > 0 ? parsed : null;
  };

  do {
    const command = new GetEC2InstanceRecommendationsCommand({
      ...(accountId ? { accountIds: [accountId] } : {}),
      maxResults: 1000,
      ...(nextToken ? { nextToken } : {}),
    });

    const response = await client.send(command);
    const instanceRecommendations = Array.isArray(response.instanceRecommendations)
      ? response.instanceRecommendations
      : [];

    for (const rawItem of instanceRecommendations) {
      const item = rawItem as Record<string, unknown>;
      const recommendationOptions = Array.isArray(item.recommendationOptions)
        ? (item.recommendationOptions as Array<Record<string, unknown>>)
        : [];
      const bestOption = recommendationOptions[0] ?? null;

      const instanceArn = String(item.instanceArn ?? "").trim() || null;
      const resolvedResourceId =
        parseResourceIdFromArn(instanceArn) ??
        (typeof item.instanceName === "string" && item.instanceName.trim()
          ? item.instanceName.trim()
          : null);
      if (!resolvedResourceId) {
        continue;
      }

      const resolvedRegion =
        parseRegionFromArn(instanceArn) ??
        (typeof item.currentPerformanceRisk === "string" && region ? region : null) ??
        region;
      const resolvedAccountId =
        (typeof item.accountId === "string" && item.accountId.trim() ? item.accountId.trim() : null) ??
        accountId;
      if (!resolvedAccountId || !resolvedRegion) {
        continue;
      }

      const performanceRisk = bestOption?.performanceRisk ?? item.currentPerformanceRisk ?? null;
      const savings = bestOption?.savingsOpportunity as Record<string, unknown> | undefined;
      const estimatedMonthlySavingsValue =
        savings && typeof savings === "object"
          ? (savings.estimatedMonthlySavings as Record<string, unknown> | undefined)?.value
          : null;

      const currentInstanceType =
        typeof item.currentInstanceType === "string" ? item.currentInstanceType : null;
      const recommendedInstanceType =
        bestOption && typeof bestOption.instanceType === "string" ? bestOption.instanceType : null;

      const recommendationTitle = "EC2 rightsizing recommendation";
      const recommendationText =
        currentInstanceType && recommendedInstanceType
          ? `Resize ${resolvedResourceId} from ${currentInstanceType} to ${recommendedInstanceType}`
          : `Review EC2 rightsizing recommendation for ${resolvedResourceId}`;

      allRecommendations.push({
        accountId: resolvedAccountId,
        region: resolvedRegion,
        resourceId: resolvedResourceId,
        resourceArn: instanceArn,
        resourceName: typeof item.instanceName === "string" ? item.instanceName : null,
        currentInstanceType,
        recommendedInstanceType,
        performanceRiskScore: toRiskScore(performanceRisk),
        performanceRiskLevel: toRiskBand(performanceRisk),
        estimatedMonthlySavings: toStringOrNumber(estimatedMonthlySavingsValue) ?? 0,
        recommendationTitle,
        recommendationText,
        effortLevel: "LOW",
        riskLevel: toRiskBand(performanceRisk),
        observationStart: null,
        observationEnd: null,
        rawPayload: item,
      });
    }

    nextToken = typeof response.nextToken === "string" && response.nextToken.trim() ? response.nextToken : undefined;
  } while (nextToken);

  return {
    skipped: false,
    reason: allRecommendations.length > 0 ? "Fetched from AWS Compute Optimizer" : "No EC2 recommendations returned",
    recommendations: allRecommendations,
  };
}
