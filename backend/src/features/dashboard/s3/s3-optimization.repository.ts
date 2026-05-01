import { QueryTypes } from "sequelize";

import { sequelize } from "../../../models/index.js";
import type { DashboardScope } from "../dashboard.types.js";
import { NotFoundError } from "../../../errors/http-errors.js";
import type {
  S3BucketLifecycleInsight,
  S3BucketLifecycleRuleSummary,
  S3OptimizationBucketRow,
  S3PolicyActionHistoryItem,
  S3PolicyActionStatus,
} from "./s3-optimization.types.js";

type S3OptimizationDbRow = {
  bucket_name: string | null;
  account_id: string | null;
  region: string | null;
  lifecycle_status: string | null;
  lifecycle_rules_count: number | string | null;
  scan_time: string | null;
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

export class S3OptimizationRepository {
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
        where.push(`billing_source_id = ANY($${binds.length}::bigint[])`);
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

    return rows.map((row) => {
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
      };
    });
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
        :createdByUserId::uuid
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
}
