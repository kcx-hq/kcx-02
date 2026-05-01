export type S3OptimizationBucketRow = {
  bucketName: string;
  accountId: string;
  region: string | null;
  lifecycleStatus: string | null;
  lifecycleRulesCount: number | null;
  hasLifecyclePolicy: boolean;
  scanTime: string;
};

export type S3OptimizationResponse = {
  section: "s3-optimization";
  title: "S3 Optimization";
  message: string;
  buckets: S3OptimizationBucketRow[];
};

export type S3BucketLifecycleRuleSummary = {
  id: string | null;
  status: string;
  hasTransition: boolean;
  hasExpiration: boolean;
};

export type S3BucketLifecycleInsight = {
  bucketName: string;
  accountId: string;
  region: string | null;
  lifecycleStatus: string | null;
  lifecycleRulesCount: number;
  enabledRulesCount: number;
  transitionRulesCount: number;
  expirationRulesCount: number;
  hasLifecyclePolicy: boolean;
  scanTime: string;
  riskLevel: "low" | "medium" | "high";
  headline: string;
  recommendation: string;
  topRules: S3BucketLifecycleRuleSummary[];
};

export type S3BucketLifecycleInsightResponse = {
  section: "s3-lifecycle-insight";
  title: "S3 Bucket Lifecycle Insight";
  message: string;
  insight: S3BucketLifecycleInsight | null;
};

export type S3LifecycleTransitionStorageClass = "STANDARD_IA" | "GLACIER" | "DEEP_ARCHIVE";

export type S3LifecyclePolicyTransitionInput = {
  days: number;
  storageClass: S3LifecycleTransitionStorageClass;
};

export type S3LifecyclePolicyApplyRequest = {
  bucketName: string;
  ruleName: string;
  status: "Enabled" | "Disabled";
  scope: {
    type: "entire_bucket" | "prefix";
    prefix?: string;
  };
  transitions: S3LifecyclePolicyTransitionInput[];
  expirationDays?: number | null;
  abortIncompleteMultipartUploadDays?: number | null;
};

export type S3LifecyclePolicyApplyResponse = {
  section: "s3-lifecycle-policy-apply";
  title: "S3 Lifecycle Policy Apply";
  message: string;
  bucketName: string;
  accountId: string;
  region: string;
  ruleName: string;
  appliedPolicy: {
    Rules: Array<Record<string, unknown>>;
  };
};

export type S3PolicyActionStatus = "SUCCEEDED" | "FAILED";

export type S3PolicyActionHistoryItem = {
  id: string;
  serviceName: "S3";
  policyType: "LIFECYCLE";
  bucketName: string;
  accountId: string | null;
  region: string | null;
  ruleName: string | null;
  scopeType: "entire_bucket" | "prefix" | null;
  scopePrefix: string | null;
  status: S3PolicyActionStatus;
  errorMessage: string | null;
  createdAt: string;
  createdByUserId: string | null;
};

export type S3PolicyActionHistoryResponse = {
  section: "policy-actions";
  title: "Policy Actions";
  message: string;
  items: S3PolicyActionHistoryItem[];
};
