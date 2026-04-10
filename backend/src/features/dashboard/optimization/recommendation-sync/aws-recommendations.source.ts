import { BillingSource, CloudConnectionV2, CloudProvider } from "../../../../models/index.js";
import { assumeRole } from "../../../cloud-connections/aws/infrastructure/aws-sts.service.js";
import { logger } from "../../../../utils/logger.js";
import type {
  AwsCommitmentRecommendationInput,
  AwsComputeOptimizerEc2RecommendationInput,
  AwsIdleResourceRecommendationInput,
} from "./types.js";

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
  const roleArn = String(connection.billingRoleArn ?? "").trim();
  if (!roleArn) {
    return {
      skipped: true,
      reason: "Cloud connection billing role ARN is missing",
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
  const GetEnrollmentStatusCommand = computeOptimizerSdk.GetEnrollmentStatusCommand as
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

  if (GetEnrollmentStatusCommand) {
    try {
      const enrollmentResponse = (await client.send(new GetEnrollmentStatusCommand({}))) as {
        status?: unknown;
      };
      const enrollmentStatus = String(enrollmentResponse?.status ?? "")
        .trim()
        .toLowerCase();
      if (enrollmentStatus && enrollmentStatus !== "active") {
        return {
          skipped: true,
          reason: `Compute Optimizer enrollment status is ${enrollmentStatus} (region ${region}). Activate Compute Optimizer for this AWS account/region.`,
          recommendations: [],
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        skipped: true,
        reason: `Unable to check Compute Optimizer enrollment: ${message}`,
        recommendations: [],
      };
    }
  }

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

    let response: { instanceRecommendations?: unknown[]; nextToken?: string };
    try {
      response = await client.send(command);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const normalized = message.toLowerCase();
      if (
        normalized.includes("not registered for recommendation") ||
        normalized.includes("not enrolled") ||
        normalized.includes("getec2instancerecommendations")
      ) {
        return {
          skipped: true,
          reason: `AWS account is not enrolled/registered for Compute Optimizer recommendations (region ${region}).`,
          recommendations: [],
        };
      }

      if (normalized.includes("accessdenied") || normalized.includes("not authorized")) {
        return {
          skipped: true,
          reason: `Permission denied while fetching Compute Optimizer recommendations: ${message}`,
          recommendations: [],
        };
      }

      throw error;
    }
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

const toNumeric = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toStringOrNull = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export async function fetchAwsCommitmentRecommendationsFromCostExplorer({
  connection,
}: {
  connection: InstanceType<typeof CloudConnectionV2>;
}): Promise<{
  skipped: boolean;
  reason: string;
  recommendations: AwsCommitmentRecommendationInput[];
}> {
  const roleArn = String(connection.billingRoleArn ?? "").trim();
  if (!roleArn) {
    logger.warn("Commitment fetch skipped: missing billing role ARN", {
      cloudConnectionId: connection.id,
      connectionName: connection.connectionName ?? null,
    });
    return {
      skipped: true,
      reason: "Cloud connection billing role ARN is missing",
      recommendations: [],
    };
  }

  let costExplorerSdk: Record<string, unknown>;
  try {
    const moduleName = "@aws-sdk/client-cost-explorer";
    costExplorerSdk = (await import(moduleName)) as Record<string, unknown>;
  } catch {
    return {
      skipped: true,
      reason: "Missing dependency @aws-sdk/client-cost-explorer",
      recommendations: [],
    };
  }

  const CostExplorerClient = costExplorerSdk.CostExplorerClient as
    | (new (args: {
        region: string;
        credentials: {
          accessKeyId: string;
          secretAccessKey: string;
          sessionToken: string;
        };
      }) => { send: (command: unknown) => Promise<Record<string, unknown>> })
    | undefined;
  const StartSavingsPlansPurchaseRecommendationGenerationCommand =
    costExplorerSdk.StartSavingsPlansPurchaseRecommendationGenerationCommand as
      | (new (args: Record<string, unknown>) => unknown)
      | undefined;
  const GetSavingsPlansPurchaseRecommendationCommand =
    costExplorerSdk.GetSavingsPlansPurchaseRecommendationCommand as
      | (new (args: Record<string, unknown>) => unknown)
      | undefined;
  const GetSavingsPlanPurchaseRecommendationDetailsCommand =
    costExplorerSdk.GetSavingsPlanPurchaseRecommendationDetailsCommand as
      | (new (args: Record<string, unknown>) => unknown)
      | undefined;

  if (
    !CostExplorerClient ||
    !StartSavingsPlansPurchaseRecommendationGenerationCommand ||
    !GetSavingsPlansPurchaseRecommendationCommand
  ) {
    return {
      skipped: true,
      reason: "Cost Explorer SDK symbols not available",
      recommendations: [],
    };
  }

  const credentials = await assumeRole(roleArn, connection.externalId ?? null);
  const accountId =
    String(connection.cloudAccountId ?? "").trim() || parseAccountIdFromRoleArn(roleArn) || "";
  logger.info("Commitment fetch started", {
    cloudConnectionId: connection.id,
    connectionName: connection.connectionName ?? null,
    accountId: accountId || null,
  });

  const client = new CostExplorerClient({
    region: "us-east-1",
    credentials,
  });

  try {
    await client.send(new StartSavingsPlansPurchaseRecommendationGenerationCommand({}));
    logger.info("Commitment fetch generation started successfully", {
      cloudConnectionId: connection.id,
      accountId: accountId || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn("Commitment fetch generation call failed", {
      cloudConnectionId: connection.id,
      accountId: accountId || null,
      message,
    });
    const normalized = message.toLowerCase();
    if (normalized.includes("accessdenied") || normalized.includes("not authorized")) {
      return {
        skipped: true,
        reason: `Permission denied while starting Savings Plans recommendation generation: ${message}`,
        recommendations: [],
      };
    }
    if (normalized.includes("cost explorer")) {
      return {
        skipped: true,
        reason: `Cost Explorer is not enabled or data not ready yet. ${message}`,
        recommendations: [],
      };
    }
  }

  const planTypes = ["COMPUTE_SP", "EC2_INSTANCE_SP"] as const;
  const terms = ["ONE_YEAR", "THREE_YEARS"] as const;
  const payments = ["NO_UPFRONT", "PARTIAL_UPFRONT", "ALL_UPFRONT"] as const;

  const mapped: AwsCommitmentRecommendationInput[] = [];
  const seen = new Set<string>();

  for (const planType of planTypes) {
    for (const term of terms) {
      for (const payment of payments) {
        let response: Record<string, unknown>;
        try {
          logger.info("Commitment fetch recommendation call", {
            cloudConnectionId: connection.id,
            accountId: accountId || null,
            planType,
            term,
            payment,
          });
          response = await client.send(
            new GetSavingsPlansPurchaseRecommendationCommand({
              SavingsPlansType: planType,
              TermInYears: term,
              PaymentOption: payment,
              LookbackPeriodInDays: "THIRTY_DAYS",
            }),
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logger.warn("Commitment fetch recommendation call failed", {
            cloudConnectionId: connection.id,
            accountId: accountId || null,
            planType,
            term,
            payment,
            message,
          });
          const normalized = message.toLowerCase();
          if (
            normalized.includes("accessdenied") ||
            normalized.includes("not authorized") ||
            normalized.includes("cost explorer")
          ) {
            continue;
          }
          continue;
        }

        const recommendation = response.SavingsPlansPurchaseRecommendation as Record<string, unknown> | undefined;
        const details = Array.isArray(recommendation?.SavingsPlansPurchaseRecommendationDetails)
          ? (recommendation?.SavingsPlansPurchaseRecommendationDetails as Array<Record<string, unknown>>)
          : [];

        for (const detail of details) {
          const nestedDetails =
            detail["SavingsPlansDetails"] && typeof detail["SavingsPlansDetails"] === "object"
              ? (detail["SavingsPlansDetails"] as Record<string, unknown>)
              : null;
          const recommendationDetailId =
            toStringOrNull(nestedDetails?.["SavingsPlansDetailsId"]) ??
            toStringOrNull(detail["SavingsPlanDetailsId"]) ??
            toStringOrNull(detail["RecommendationDetailId"]);
          const dedupeKey = [planType, term, payment, recommendationDetailId ?? ""].join("|");
          if (seen.has(dedupeKey)) continue;
          seen.add(dedupeKey);

          let detailPayload: Record<string, unknown> | null = null;
          if (GetSavingsPlanPurchaseRecommendationDetailsCommand && recommendationDetailId) {
            try {
              detailPayload = await client.send(
                new GetSavingsPlanPurchaseRecommendationDetailsCommand({
                  RecommendationDetailId: recommendationDetailId,
                  LookbackPeriodInDays: "THIRTY_DAYS",
                  SavingsPlansType: planType,
                  TermInYears: term,
                  PaymentOption: payment,
                }),
              );
            } catch {
              detailPayload = null;
              logger.warn("Commitment detail fetch failed for recommendation", {
                cloudConnectionId: connection.id,
                accountId: accountId || null,
                planType,
                term,
                payment,
                recommendationDetailId,
              });
            }
          }

          const currentMonthlyCost =
            toNumeric(detail["CurrentAverageHourlyOnDemandSpend"]) !== null
              ? (toNumeric(detail["CurrentAverageHourlyOnDemandSpend"]) ?? 0) * 24 * 30
              : 0;
          const recommendedHourlyCommitment =
            toNumeric(detail["HourlyCommitmentToPurchase"]) ??
            toNumeric(detail["HourlyCommitmentToPurchaseAmount"]) ??
            0;
          const projectedMonthlyCost =
            recommendedHourlyCommitment > 0 ? recommendedHourlyCommitment * 24 * 30 : 0;
          const estimatedMonthlySavings =
            toNumeric(detail["EstimatedMonthlySavingsAmount"]) ??
            Math.max(0, currentMonthlyCost - projectedMonthlyCost);

          const resourceId = recommendationDetailId ?? `sp-${planType}-${term}-${payment}`;
          mapped.push({
            accountId,
            region: null,
            recommendationType: planType === "COMPUTE_SP" ? "BUY_COMPUTE_SP" : "BUY_EC2_INSTANCE_SP",
            resourceId,
            resourceName: planType === "COMPUTE_SP" ? "Compute Savings Plan" : "EC2 Instance Savings Plan",
            currentResourceType: null,
            recommendedResourceType: null,
            currentMonthlyCost,
            estimatedMonthlySavings,
            projectedMonthlyCost,
            recommendedHourlyCommitment,
            recommendedPaymentOption: payment,
            recommendedTerm: term,
            commitmentPlanType: planType,
            performanceRiskScore: null,
            performanceRiskLevel: null,
            recommendationTitle:
              planType === "COMPUTE_SP" ? "Buy Compute Savings Plan" : "Buy EC2 Instance Savings Plan",
            recommendationText:
              `Purchase ${planType} (${term}, ${payment}) with hourly commitment ${recommendedHourlyCommitment.toFixed(
                4,
              )}`,
            effortLevel: "LOW",
            riskLevel: "MEDIUM",
            observationStart: null,
            observationEnd: null,
            rawPayload: {
              summaryResponse: response,
              recommendationDetail: detail,
              recommendationDetailPayload: detailPayload,
            },
          });
        }
      }
    }
  }

  if (mapped.length === 0) {
    logger.info("Commitment fetch completed with no recommendations", {
      cloudConnectionId: connection.id,
      accountId: accountId || null,
    });
    return {
      skipped: false,
      reason: "No Savings Plans purchase recommendations returned from Cost Explorer",
      recommendations: [],
    };
  }

  logger.info("Commitment fetch completed", {
    cloudConnectionId: connection.id,
    accountId: accountId || null,
    recommendationCount: mapped.length,
  });
  return {
    skipped: false,
    reason: "Fetched commitment recommendations from AWS Cost Explorer",
    recommendations: mapped,
  };
}

const IDLE_LOOKBACK_DAYS = 7;
const SNAPSHOT_AGE_THRESHOLD_DAYS = 90;

const toIso = (value: Date | null): string | null => (value ? value.toISOString() : null);

const parseRoleRegion = (connection: InstanceType<typeof CloudConnectionV2>): string =>
  String(connection.exportRegion ?? connection.region ?? "us-east-1").trim() || "us-east-1";

const parseAccountIdFromRoleArn = (roleArn: string): string | null => {
  const parts = String(roleArn ?? "").split(":");
  if (parts.length < 5) return null;
  const accountId = String(parts[4] ?? "").trim();
  return accountId.length > 0 ? accountId : null;
};

const getDateDaysAgo = (daysAgo: number): Date => new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

const normalizeLbDimension = (arn: string): string | null => {
  const marker = "loadbalancer/";
  const index = arn.indexOf(marker);
  if (index === -1) return null;
  const value = arn.slice(index + marker.length).trim();
  return value.length > 0 ? value : null;
};

const toMetricStat = ({
  namespace,
  metricName,
  lbDimension,
  periodSeconds,
}: {
  namespace: string;
  metricName: string;
  lbDimension: string;
  periodSeconds: number;
}) => ({
  Metric: {
    Namespace: namespace,
    MetricName: metricName,
    Dimensions: [
      {
        Name: "LoadBalancer",
        Value: lbDimension,
      },
    ],
  },
  Period: periodSeconds,
  Stat: "Sum",
});

const sumMetricValues = (values: unknown): number => {
  if (!Array.isArray(values)) return 0;
  return values.reduce((acc, value) => {
    if (typeof value === "number" && Number.isFinite(value)) return acc + value;
    if (typeof value === "string") {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? acc + parsed : acc;
    }
    return acc;
  }, 0);
};

export async function fetchAwsIdleRecommendations({
  connection,
}: {
  connection: InstanceType<typeof CloudConnectionV2>;
}): Promise<{
  skipped: boolean;
  reason: string;
  recommendations: AwsIdleResourceRecommendationInput[];
}> {
  const roleArn = String(connection.billingRoleArn ?? "").trim();
  if (!roleArn) {
    return {
      skipped: true,
      reason: "Cloud connection billing role ARN is missing",
      recommendations: [],
    };
  }

  let ec2Sdk: Record<string, unknown>;
  let cloudwatchSdk: Record<string, unknown>;
  let elbV2Sdk: Record<string, unknown>;
  try {
    ec2Sdk = (await import("@aws-sdk/client-ec2")) as Record<string, unknown>;
  } catch {
    return {
      skipped: true,
      reason: "Missing dependency @aws-sdk/client-ec2",
      recommendations: [],
    };
  }
  try {
    cloudwatchSdk = (await import("@aws-sdk/client-cloudwatch")) as Record<string, unknown>;
  } catch {
    return {
      skipped: true,
      reason: "Missing dependency @aws-sdk/client-cloudwatch",
      recommendations: [],
    };
  }
  try {
    elbV2Sdk = (await import("@aws-sdk/client-elastic-load-balancing-v2")) as Record<string, unknown>;
  } catch {
    return {
      skipped: true,
      reason: "Missing dependency @aws-sdk/client-elastic-load-balancing-v2",
      recommendations: [],
    };
  }

  const EC2Client = ec2Sdk.EC2Client as
    | (new (args: {
        region: string;
        credentials: {
          accessKeyId: string;
          secretAccessKey: string;
          sessionToken: string;
        };
      }) => {
        send: (command: unknown) => Promise<Record<string, unknown>>;
      })
    | undefined;
  const DescribeRegionsCommand = ec2Sdk.DescribeRegionsCommand as
    | (new (args: Record<string, unknown>) => unknown)
    | undefined;
  const DescribeVolumesCommand = ec2Sdk.DescribeVolumesCommand as
    | (new (args: Record<string, unknown>) => unknown)
    | undefined;
  const DescribeAddressesCommand = ec2Sdk.DescribeAddressesCommand as
    | (new (args: Record<string, unknown>) => unknown)
    | undefined;
  const DescribeSnapshotsCommand = ec2Sdk.DescribeSnapshotsCommand as
    | (new (args: Record<string, unknown>) => unknown)
    | undefined;

  const CloudWatchClient = cloudwatchSdk.CloudWatchClient as
    | (new (args: {
        region: string;
        credentials: {
          accessKeyId: string;
          secretAccessKey: string;
          sessionToken: string;
        };
      }) => {
        send: (command: unknown) => Promise<Record<string, unknown>>;
      })
    | undefined;
  const GetMetricDataCommand = cloudwatchSdk.GetMetricDataCommand as
    | (new (args: Record<string, unknown>) => unknown)
    | undefined;

  const ElasticLoadBalancingV2Client = elbV2Sdk.ElasticLoadBalancingV2Client as
    | (new (args: {
        region: string;
        credentials: {
          accessKeyId: string;
          secretAccessKey: string;
          sessionToken: string;
        };
      }) => {
        send: (command: unknown) => Promise<Record<string, unknown>>;
      })
    | undefined;
  const DescribeLoadBalancersCommand = elbV2Sdk.DescribeLoadBalancersCommand as
    | (new (args: Record<string, unknown>) => unknown)
    | undefined;

  if (
    !EC2Client ||
    !DescribeRegionsCommand ||
    !DescribeVolumesCommand ||
    !DescribeAddressesCommand ||
    !DescribeSnapshotsCommand ||
    !CloudWatchClient ||
    !GetMetricDataCommand ||
    !ElasticLoadBalancingV2Client ||
    !DescribeLoadBalancersCommand
  ) {
    return {
      skipped: true,
      reason: "Idle recommendation SDK symbols not available",
      recommendations: [],
    };
  }

  const credentials = await assumeRole(roleArn, connection.externalId ?? null);
  const accountId =
    String(connection.cloudAccountId ?? "").trim() || parseAccountIdFromRoleArn(roleArn) || "";
  const defaultRegion = parseRoleRegion(connection);
  const regionDiscoveryClient = new EC2Client({
    region: defaultRegion,
    credentials,
  });

  let enabledRegions: string[] = [];
  try {
    const regionResponse = await regionDiscoveryClient.send(new DescribeRegionsCommand({ AllRegions: true }));
    const rows = Array.isArray(regionResponse.Regions) ? regionResponse.Regions : [];
    enabledRegions = rows
      .map((row) => row as Record<string, unknown>)
      .filter((row) => {
        const optInStatus = String(row.OptInStatus ?? "")
          .trim()
          .toLowerCase();
        return !optInStatus || optInStatus === "opt-in-not-required" || optInStatus === "opted-in";
      })
      .map((row) => String(row.RegionName ?? "").trim())
      .filter((item) => item.length > 0);
  } catch {
    enabledRegions = [defaultRegion];
  }

  if (enabledRegions.length === 0) {
    enabledRegions = [defaultRegion];
  }

  const recommendations: AwsIdleResourceRecommendationInput[] = [];
  const observationStart = getDateDaysAgo(IDLE_LOOKBACK_DAYS);
  const observationEnd = new Date();
  const staleBefore = getDateDaysAgo(SNAPSHOT_AGE_THRESHOLD_DAYS);
  const staleBeforeIsoDate = staleBefore.toISOString().slice(0, 10);

  const fetchVolumesAndEipsAndSnapshots = async (region: string): Promise<void> => {
    const ec2Client = new EC2Client({
      region,
      credentials,
    });

    let volumeToken: string | undefined;
    do {
      const response = await ec2Client.send(
        new DescribeVolumesCommand({
          MaxResults: 500,
          ...(volumeToken ? { NextToken: volumeToken } : {}),
        }),
      );
      const volumes = Array.isArray(response.Volumes) ? response.Volumes : [];
      for (const row of volumes) {
        const volume = row as Record<string, unknown>;
        const volumeId = String(volume.VolumeId ?? "").trim();
        if (!volumeId) continue;
        const state = String(volume.State ?? "").trim().toLowerCase();
        const attachments = Array.isArray(volume.Attachments) ? volume.Attachments : [];
        if (state === "available" && attachments.length === 0) {
          const volumeType = String(volume.VolumeType ?? "").trim() || null;
          const size = typeof volume.Size === "number" ? volume.Size : null;
          const text = size !== null
            ? `Unattached EBS volume (${size} GiB) has no active attachments`
            : "Unattached EBS volume has no active attachments";
          recommendations.push({
            accountId,
            region,
            recommendationType: "DELETE_EBS",
            resourceId: volumeId,
            resourceArn: null,
            resourceName: volumeId,
            resourceType: "EBS",
            currentResourceType: volumeType,
            idleReason: "NOT_ATTACHED",
            idleObservationValue: text,
            estimatedMonthlySavings: 0,
            recommendationTitle: "Delete unused EBS volume",
            recommendationText: `Volume ${volumeId} is available and not attached to an instance`,
            effortLevel: "LOW",
            riskLevel: "LOW",
            observationStart,
            observationEnd,
            rawPayload: volume,
          });
        }
      }
      volumeToken =
        typeof response.NextToken === "string" && response.NextToken.trim()
          ? response.NextToken
          : undefined;
    } while (volumeToken);

    const addressResponse = await ec2Client.send(new DescribeAddressesCommand({}));
    const addresses = Array.isArray(addressResponse.Addresses) ? addressResponse.Addresses : [];
    for (const row of addresses) {
      const address = row as Record<string, unknown>;
      const associationId = String(address.AssociationId ?? "").trim();
      const instanceId = String(address.InstanceId ?? "").trim();
      const networkInterfaceId = String(address.NetworkInterfaceId ?? "").trim();
      if (!associationId && !instanceId && !networkInterfaceId) {
        const allocationId = String(address.AllocationId ?? "").trim();
        const publicIp = String(address.PublicIp ?? "").trim();
        const resourceId = allocationId || publicIp;
        if (!resourceId) continue;
        recommendations.push({
          accountId,
          region,
          recommendationType: "RELEASE_EIP",
          resourceId,
          resourceArn: null,
          resourceName: publicIp || allocationId || null,
          resourceType: "EIP",
          currentResourceType: "VPC",
          idleReason: "NO_ASSOCIATION",
          idleObservationValue: "Elastic IP is not associated with an instance or network interface",
          estimatedMonthlySavings: 0,
          recommendationTitle: "Release unused Elastic IP",
          recommendationText: `Elastic IP ${resourceId} appears unassociated`,
          effortLevel: "LOW",
          riskLevel: "LOW",
          observationStart,
          observationEnd,
          rawPayload: address,
        });
      }
    }

    let snapshotToken: string | undefined;
    do {
      const response = await ec2Client.send(
        new DescribeSnapshotsCommand({
          OwnerIds: ["self"],
          MaxResults: 1000,
          ...(snapshotToken ? { NextToken: snapshotToken } : {}),
        }),
      );
      const snapshots = Array.isArray(response.Snapshots) ? response.Snapshots : [];
      for (const row of snapshots) {
        const snapshot = row as Record<string, unknown>;
        const snapshotId = String(snapshot.SnapshotId ?? "").trim();
        if (!snapshotId) continue;
        const startTimeRaw = snapshot.StartTime;
        const startTime =
          startTimeRaw instanceof Date
            ? startTimeRaw
            : startTimeRaw
              ? new Date(String(startTimeRaw))
              : null;
        if (!startTime || Number.isNaN(startTime.getTime())) continue;
        if (startTime > staleBefore) continue;
        const volumeSize = typeof snapshot.VolumeSize === "number" ? snapshot.VolumeSize : null;
        recommendations.push({
          accountId,
          region,
          recommendationType: "DELETE_SNAPSHOT",
          resourceId: snapshotId,
          resourceArn: null,
          resourceName: snapshotId,
          resourceType: "SNAPSHOT",
          currentResourceType: "EBS_SNAPSHOT",
          idleReason: "AGE_GT_90D",
          idleObservationValue: `Snapshot start time ${startTime.toISOString()} is older than ${staleBeforeIsoDate}`,
          estimatedMonthlySavings: 0,
          recommendationTitle: "Delete or archive old snapshot",
          recommendationText:
            volumeSize !== null
              ? `Snapshot ${snapshotId} (${volumeSize} GiB) is older than ${SNAPSHOT_AGE_THRESHOLD_DAYS} days`
              : `Snapshot ${snapshotId} is older than ${SNAPSHOT_AGE_THRESHOLD_DAYS} days`,
          effortLevel: "LOW",
          riskLevel: "MEDIUM",
          observationStart: startTime,
          observationEnd,
          rawPayload: snapshot,
        });
      }
      snapshotToken =
        typeof response.NextToken === "string" && response.NextToken.trim()
          ? response.NextToken
          : undefined;
    } while (snapshotToken);
  };

  const fetchIdleLoadBalancers = async (region: string): Promise<void> => {
    const lbClient = new ElasticLoadBalancingV2Client({
      region,
      credentials,
    });
    const cloudwatchClient = new CloudWatchClient({
      region,
      credentials,
    });

    let lbToken: string | undefined;
    do {
      const response = await lbClient.send(
        new DescribeLoadBalancersCommand({
          PageSize: 400,
          ...(lbToken ? { Marker: lbToken } : {}),
        }),
      );
      const loadBalancers = Array.isArray(response.LoadBalancers) ? response.LoadBalancers : [];

      for (const row of loadBalancers) {
        const lb = row as Record<string, unknown>;
        const lbArn = String(lb.LoadBalancerArn ?? "").trim();
        if (!lbArn) continue;
        const lbName = String(lb.LoadBalancerName ?? "").trim() || null;
        const lbType = String(lb.Type ?? "").trim().toLowerCase();
        const lbDimension = normalizeLbDimension(lbArn);
        if (!lbDimension) continue;

        const metricNamespace = lbType === "network" ? "AWS/NetworkELB" : "AWS/ApplicationELB";
        const metricName = lbType === "network" ? "ProcessedBytes" : "RequestCount";
        const metricId = `m${Math.abs(lbArn.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0))}`;
        const startTime = getDateDaysAgo(IDLE_LOOKBACK_DAYS);
        const endTime = new Date();

        const metricResponse = await cloudwatchClient.send(
          new GetMetricDataCommand({
            StartTime: startTime,
            EndTime: endTime,
            MetricDataQueries: [
              {
                Id: metricId,
                MetricStat: toMetricStat({
                  namespace: metricNamespace,
                  metricName,
                  lbDimension,
                  periodSeconds: 24 * 60 * 60,
                }),
                ReturnData: true,
              },
            ],
          }),
        );

        const resultRows = Array.isArray(metricResponse.MetricDataResults)
          ? metricResponse.MetricDataResults
          : [];
        const firstResult = resultRows[0] as Record<string, unknown> | undefined;
        const metricSum = sumMetricValues(firstResult?.Values);
        if (metricSum <= 0) {
          recommendations.push({
            accountId,
            region,
            recommendationType: "REVIEW_IDLE_LB",
            resourceId: lbArn,
            resourceArn: lbArn,
            resourceName: lbName,
            resourceType: lbType === "network" ? "NLB" : "ALB",
            currentResourceType: lbType || null,
            idleReason: "NO_TRAFFIC_7D",
            idleObservationValue: `${metricName} total is 0 for the last ${IDLE_LOOKBACK_DAYS} days`,
            estimatedMonthlySavings: 0,
            recommendationTitle: "Review idle load balancer",
            recommendationText:
              lbName
                ? `Load balancer ${lbName} has no observed traffic in the last ${IDLE_LOOKBACK_DAYS} days`
                : `Load balancer has no observed traffic in the last ${IDLE_LOOKBACK_DAYS} days`,
            effortLevel: "MEDIUM",
            riskLevel: "MEDIUM",
            observationStart: startTime,
            observationEnd: endTime,
            rawPayload: {
              loadBalancer: lb,
              metricNamespace,
              metricName,
              metricSum,
            },
          });
        }
      }

      lbToken =
        typeof response.NextMarker === "string" && response.NextMarker.trim()
          ? response.NextMarker
          : undefined;
    } while (lbToken);
  };

  for (const region of enabledRegions) {
    try {
      await fetchVolumesAndEipsAndSnapshots(region);
      await fetchIdleLoadBalancers(region);
    } catch {
      continue;
    }
  }

  return {
    skipped: false,
    reason:
      recommendations.length > 0
        ? "Fetched idle resource candidates from AWS APIs"
        : "No idle candidates returned from AWS APIs",
    recommendations: recommendations.map((item) => ({
      ...item,
      observationStart: toIso(item.observationStart ? new Date(item.observationStart) : observationStart),
      observationEnd: toIso(item.observationEnd ? new Date(item.observationEnd) : observationEnd),
    })),
  };
}
