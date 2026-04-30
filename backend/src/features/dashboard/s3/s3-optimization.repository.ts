import { QueryTypes } from "sequelize";

import { sequelize } from "../../../models/index.js";
import type { DashboardScope } from "../dashboard.types.js";
import { NotFoundError } from "../../../errors/http-errors.js";
import type { S3BucketLifecycleInsight, S3BucketLifecycleRuleSummary, S3OptimizationBucketRow } from "./s3-optimization.types.js";

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
