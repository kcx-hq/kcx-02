export type OptimizationSyncTrigger =
  | "MANUAL_API"
  | "INGESTION_COMPLETED"
  | "SCHEDULED_JOB"
  | "DASHBOARD_OPEN"
  | "RECOMMENDATIONS_OPEN";

export type AwsComputeOptimizerEc2RecommendationInput = {
  accountId: string;
  region: string;
  resourceId: string;
  resourceArn?: string | null;
  resourceName?: string | null;
  currentInstanceType?: string | null;
  recommendedInstanceType?: string | null;
  performanceRiskScore?: number | string | null;
  performanceRiskLevel?: string | null;
  estimatedMonthlySavings?: number | string | null;
  recommendationTitle?: string | null;
  recommendationText?: string | null;
  effortLevel?: string | null;
  riskLevel?: string | null;
  observationStart?: string | Date | null;
  observationEnd?: string | Date | null;
  rawPayload?: unknown;
};

export type IdleRecommendationType =
  | "DELETE_EBS"
  | "RELEASE_EIP"
  | "DELETE_SNAPSHOT"
  | "REVIEW_IDLE_LB";

export type IdleResourceType = "EBS" | "EIP" | "SNAPSHOT" | "ALB" | "NLB";

export type AwsIdleResourceRecommendationInput = {
  accountId: string;
  region: string;
  recommendationType: IdleRecommendationType;
  resourceId: string;
  resourceArn?: string | null;
  resourceName?: string | null;
  resourceType?: IdleResourceType | null;
  currentResourceType?: string | null;
  idleReason?: string | null;
  idleObservationValue?: string | null;
  estimatedMonthlySavings?: number | string | null;
  recommendationTitle?: string | null;
  recommendationText?: string | null;
  effortLevel?: string | null;
  riskLevel?: string | null;
  observationStart?: string | Date | null;
  observationEnd?: string | Date | null;
  rawPayload?: unknown;
};

export type NormalizedRightsizingRecommendation = {
  tenantId: string;
  awsAccountId: string;
  awsRegionCode: string;
  category: "RIGHTSIZING";
  recommendationType: "EC2_RESIZE";
  resourceId: string;
  resourceArn: string | null;
  resourceName: string | null;
  currentResourceType: string | null;
  recommendedResourceType: string | null;
  estimatedMonthlySavings: number;
  performanceRiskScore: number | null;
  performanceRiskLevel: "LOW" | "MEDIUM" | "HIGH" | null;
  effortLevel: "LOW" | "MEDIUM" | "HIGH" | null;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | null;
  recommendationTitle: string | null;
  recommendationText: string | null;
  observationStart: Date | null;
  observationEnd: Date | null;
  rawPayloadJson: string | null;
  sourceSystem: "AWS_COMPUTE_OPTIMIZER";
  status: "OPEN";
};

export type NormalizedIdleRecommendation = {
  tenantId: string;
  awsAccountId: string;
  awsRegionCode: string;
  category: "IDLE";
  recommendationType: IdleRecommendationType;
  resourceId: string;
  resourceArn: string | null;
  resourceName: string | null;
  resourceType: IdleResourceType | null;
  currentResourceType: string | null;
  recommendedResourceType: null;
  estimatedMonthlySavings: number;
  performanceRiskScore: null;
  performanceRiskLevel: "LOW" | "MEDIUM" | "HIGH" | null;
  effortLevel: "LOW" | "MEDIUM" | "HIGH" | null;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | null;
  recommendationTitle: string | null;
  recommendationText: string | null;
  idleReason: string | null;
  idleObservationValue: string | null;
  observationStart: Date | null;
  observationEnd: Date | null;
  rawPayloadJson: string | null;
  sourceSystem: "AWS_IDLE_DETECTION";
  status: "OPEN";
};

export type EnrichedRightsizingRecommendation = NormalizedRightsizingRecommendation & {
  cloudConnectionId: string;
  billingSourceId: string | number | null;
  serviceKey: number | null;
  subAccountKey: number | null;
  regionKey: number | null;
  currentMonthlyCost: number;
  projectedMonthlyCost: number;
};

export type EnrichedIdleRecommendation = NormalizedIdleRecommendation & {
  cloudConnectionId: string;
  billingSourceId: string | number | null;
  serviceKey: number | null;
  subAccountKey: number | null;
  regionKey: number | null;
  currentMonthlyCost: number;
  projectedMonthlyCost: number;
};

export type OptimizationSyncResult = {
  trigger: OptimizationSyncTrigger;
  tenantId: string;
  fetchedCount: number;
  normalizedCount: number;
  enrichedCount: number;
  insertedCount: number;
  skipped: boolean;
  reason: string | null;
};
