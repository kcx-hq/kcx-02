import { QueryTypes } from "sequelize";

import { sequelize } from "../../../models/index.js";
import type { DashboardScope } from "../dashboard.types.js";
import { NotFoundError } from "../../../errors/http-errors.js";
import type {
  S3BucketLifecycleInsight,
  S3LifecycleBucketProfile,
  S3LifecycleTemplateRecommendation,
  S3BucketLifecycleRuleSummary,
  S3PolicyAppliedStatus,
  S3OptimizationBucketRow,
  S3PolicyActionHistoryItem,
  S3PolicyActionStatus,
  S3BucketReplicationRow,
} from "./s3-optimization.types.js";
import { logger } from "../../../utils/logger.js";

type S3OptimizationDbRow = {
  bucket_name: string | null;
  account_id: string | null;
  region: string | null;
  lifecycle_status: string | null;
  lifecycle_rules_count: number | string | null;
  scan_time: string | null;
};

type S3LatestAppliedPolicyRow = {
  created_at: string | null;
};

type S3LatestPolicyActionRow = {
  status: string | null;
  created_at: string | null;
};

type S3WindowCostRow = {
  total_cost: number | string | null;
};

type S3WindowStorageRow = {
  avg_storage_gb: number | string | null;
};

type S3BucketLifecycleInsightDbRow = {
  bucket_name: string | null;
  account_id: string | null;
  region: string | null;
  lifecycle_status: string | null;
  lifecycle_rules_count: number | string | null;
  lifecycle_rules_json: unknown;
  scan_time: string | null;
};

type S3BucketLifecycleExecutionContextDbRow = {
  bucket_name: string | null;
  account_id: string | null;
  region: string | null;
  cloud_connection_id: string | null;
};

type S3ReplicationDbRow = {
  bucket_name: string | null;
  account_id: string | null;
  region: string | null;
  replication_status: string | null;
  replication_rules_count: number | string | null;
  replication_config_json: unknown;
  scan_time: string | null;
};

type S3PolicyActionHistoryDbRow = {
  id: string | null;
  service_name: string | null;
  policy_type: string | null;
  bucket_name: string | null;
  account_id: string | null;
  region: string | null;
  rule_name: string | null;
  scope_type: string | null;
  scope_prefix: string | null;
  status: string | null;
  error_message: string | null;
  request_payload_json: unknown;
  response_payload_json: unknown;
  created_at: string | null;
  created_by_user_id: string | null;
};

export type S3BucketLifecycleExecutionContext = {
  bucketName: string;
  accountId: string;
  region: string | null;
  cloudConnectionId: string;
};

const toNumber = (value: number | string | null | undefined): number | null => {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const hasLifecyclePolicy = (status: string | null, rulesCount: number | null): boolean => {
  const normalizedStatus = String(status ?? "").trim().toLowerCase();
  if (rulesCount != null && rulesCount > 0) return true;
  return normalizedStatus === "present" || normalizedStatus === "enabled" || normalizedStatus === "configured";
};

const toReplicationStatus = (statusRaw: string | null): "present" | "absent" | "unknown" => {
  const status = String(statusRaw ?? "").trim().toLowerCase();
  if (status === "present" || status === "enabled" || status === "configured") return "present";
  if (status === "absent") return "absent";
  return "unknown";
};

export class S3OptimizationRepository {
  async getReplicationVisibilityRows(scope: DashboardScope): Promise<S3BucketReplicationRow[]> {
    const binds: unknown[] = [scope.tenantId];
    const where: string[] = ["tenant_id = $1::uuid"];

    if (scope.scopeType === "global") {
      if (typeof scope.providerId === "number") {
        binds.push(scope.providerId);
        where.push(`provider_id = $${binds.length}`);
      }
      if (Array.isArray(scope.billingSourceIds) && scope.billingSourceIds.length > 0) {
        binds.push(scope.billingSourceIds);
        where.push(`(billing_source_id IS NULL OR billing_source_id = ANY($${binds.length}::bigint[]))`);
      }
    }

    const rows = await sequelize.query<S3ReplicationDbRow>(
      `
      SELECT
        latest.bucket_name,
        latest.account_id,
        latest.region,
        latest.replication_status,
        latest.replication_rules_count,
        latest.replication_config_json,
        latest.scan_time::text AS scan_time
      FROM (
        SELECT DISTINCT ON (bucket_name, account_id)
          bucket_name,
          account_id,
          region,
          replication_status,
          replication_rules_count,
          replication_config_json,
          scan_time
        FROM s3_bucket_config_snapshot
        WHERE ${where.join("\n          AND ")}
        ORDER BY bucket_name ASC, account_id ASC, scan_time DESC
      ) AS latest
      ORDER BY latest.bucket_name ASC, latest.account_id ASC;
      `,
      { bind: binds, type: QueryTypes.SELECT },
    );

    const bucketCostMap = await this.getBucketStorageCostsForDaysSafe(
      scope.tenantId,
      rows.map((row) => ({
        bucketName: String(row.bucket_name ?? "").trim(),
        accountId: String(row.account_id ?? "").trim(),
      })),
      30,
    );

    const mapped = await Promise.all(
      rows.map(async (row) => {
        const replicationStatus = toReplicationStatus(row.replication_status);
        const rulesCount = Math.max(0, toNumber(row.replication_rules_count) ?? 0);
        const replicationConfig =
          row.replication_config_json && typeof row.replication_config_json === "object"
            ? (row.replication_config_json as Record<string, unknown>)
            : null;
        const rules = Array.isArray(replicationConfig?.Rules)
          ? (replicationConfig?.Rules as Array<Record<string, unknown>>)
          : [];
        const firstRule = rules[0] ?? null;
        const destination = firstRule?.Destination && typeof firstRule.Destination === "object"
          ? (firstRule.Destination as Record<string, unknown>)
          : null;
        const destinationBucketArn = typeof destination?.Bucket === "string" ? String(destination.Bucket) : "";
        const destinationBucket = destinationBucketArn.startsWith("arn:aws:s3:::")
          ? destinationBucketArn.slice("arn:aws:s3:::".length)
          : destinationBucketArn || null;
        const destinationRegion = typeof destination?.Region === "string" ? String(destination.Region) : null;
        const destinationAccount = typeof destination?.Account === "string" ? String(destination.Account).trim() : null;
        const statusValues = rules.map((rule) => String(rule?.Status ?? "").trim().toLowerCase()).filter(Boolean);
        const status = statusValues.length === 0
          ? "unknown"
          : statusValues.every((item) => item === "enabled")
            ? "enabled"
            : statusValues.every((item) => item === "disabled")
              ? "disabled"
              : "mixed";

        const replicationType = destinationAccount
          ? destinationAccount === String(row.account_id ?? "").trim()
            ? "same_account"
            : "cross_account"
          : "unknown";

        const monthlyStorageCost =
          bucketCostMap.get(`${String(row.bucket_name ?? "").trim().toLowerCase()}::${String(row.account_id ?? "").trim()}`) ?? null;
        const isImportantBucket = monthlyStorageCost != null && monthlyStorageCost >= 100;
        const recommendation = replicationStatus === "absent" && isImportantBucket
          ? "This bucket has no replication configured. Consider replication for critical data, disaster recovery, or cross-region backup."
          : null;

        const actions = replicationStatus === "present"
          ? (["view", "edit", "remove"] as const)
          : replicationStatus === "absent"
            ? (["setup_replication", "view_setup_guide"] as const)
            : (["fix_permission"] as const);

        return {
          bucketName: String(row.bucket_name ?? "").trim(),
          accountId: String(row.account_id ?? "").trim(),
          region: row.region ? String(row.region).trim() : null,
          replicationStatus,
          rulesCount,
          destinationBucket,
          destinationRegion,
          replicationType,
          status,
          lastChecked: String(row.scan_time ?? ""),
          recommendation,
          actions: [...actions],
        } satisfies S3BucketReplicationRow;
      }),
    );

    return mapped;
  }

  async getLatestBucketLifecycleRows(scope: DashboardScope): Promise<S3OptimizationBucketRow[]> {
    const binds: unknown[] = [scope.tenantId];
    const where: string[] = ["tenant_id = $1::uuid"];

    if (scope.scopeType === "global") {
      if (typeof scope.providerId === "number") {
        binds.push(scope.providerId);
        where.push(`provider_id = $${binds.length}`);
      }
      if (Array.isArray(scope.billingSourceIds) && scope.billingSourceIds.length > 0) {
        binds.push(scope.billingSourceIds);
        where.push(`(billing_source_id IS NULL OR billing_source_id = ANY($${binds.length}::bigint[]))`);
      }
    }

    const rows = await sequelize.query<S3OptimizationDbRow>(
      `
      SELECT
        latest.bucket_name,
        latest.account_id,
        latest.region,
        latest.lifecycle_status,
        latest.lifecycle_rules_count,
        latest.scan_time::text AS scan_time
      FROM (
        SELECT DISTINCT ON (bucket_name, account_id)
          bucket_name,
          account_id,
          region,
          lifecycle_status,
          lifecycle_rules_count,
          scan_time
        FROM s3_bucket_config_snapshot
        WHERE ${where.join("\n          AND ")}
        ORDER BY bucket_name ASC, account_id ASC, scan_time DESC
      ) AS latest
      ORDER BY latest.bucket_name ASC, latest.account_id ASC;
      `,
      { bind: binds, type: QueryTypes.SELECT },
    );

    const mappedRows: S3OptimizationBucketRow[] = rows.map((row) => {
      const lifecycleRulesCount = toNumber(row.lifecycle_rules_count);
      const lifecycleStatus = row.lifecycle_status ? String(row.lifecycle_status) : null;
      return {
        bucketName: String(row.bucket_name ?? "").trim(),
        accountId: String(row.account_id ?? "").trim(),
        region: row.region ? String(row.region) : null,
        lifecycleStatus,
        lifecycleRulesCount,
        hasLifecyclePolicy: hasLifecyclePolicy(lifecycleStatus, lifecycleRulesCount),
        scanTime: String(row.scan_time ?? ""),
        policyAppliedStatus: "NOT_APPLIED",
        policyAppliedAt: null,
        lifecycleSavings: {
          status: "not_available",
          policyAppliedAt: null,
          calculationPeriod: null,
          beforeCost: null,
          afterCost: null,
          estimatedMonthlySavingsMin: null,
          estimatedMonthlySavingsMax: null,
          realizedMonthlySavings: null,
          savingsPercent: null,
          beforeStorageGb: null,
          afterStorageGb: null,
          note: "Savings model unavailable.",
        },
      };
    });

    const withActionStatus: S3OptimizationBucketRow[] = await Promise.all(
      mappedRows.map(async (item) => {
        try {
          const action = await this.getLatestPolicyAction(scope.tenantId, item.bucketName, item.accountId);
          const policyAppliedStatus = this.resolvePolicyAppliedStatus(item.hasLifecyclePolicy, action?.status ?? null);
          return {
            ...item,
            policyAppliedStatus,
            policyAppliedAt: action?.created_at ? String(action.created_at) : null,
            lifecycleSavings: await this.getLifecycleSavings(scope, item),
          };
        } catch (error) {
          logger.warn("S3 lifecycle savings: failed to compute, returning fallback", {
            tenantId: scope.tenantId,
            bucketName: item.bucketName,
            accountId: item.accountId,
            error: error instanceof Error ? error.message : String(error),
          });
          const policyAppliedStatus: S3PolicyAppliedStatus = item.hasLifecyclePolicy ? "EXTERNAL" : "NOT_APPLIED";
          return {
            ...item,
            policyAppliedStatus: item.hasLifecyclePolicy ? "EXTERNAL" : "NOT_APPLIED",
            policyAppliedAt: null,
            lifecycleSavings: {
              status: "not_available" as const,
              policyAppliedAt: null,
              calculationPeriod: null,
              beforeCost: null,
              afterCost: null,
              estimatedMonthlySavingsMin: null,
              estimatedMonthlySavingsMax: null,
              realizedMonthlySavings: null,
              savingsPercent: null,
              beforeStorageGb: null,
              afterStorageGb: null,
              note: "Savings data is temporarily unavailable for this bucket.",
            },
          };
        }
      }),
    );

    return withActionStatus;
  }

  async getBucketLifecycleInsight(scope: DashboardScope, bucketName: string): Promise<S3BucketLifecycleInsight> {
    const normalizedBucketName = bucketName.trim();
    if (normalizedBucketName.length === 0) {
      throw new NotFoundError("Bucket name is required");
    }

    const binds: unknown[] = [scope.tenantId, normalizedBucketName];
    const where: string[] = ["tenant_id = $1::uuid", "LOWER(bucket_name) = LOWER($2::text)"];

    if (scope.scopeType === "global") {
      if (typeof scope.providerId === "number") {
        binds.push(scope.providerId);
        where.push(`provider_id = $${binds.length}`);
      }
      if (Array.isArray(scope.billingSourceIds) && scope.billingSourceIds.length > 0) {
        binds.push(scope.billingSourceIds);
        where.push(`billing_source_id = ANY($${binds.length}::bigint[])`);
      }
    }

    const row = await sequelize.query<S3BucketLifecycleInsightDbRow>(
      `
      SELECT
        bucket_name,
        account_id,
        region,
        lifecycle_status,
        lifecycle_rules_count,
        lifecycle_rules_json,
        scan_time::text AS scan_time
      FROM s3_bucket_config_snapshot
      WHERE ${where.join("\n        AND ")}
      ORDER BY scan_time DESC
      LIMIT 1;
      `,
      { bind: binds, type: QueryTypes.SELECT, plain: true },
    );

    if (!row?.bucket_name) {
      throw new NotFoundError(`No lifecycle snapshot found for bucket ${normalizedBucketName}`);
    }

    const lifecycleStatus = row.lifecycle_status ? String(row.lifecycle_status) : null;
    const lifecycleRulesCount = Math.max(0, toNumber(row.lifecycle_rules_count) ?? 0);
    const rules = this.extractRules(row.lifecycle_rules_json);
    const enabledRules = rules.filter((rule) => String(rule.status).toLowerCase() === "enabled");
    const transitionRules = enabledRules.filter((rule) => rule.hasTransition);
    const expirationRules = enabledRules.filter((rule) => rule.hasExpiration);
    const hasPolicy = hasLifecyclePolicy(lifecycleStatus, lifecycleRulesCount) || rules.length > 0;

    const riskLevel: "low" | "medium" | "high" = !hasPolicy
      ? "high"
      : enabledRules.length === 0
        ? "medium"
        : transitionRules.length === 0 || expirationRules.length === 0
          ? "medium"
          : "low";

    const headline = !hasPolicy
      ? "No lifecycle policy found for this bucket."
      : enabledRules.length === 0
        ? "Lifecycle policy exists but no enabled rules are active."
        : transitionRules.length === 0
          ? "Lifecycle rules are enabled but missing transition actions."
          : expirationRules.length === 0
            ? "Lifecycle rules are enabled but missing expiration actions."
            : "Lifecycle policy is configured with active transition and expiration coverage.";

    const recommendation = !hasPolicy
      ? "Create lifecycle rules for transition and expiration to control storage growth and stale object retention."
      : enabledRules.length === 0
        ? "Enable existing lifecycle rules and validate rule filters for active object prefixes."
        : transitionRules.length === 0
          ? "Add transition actions (for example IA/Glacier tiers) to reduce long-term storage cost."
          : expirationRules.length === 0
            ? "Add expiration actions for stale or aged objects to avoid indefinite retention cost."
          : "Review transition and expiration thresholds to align with workload retention and compliance targets.";

    const profile = this.buildBucketProfile({
      bucketName: String(row.bucket_name).trim(),
      lifecycleRulesPayload: row.lifecycle_rules_json,
      transitionRulesCount: transitionRules.length,
      expirationRulesCount: expirationRules.length,
    });
    const templateRecommendation = this.recommendTemplate(profile);

    return {
      bucketName: String(row.bucket_name).trim(),
      accountId: String(row.account_id ?? "").trim(),
      region: row.region ? String(row.region) : null,
      lifecycleStatus,
      lifecycleRulesCount,
      enabledRulesCount: enabledRules.length,
      transitionRulesCount: transitionRules.length,
      expirationRulesCount: expirationRules.length,
      hasLifecyclePolicy: hasPolicy,
      scanTime: String(row.scan_time ?? ""),
      riskLevel,
      headline,
      recommendation,
      topRules: rules.slice(0, 3),
      profile,
      templateRecommendation,
    };
  }

  async getBucketLifecycleExecutionContext(
    scope: DashboardScope,
    bucketName: string,
  ): Promise<S3BucketLifecycleExecutionContext> {
    const normalizedBucketName = bucketName.trim();
    if (normalizedBucketName.length === 0) {
      throw new NotFoundError("Bucket name is required");
    }

    const binds: unknown[] = [scope.tenantId, normalizedBucketName];
    const where: string[] = ["tenant_id = $1::uuid", "LOWER(bucket_name) = LOWER($2::text)"];

    if (scope.scopeType === "global") {
      if (typeof scope.providerId === "number") {
        binds.push(scope.providerId);
        where.push(`provider_id = $${binds.length}`);
      }
      if (Array.isArray(scope.billingSourceIds) && scope.billingSourceIds.length > 0) {
        binds.push(scope.billingSourceIds);
        where.push(`billing_source_id = ANY($${binds.length}::bigint[])`);
      }
    }

    const row = await sequelize.query<S3BucketLifecycleExecutionContextDbRow>(
      `
      SELECT
        bucket_name,
        account_id,
        region,
        cloud_connection_id
      FROM s3_bucket_config_snapshot
      WHERE ${where.join("\n        AND ")}
      ORDER BY scan_time DESC
      LIMIT 1;
      `,
      { bind: binds, type: QueryTypes.SELECT, plain: true },
    );

    if (!row?.bucket_name || !row.cloud_connection_id) {
      throw new NotFoundError(`No actionable lifecycle context found for bucket ${normalizedBucketName}`);
    }

    return {
      bucketName: String(row.bucket_name).trim(),
      accountId: String(row.account_id ?? "").trim(),
      region: row.region ? String(row.region).trim() : null,
      cloudConnectionId: String(row.cloud_connection_id).trim(),
    };
  }

  async createPolicyActionLog(input: {
    tenantId: string;
    cloudConnectionId: string | null;
    billingSourceId: number | null;
    providerId: number | null;
    accountId: string | null;
    region: string | null;
    bucketName: string;
    ruleName: string | null;
    scopeType: "entire_bucket" | "prefix" | null;
    scopePrefix: string | null;
    status: S3PolicyActionStatus;
    errorMessage: string | null;
    requestPayloadJson: Record<string, unknown> | null;
    responsePayloadJson: Record<string, unknown> | null;
    createdByUserId: string | null;
  }): Promise<void> {
    await sequelize.query(
      `
      INSERT INTO s3_policy_action_logs (
        tenant_id,
        cloud_connection_id,
        billing_source_id,
        provider_id,
        service_name,
        policy_type,
        account_id,
        region,
        bucket_name,
        rule_name,
        scope_type,
        scope_prefix,
        status,
        error_message,
        request_payload_json,
        response_payload_json,
        created_by_user_id
      )
      VALUES (
        :tenantId::uuid,
        :cloudConnectionId::uuid,
        :billingSourceId::bigint,
        :providerId::bigint,
        'S3',
        'LIFECYCLE',
        :accountId,
        :region,
        :bucketName,
        :ruleName,
        :scopeType,
        :scopePrefix,
        :status,
        :errorMessage,
        CAST(:requestPayloadJson AS jsonb),
        CAST(:responsePayloadJson AS jsonb),
        CASE
          WHEN :createdByUserId IS NULL THEN NULL
          WHEN :createdByUserId ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            THEN :createdByUserId::uuid
          ELSE NULL
        END
      );
      `,
      {
        replacements: {
          ...input,
          requestPayloadJson: input.requestPayloadJson ? JSON.stringify(input.requestPayloadJson) : null,
          responsePayloadJson: input.responsePayloadJson ? JSON.stringify(input.responsePayloadJson) : null,
        },
        type: QueryTypes.INSERT,
      },
    );
  }

  async getPolicyActionHistory(scope: DashboardScope): Promise<S3PolicyActionHistoryItem[]> {
    const binds: unknown[] = [scope.tenantId];
    const where: string[] = ["tenant_id = $1::uuid"];

    const rows = await sequelize.query<S3PolicyActionHistoryDbRow>(
      `
      SELECT
        id::text AS id,
        service_name,
        policy_type,
        bucket_name,
        account_id,
        region,
        rule_name,
        scope_type,
        scope_prefix,
        status,
        error_message,
        request_payload_json,
        response_payload_json,
        created_at::text AS created_at,
        created_by_user_id::text AS created_by_user_id
      FROM s3_policy_action_logs
      WHERE ${where.join("\n        AND ")}
      ORDER BY created_at DESC
      LIMIT 200;
      `,
      { bind: binds, type: QueryTypes.SELECT },
    );

    return rows.map((row) => ({
      id: String(row.id ?? ""),
      serviceName: "S3",
      policyType: "LIFECYCLE",
      bucketName: String(row.bucket_name ?? ""),
      accountId: row.account_id ? String(row.account_id) : null,
      region: row.region ? String(row.region) : null,
      ruleName: row.rule_name ? String(row.rule_name) : null,
      scopeType: row.scope_type === "prefix" ? "prefix" : row.scope_type === "entire_bucket" ? "entire_bucket" : null,
      scopePrefix: row.scope_prefix ? String(row.scope_prefix) : null,
      status: row.status === "FAILED" ? "FAILED" : "SUCCEEDED",
      errorMessage: row.error_message ? String(row.error_message) : null,
      requestPayloadJson:
        row.request_payload_json && typeof row.request_payload_json === "object"
          ? (row.request_payload_json as Record<string, unknown>)
          : null,
      responsePayloadJson:
        row.response_payload_json && typeof row.response_payload_json === "object"
          ? (row.response_payload_json as Record<string, unknown>)
          : null,
      createdAt: String(row.created_at ?? ""),
      createdByUserId: row.created_by_user_id ? String(row.created_by_user_id) : null,
    }));
  }

  private extractRules(payload: unknown): S3BucketLifecycleRuleSummary[] {
    if (!payload || typeof payload !== "object") {
      return [];
    }

    const root = payload as { Rules?: unknown };
    const rules = Array.isArray(root.Rules) ? root.Rules : [];

    return rules
      .map((rule) => {
        if (!rule || typeof rule !== "object") return null;
        const typedRule = rule as Record<string, unknown>;
        const transitions = Array.isArray(typedRule.Transitions) ? typedRule.Transitions : [];
        const expiration = typedRule.Expiration;
        const noncurrentTransitions = Array.isArray(typedRule.NoncurrentVersionTransitions)
          ? typedRule.NoncurrentVersionTransitions
          : [];
        const noncurrentExpiration = typedRule.NoncurrentVersionExpiration;

        return {
          id: typeof typedRule.ID === "string" ? typedRule.ID : null,
          status: typeof typedRule.Status === "string" ? typedRule.Status : "Unknown",
          hasTransition: transitions.length > 0 || noncurrentTransitions.length > 0,
          hasExpiration: Boolean(expiration) || Boolean(noncurrentExpiration),
        } satisfies S3BucketLifecycleRuleSummary;
      })
      .filter((rule): rule is S3BucketLifecycleRuleSummary => Boolean(rule));
  }

  private async getLifecycleSavings(
    scope: DashboardScope,
    row: Pick<S3OptimizationBucketRow, "bucketName" | "accountId" | "hasLifecyclePolicy">,
  ): Promise<S3OptimizationBucketRow["lifecycleSavings"]> {
    const policyAppliedAt = await this.getLatestPolicyAppliedAt(scope.tenantId, row.bucketName, row.accountId);
    const currentStorageCost = await this.getBucketStorageCostForDays(scope.tenantId, row.bucketName, row.accountId, 30);
    const optimizationFactor = row.hasLifecyclePolicy ? 0.12 : 0.28;
    const estimatedCenter = Math.max(0, currentStorageCost * optimizationFactor);
    const estimatedMonthlySavingsMin = Number((estimatedCenter * 0.8).toFixed(2));
    const estimatedMonthlySavingsMax = Number((estimatedCenter * 1.2).toFixed(2));

    if (!policyAppliedAt) {
      return {
        status: "estimated",
        policyAppliedAt: null,
        calculationPeriod: null,
        beforeCost: null,
        afterCost: null,
        estimatedMonthlySavingsMin,
        estimatedMonthlySavingsMax,
        realizedMonthlySavings: null,
        savingsPercent: null,
        beforeStorageGb: null,
        afterStorageGb: null,
        note: "Estimated only. Apply lifecycle policy to start realized savings tracking.",
      };
    }

    const appliedAtDate = new Date(policyAppliedAt);
    const beforeStart = new Date(appliedAtDate);
    beforeStart.setUTCDate(beforeStart.getUTCDate() - 30);
    const afterEnd = new Date(appliedAtDate);
    afterEnd.setUTCDate(afterEnd.getUTCDate() + 30);
    const now = new Date();

    const beforeCost = await this.getBucketStorageCostBetween(scope.tenantId, row.bucketName, row.accountId, beforeStart, appliedAtDate);
    const afterCost = await this.getBucketStorageCostBetween(scope.tenantId, row.bucketName, row.accountId, appliedAtDate, afterEnd);
    const beforeStorageGb = await this.getBucketStorageGbBetween(scope.tenantId, row.bucketName, row.accountId, beforeStart, appliedAtDate);
    const afterStorageGb = await this.getBucketStorageGbBetween(scope.tenantId, row.bucketName, row.accountId, appliedAtDate, afterEnd);

    const calculationPeriod = `${beforeStart.toISOString().slice(0, 10)} to ${afterEnd.toISOString().slice(0, 10)}`;
    const realizedMonthlySavings = Number((beforeCost - afterCost).toFixed(2));
    const savingsPercent = beforeCost > 0 ? Number((((beforeCost - afterCost) / beforeCost) * 100).toFixed(2)) : null;

    if (afterEnd > now) {
      return {
        status: "tracking",
        policyAppliedAt: appliedAtDate.toISOString(),
        calculationPeriod,
        beforeCost,
        afterCost: null,
        estimatedMonthlySavingsMin,
        estimatedMonthlySavingsMax,
        realizedMonthlySavings: null,
        savingsPercent: null,
        beforeStorageGb,
        afterStorageGb: null,
        note: "Actual savings calculation will be available after 30 days from policy apply date.",
      };
    }

    return {
      status: "realized",
      policyAppliedAt: appliedAtDate.toISOString(),
      calculationPeriod,
      beforeCost,
      afterCost,
      estimatedMonthlySavingsMin,
      estimatedMonthlySavingsMax,
      realizedMonthlySavings,
      savingsPercent,
      beforeStorageGb,
      afterStorageGb,
      note: "Realized savings calculated from CUR before/after 30-day storage cost windows.",
    };
  }

  private async getLatestPolicyAppliedAt(tenantId: string, bucketName: string, accountId: string): Promise<string | null> {
    const row = await sequelize.query<S3LatestAppliedPolicyRow>(
      `
      SELECT created_at::text AS created_at
      FROM s3_policy_action_logs
      WHERE tenant_id = $1::uuid
        AND LOWER(bucket_name) = LOWER($2::text)
        AND status = 'SUCCEEDED'
      ORDER BY
        CASE WHEN COALESCE(account_id, '') = COALESCE($3::text, '') THEN 0 ELSE 1 END,
        created_at DESC
      LIMIT 1;
      `,
      { bind: [tenantId, bucketName, accountId], type: QueryTypes.SELECT, plain: true },
    );
    return row?.created_at ? String(row.created_at) : null;
  }

  private async getLatestPolicyAction(tenantId: string, bucketName: string, accountId: string): Promise<S3LatestPolicyActionRow | null> {
    const row = await sequelize.query<S3LatestPolicyActionRow>(
      `
      SELECT status, created_at::text AS created_at
      FROM s3_policy_action_logs
      WHERE tenant_id = $1::uuid
        AND LOWER(bucket_name) = LOWER($2::text)
      ORDER BY
        CASE WHEN COALESCE(account_id, '') = COALESCE($3::text, '') THEN 0 ELSE 1 END,
        created_at DESC
      LIMIT 1;
      `,
      { bind: [tenantId, bucketName, accountId], type: QueryTypes.SELECT, plain: true },
    );
    return row ?? null;
  }

  private resolvePolicyAppliedStatus(
    hasLifecyclePolicyFlag: boolean,
    latestActionStatusRaw: string | null,
  ): S3PolicyAppliedStatus {
    const latestActionStatus = String(latestActionStatusRaw ?? "").trim().toUpperCase();
    if (latestActionStatus === "SUCCEEDED") return "APPLIED";
    if (latestActionStatus === "FAILED") return "FAILED";
    if (hasLifecyclePolicyFlag) return "APPLIED";
    return "NOT_APPLIED";
  }

  private async getBucketStorageCostForDays(tenantId: string, bucketName: string, accountId: string, days: number): Promise<number> {
    const end = new Date();
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - days);
    return this.getBucketStorageCostBetween(tenantId, bucketName, accountId, start, end);
  }

  private async getBucketStorageCostForDaysSafe(
    tenantId: string,
    bucketName: string,
    accountId: string,
    days: number,
  ): Promise<number | null> {
    try {
      return await this.getBucketStorageCostForDays(tenantId, bucketName, accountId, days);
    } catch (error) {
      const errorCode =
        error && typeof error === "object" && "original" in error && (error as { original?: { code?: string } }).original
          ? String((error as { original?: { code?: string } }).original?.code ?? "")
          : "";
      if (errorCode === "42P01") {
        logger.warn("S3 replication scoring skipped: cost line item table not available", {
          tenantId,
          bucketName,
          accountId,
        });
        return null;
      }
      throw error;
    }
  }

  private async getBucketStorageCostsForDaysSafe(
    tenantId: string,
    pairs: Array<{ bucketName: string; accountId: string }>,
    days: number,
  ): Promise<Map<string, number | null>> {
    const result = new Map<string, number | null>();
    const normalized = pairs
      .map((item) => ({
        bucketName: String(item.bucketName ?? "").trim(),
        accountId: String(item.accountId ?? "").trim(),
      }))
      .filter((item) => item.bucketName.length > 0);
    if (normalized.length === 0) return result;

    const end = new Date();
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - days);
    const keys = normalized.map((item) => item.bucketName.toLowerCase());
    const accounts = [...new Set(normalized.map((item) => item.accountId))];
    try {
      const rows = await sequelize.query<{ bucket_name: string; account_id: string; total_cost: number | string | null }>(
        `
        SELECT
          LOWER(bucket_name)::text AS bucket_name,
          COALESCE(NULLIF(account_id, ''), '')::text AS account_id,
          COALESCE(SUM(total_cost), 0)::double precision AS total_cost
        FROM s3_cost_daily
        WHERE tenant_id = $1::uuid
          AND usage_date >= $2::date
          AND usage_date <= $3::date
          AND LOWER(bucket_name) = ANY($4::text[])
          AND COALESCE(NULLIF(account_id, ''), '') = ANY($5::text[])
          AND cost_category = 'Storage'
        GROUP BY LOWER(bucket_name), COALESCE(NULLIF(account_id, ''), '')
        `,
        {
          bind: [tenantId, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10), keys, accounts],
          type: QueryTypes.SELECT,
        },
      );

      for (const row of rows) {
        result.set(`${String(row.bucket_name ?? "").toLowerCase()}::${String(row.account_id ?? "")}`, toNumber(row.total_cost) ?? 0);
      }
      for (const pair of normalized) {
        const key = `${pair.bucketName.toLowerCase()}::${pair.accountId}`;
        if (!result.has(key)) result.set(key, 0);
      }
      return result;
    } catch (error) {
      const errorCode =
        error && typeof error === "object" && "original" in error && (error as { original?: { code?: string } }).original
          ? String((error as { original?: { code?: string } }).original?.code ?? "")
          : "";
      if (errorCode === "42P01") {
        for (const pair of normalized) {
          result.set(`${pair.bucketName.toLowerCase()}::${pair.accountId}`, null);
        }
        return result;
      }
      throw error;
    }
  }

  private async getBucketStorageCostBetween(
    tenantId: string,
    bucketName: string,
    accountId: string,
    start: Date,
    end: Date,
  ): Promise<number> {
    const row = await sequelize.query<S3WindowCostRow>(
      `
      SELECT COALESCE(SUM(COALESCE(fcli.billed_cost, 0)), 0)::double precision AS total_cost
      FROM fact_cloud_line_items fcli
      LEFT JOIN dim_services ds ON ds.id = fcli.service_id
      LEFT JOIN dim_resources dres ON dres.id = fcli.resource_id
      LEFT JOIN dim_sub_accounts dsa ON dsa.id = fcli.sub_account_id
      WHERE fcli.tenant_id = $1::uuid
        AND fcli.usage_start_time >= $2::timestamptz
        AND fcli.usage_start_time < $3::timestamptz
        AND (
          LOWER(COALESCE(ds.service_name, '')) LIKE '%s3%'
          OR LOWER(COALESCE(ds.service_name, '')) LIKE '%simple storage service%'
        )
        AND LOWER(
          CASE
            WHEN COALESCE(dres.resource_id, '') = '' THEN 'unattributed'
            WHEN LOWER(dres.resource_id) LIKE 'arn:aws:s3:::%' THEN NULLIF(SPLIT_PART(dres.resource_id, ':::', 2), '')
            WHEN LOWER(dres.resource_id) LIKE 's3://%' THEN NULLIF(SPLIT_PART(SUBSTRING(dres.resource_id FROM 6), '/', 1), '')
            ELSE dres.resource_id
          END
        ) = LOWER($4::text)
        AND COALESCE(dsa.sub_account_id, '') = COALESCE($5::text, '')
        AND (
          LOWER(COALESCE(fcli.usage_type, '')) LIKE '%timedstorage%'
          OR LOWER(COALESCE(fcli.usage_type, '')) LIKE '%storage%'
          OR LOWER(COALESCE(fcli.usage_type, '')) LIKE '%bytehrs%'
          OR LOWER(COALESCE(fcli.product_usage_type, '')) LIKE '%timedstorage%'
          OR LOWER(COALESCE(fcli.product_usage_type, '')) LIKE '%storage%'
        );
      `,
      {
        bind: [tenantId, start.toISOString(), end.toISOString(), bucketName, accountId],
        type: QueryTypes.SELECT,
        plain: true,
      },
    );
    return Math.max(0, toNumber(row?.total_cost) ?? 0);
  }

  private async getBucketStorageGbBetween(
    tenantId: string,
    bucketName: string,
    accountId: string,
    start: Date,
    end: Date,
  ): Promise<number | null> {
    const row = await sequelize.query<S3WindowStorageRow>(
      `
      SELECT
        AVG(COALESCE(current_version_bytes, 0) / 1073741824.0)::double precision AS avg_storage_gb
      FROM s3_storage_lens_daily
      WHERE tenant_id = $1::uuid
        AND LOWER(bucket_name) = LOWER($2::text)
        AND usage_date >= $4::date
        AND usage_date < $5::date;
      `,
      {
        bind: [tenantId, bucketName, accountId, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)],
        type: QueryTypes.SELECT,
        plain: true,
      },
    );
    const value = toNumber(row?.avg_storage_gb);
    return value == null ? null : Number(Math.max(0, value).toFixed(2));
  }

  private buildBucketProfile(input: {
    bucketName: string;
    lifecycleRulesPayload: unknown;
    transitionRulesCount: number;
    expirationRulesCount: number;
  }): S3LifecycleBucketProfile {
    const bucketNameLc = input.bucketName.toLowerCase();
    const root = input.lifecycleRulesPayload && typeof input.lifecycleRulesPayload === "object"
      ? (input.lifecycleRulesPayload as { Rules?: unknown })
      : null;
    const rules = Array.isArray(root?.Rules) ? root?.Rules : [];

    const prefixes: string[] = [];
    let noncurrentRuleSignals = false;
    let objectSizeFilteredRuleCount = 0;

    for (const rawRule of rules) {
      if (!rawRule || typeof rawRule !== "object") continue;
      const rule = rawRule as Record<string, unknown>;
      const filter = rule.Filter && typeof rule.Filter === "object" ? (rule.Filter as Record<string, unknown>) : null;
      const filterPrefix = typeof filter?.Prefix === "string" ? filter.Prefix.trim() : "";
      const topLevelPrefix = typeof rule.Prefix === "string" ? String(rule.Prefix).trim() : "";
      const prefix = filterPrefix || topLevelPrefix;
      if (prefix) prefixes.push(prefix);

      const hasNoncurrentTransitions = Array.isArray(rule.NoncurrentVersionTransitions) && rule.NoncurrentVersionTransitions.length > 0;
      const hasNoncurrentExpiration = Boolean(rule.NoncurrentVersionExpiration);
      const hasExpiredDeleteMarker =
        Boolean(rule.Expiration && typeof rule.Expiration === "object" && "ExpiredObjectDeleteMarker" in (rule.Expiration as Record<string, unknown>));

      if (hasNoncurrentTransitions || hasNoncurrentExpiration || hasExpiredDeleteMarker) {
        noncurrentRuleSignals = true;
      }

      const hasObjectSizeFilter = Boolean(
        filter &&
          (typeof filter.ObjectSizeGreaterThan === "number" ||
            typeof filter.ObjectSizeLessThan === "number"),
      );
      if (hasObjectSizeFilter) objectSizeFilteredRuleCount += 1;
    }

    const normalizedPrefixes = prefixes.map((value) => value.toLowerCase()).filter(Boolean);
    const primaryPrefix = normalizedPrefixes[0] ?? null;
    const joinedSignals = [bucketNameLc, ...normalizedPrefixes].join(" ");

    const hasLogsPattern = /\blogs?\b|\/logs?\b/.test(joinedSignals);
    const hasTempPattern = /\btmp\b|\btemp\b|\/tmp\b|\/temp\b|\/cache\b/.test(joinedSignals);
    const hasBackupPattern = /\bbackup\b|\barchive\b|\/backup\b|\/archive\b|snapshot/.test(joinedSignals);

    const bucketPattern: S3LifecycleBucketProfile["bucketPattern"] = noncurrentRuleSignals
      ? "versioned"
      : hasLogsPattern
        ? "logs"
        : hasTempPattern
          ? "temp"
          : hasBackupPattern
            ? "backup"
            : "general";

    return {
      bucketPattern,
      hasExplicitPrefixRules: normalizedPrefixes.length > 0,
      primaryPrefix,
      noncurrentRuleSignals,
      transitionRuleCount: input.transitionRulesCount,
      expirationRuleCount: input.expirationRulesCount,
      objectSizeFilteredRuleCount,
    };
  }

  private recommendTemplate(profile: S3LifecycleBucketProfile): S3LifecycleTemplateRecommendation {
    if (profile.noncurrentRuleSignals || profile.bucketPattern === "versioned") {
      return {
        templateKey: "version",
        confidence: "high",
        reason: "Bucket rules include versioned-object cleanup signals (noncurrent transitions/expiration or delete markers).",
        suggestedPrefix: null,
      };
    }
    if (profile.bucketPattern === "logs") {
      return {
        templateKey: "logs",
        confidence: "high",
        reason: "Bucket/prefix naming suggests log retention workflow.",
        suggestedPrefix: profile.primaryPrefix ?? "logs/",
      };
    }
    if (profile.bucketPattern === "temp") {
      return {
        templateKey: "temp",
        confidence: "high",
        reason: "Bucket/prefix naming suggests temporary object cleanup pattern.",
        suggestedPrefix: profile.primaryPrefix ?? "tmp/",
      };
    }
    if (profile.bucketPattern === "backup") {
      return {
        templateKey: "backup",
        confidence: "high",
        reason: "Bucket/prefix naming suggests backup/archive retention pattern.",
        suggestedPrefix: profile.primaryPrefix ?? "backups/",
      };
    }
    if (profile.hasExplicitPrefixRules) {
      return {
        templateKey: "logs",
        confidence: "medium",
        reason: "Existing lifecycle rules already use prefix-scoped filters.",
        suggestedPrefix: profile.primaryPrefix,
      };
    }
    return {
      templateKey: "safe",
      confidence: "medium",
      reason: "No strong prefix/version signals found. Safe cost optimization is the default baseline.",
      suggestedPrefix: null,
    };
  }
}
