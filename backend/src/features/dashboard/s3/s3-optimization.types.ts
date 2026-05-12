export type S3PolicyAppliedStatus = "APPLIED" | "NOT_APPLIED" | "FAILED" | "EXTERNAL";

export type S3OptimizationBucketRow = {
  bucketName: string;
  accountId: string;
  region: string | null;
  lifecycleStatus: string | null;
  lifecycleRulesCount: number | null;
  hasLifecyclePolicy: boolean;
  scanTime: string;
  policyAppliedStatus: S3PolicyAppliedStatus;
  policyAppliedAt: string | null;
  lifecycleSavings: {
    status: "estimated" | "tracking" | "realized" | "not_available";
    policyAppliedAt: string | null;
    calculationPeriod: string | null;
    beforeCost: number | null;
    afterCost: number | null;
    estimatedMonthlySavingsMin: number | null;
    estimatedMonthlySavingsMax: number | null;
    realizedMonthlySavings: number | null;
    savingsPercent: number | null;
    beforeStorageGb: number | null;
    afterStorageGb: number | null;
    note: string;
  };
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

export type S3LifecycleSuggestedTemplateKey = "safe" | "logs" | "temp" | "version" | "backup";

export type S3LifecycleBucketProfile = {
  bucketPattern: "general" | "logs" | "temp" | "backup" | "versioned";
  hasExplicitPrefixRules: boolean;
  primaryPrefix: string | null;
  noncurrentRuleSignals: boolean;
  transitionRuleCount: number;
  expirationRuleCount: number;
  objectSizeFilteredRuleCount: number;
};

export type S3LifecycleTemplateRecommendation = {
  templateKey: S3LifecycleSuggestedTemplateKey;
  confidence: "low" | "medium" | "high";
  reason: string;
  suggestedPrefix: string | null;
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
  profile: S3LifecycleBucketProfile;
  templateRecommendation: S3LifecycleTemplateRecommendation;
};

export type S3BucketLifecycleInsightResponse = {
  section: "s3-lifecycle-insight";
  title: "S3 Bucket Lifecycle Insight";
  message: string;
  insight: S3BucketLifecycleInsight | null;
};

export type S3LifecycleTransitionStorageClass = "STANDARD_IA" | "GLACIER" | "DEEP_ARCHIVE" | "INTELLIGENT_TIERING";

export type S3LifecyclePolicyTransitionInput = {
  days: number;
  storageClass: S3LifecycleTransitionStorageClass;
};

export type S3LifecyclePolicyApplyRequest = {
  bucketName: string;
  accountId?: string | null;
  region?: string | null;
  ruleName: string;
  status: "Enabled" | "Disabled";
  scope: {
    type: "entire_bucket" | "prefix";
    prefix?: string;
    minObjectSizeBytes?: number | null;
    maxObjectSizeBytes?: number | null;
  };
  transitions: S3LifecyclePolicyTransitionInput[];
  expirationDays?: number | null;
  abortIncompleteMultipartUploadDays?: number | null;
  noncurrentVersionTransitions?: S3LifecyclePolicyTransitionInput[];
  noncurrentVersionExpirationDays?: number | null;
  expiredObjectDeleteMarker?: boolean | null;
  deleteWarningAccepted?: boolean | null;
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

export type S3LifecyclePolicyDeleteRequest = {
  bucketName: string;
  ruleName: string;
  accountId?: string | null;
  region?: string | null;
};

export type S3LifecyclePolicyDeleteResponse = {
  section: "s3-lifecycle-policy-delete";
  title: "S3 Lifecycle Policy Delete";
  message: string;
  bucketName: string;
  accountId: string;
  region: string;
  ruleName: string;
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
  requestPayloadJson: Record<string, unknown> | null;
  responsePayloadJson: Record<string, unknown> | null;
  createdAt: string;
  createdByUserId: string | null;
};

export type S3PolicyActionHistoryResponse = {
  section: "policy-actions";
  title: "Policy Actions";
  message: string;
  items: S3PolicyActionHistoryItem[];
};

export type S3ReplicationStatus = "present" | "absent" | "unknown";

export type S3ReplicationActionType = "setup_replication" | "view" | "edit" | "remove" | "fix_permission" | "view_setup_guide";

export type S3BucketReplicationRow = {
  bucketName: string;
  accountId: string;
  region: string | null;
  replicationStatus: S3ReplicationStatus;
  rulesCount: number;
  destinationBucket: string | null;
  destinationRegion: string | null;
  replicationType: "same_account" | "cross_account" | "unknown";
  status: "enabled" | "disabled" | "mixed" | "unknown";
  lastChecked: string;
  recommendation: string | null;
  actions: S3ReplicationActionType[];
};

export type S3ReplicationVisibilityResponse = {
  section: "s3-replication";
  title: "S3 Replication";
  message: string;
  buckets: S3BucketReplicationRow[];
};

export type S3ReplicationDestinationBucketOption = {
  bucketName: string;
  region: string | null;
};

export type S3ReplicationDestinationBucketsResponse = {
  section: "s3-replication-destination-buckets";
  title: "S3 Replication Destination Buckets";
  message: string;
  sourceBucketName: string;
  buckets: S3ReplicationDestinationBucketOption[];
};

export type S3ReplicationSetupRequest = {
  sourceBucketName: string;
  destinationBucketName: string;
  destinationRegion: string;
  replicationType: "same_account" | "cross_account";
  destinationAccountId?: string | null;
  replicationRoleArn: string;
  ruleName: string;
  prefix?: string | null;
  replicateDeleteMarkers?: boolean;
  autoEnableSourceVersioning?: boolean;
  autoEnableDestinationVersioning?: boolean;
};

export type S3ReplicationSetupCheck = {
  key:
    | "source_versioning"
    | "destination_bucket_access"
    | "destination_region_match"
    | "destination_versioning"
    | "replication_role";
  title: string;
  status: "pass" | "warn" | "fail";
  detail: string;
};

export type S3ReplicationSetupPreviewResponse = {
  section: "s3-replication-setup-preview";
  title: "S3 Replication Setup Preview";
  message: string;
  canApply: boolean;
  checks: S3ReplicationSetupCheck[];
};

export type S3ReplicationSetupApplyResponse = {
  section: "s3-replication-setup-apply";
  title: "S3 Replication Setup Apply";
  message: string;
  sourceBucketName: string;
  destinationBucketName: string;
  destinationRegion: string;
  replicationStatus: "configured";
};

export type S3ReplicationRoleAutoCreateRequest = {
  sourceBucketName: string;
  destinationBucketName: string;
  roleName?: string | null;
};

export type S3ReplicationRoleAutoCreateResponse = {
  section: "s3-replication-role-auto-create";
  title: "S3 Replication Role Auto Create";
  message: string;
  roleName: string;
  roleArn: string;
};
