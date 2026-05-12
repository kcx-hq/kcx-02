import type { Request } from "express";
import { z } from "zod";

import { parseWithSchema } from "../../_shared/validation/zod-validate.js";
import { resolveDashboardTenantId } from "../../dashboard/shared/dashboard-request-builder.js";
import type {
  Ec2RecommendationCategory,
  Ec2RecommendationStatus,
  Ec2RecommendationType,
  Ec2RecommendationsQuery,
  Ec2RefreshRecommendationsInput,
} from "./ec2-recommendations.types.js";

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const first = (value: unknown): string | undefined =>
  Array.isArray(value) ? (typeof value[0] === "string" ? value[0] : undefined) : typeof value === "string" ? value : undefined;

const nullable = (value: string | undefined): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const intOrNull = (value: string | undefined): number | null => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
};

const querySchema = z.object({
  tenantId: z.string().uuid(),
  dateFrom: z.string().regex(DATE_ONLY_REGEX),
  dateTo: z.string().regex(DATE_ONLY_REGEX),
  cloudConnectionId: z.string().uuid().nullable(),
  billingSourceId: z.number().int().nullable(),
  category: z.enum(["compute", "storage", "pricing", "network"]).nullable(),
  type: z.enum([
    "idle_instance",
    "underutilized_instance",
    "overutilized_instance",
    "unattached_volume",
    "old_snapshot",
    "orphaned_snapshot",
    "uncovered_on_demand",
    "high_internet_data_transfer",
    "high_inter_region_data_transfer",
    "high_inter_az_data_transfer",
    "low_cpu_high_network",
    "high_nat_gateway_cost",
    "unattached_elastic_ip",
    "idle_load_balancer",
    "low_traffic_load_balancer",
    "unhealthy_targets",
    "high_error_rate",
    "high_data_processing_cost",
  ]).nullable(),
  status: z.enum(["open", "in_progress", "snoozed", "dismissed", "completed"]).nullable(),
  account: z.string().nullable(),
  region: z.string().nullable(),
  team: z.string().nullable(),
  product: z.string().nullable(),
  environment: z.string().nullable(),
  service: z.enum(["ec2", "load_balancer"]).nullable(),
  resourceType: z.enum(["instance", "volume", "snapshot", "elastic_ip", "load_balancer"]).nullable(),
  tags: z.array(z.string()).default([]),
});

const refreshSchema = z.object({
  tenantId: z.string().uuid(),
  dateFrom: z.string().regex(DATE_ONLY_REGEX),
  dateTo: z.string().regex(DATE_ONLY_REGEX),
  cloudConnectionId: z.string().uuid().nullable(),
  billingSourceId: z.number().int().nullable(),
});

const statusSchema = z.object({
  status: z.enum(["open", "in_progress", "snoozed", "dismissed", "completed"]),
  reason: z.string().trim().max(1000).nullable().optional(),
  snoozed_until: z.string().regex(DATE_ONLY_REGEX).nullable().optional(),
});

const parseTags = (value: string | undefined): string[] =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export function buildEc2RecommendationsQuery(req: Request): Ec2RecommendationsQuery {
  const today = new Date().toISOString().slice(0, 10);
  return parseWithSchema(querySchema, {
    tenantId: resolveDashboardTenantId(req),
    dateFrom: first(req.query.dateFrom) ?? first(req.query.from) ?? first(req.query.billingPeriodStart) ?? today,
    dateTo: first(req.query.dateTo) ?? first(req.query.to) ?? first(req.query.billingPeriodEnd) ?? today,
    cloudConnectionId: nullable(first(req.query.cloudConnectionId) ?? first(req.query.cloud_connection_id)),
    billingSourceId: intOrNull(first(req.query.billingSourceId) ?? first(req.query.billing_source_id)),
    category: nullable(first(req.query.category)) as Ec2RecommendationCategory | null,
    type: nullable(first(req.query.type) ?? first(req.query.recommendationType) ?? first(req.query.recommendation_type)) as Ec2RecommendationType | null,
    status: nullable(first(req.query.status)) as Ec2RecommendationStatus | null,
    account: nullable(first(req.query.account) ?? first(req.query.subAccountKey) ?? first(req.query.sub_account_key)),
    region: nullable(first(req.query.region)),
    team: nullable(first(req.query.team)),
    product: nullable(first(req.query.product)),
    environment: nullable(first(req.query.environment) ?? first(req.query.env)),
    service: nullable(first(req.query.service)) as "ec2" | "load_balancer" | null,
    resourceType: nullable(first(req.query.resourceType) ?? first(req.query.resource_type)) as
      | "instance"
      | "volume"
      | "snapshot"
      | "elastic_ip"
      | "load_balancer"
      | null,
    tags: parseTags(first(req.query.tags)),
  });
}

export function buildEc2RefreshInput(req: Request): Ec2RefreshRecommendationsInput {
  const today = new Date().toISOString().slice(0, 10);
  return parseWithSchema(refreshSchema, {
    tenantId: resolveDashboardTenantId(req),
    dateFrom: first(req.body?.dateFrom) ?? first(req.query.dateFrom) ?? first(req.query.from) ?? first(req.query.billingPeriodStart) ?? today,
    dateTo: first(req.body?.dateTo) ?? first(req.query.dateTo) ?? first(req.query.to) ?? first(req.query.billingPeriodEnd) ?? today,
    cloudConnectionId: nullable(first(req.body?.cloudConnectionId) ?? first(req.query.cloudConnectionId)),
    billingSourceId: intOrNull(first(req.body?.billingSourceId) ?? first(req.query.billingSourceId)),
  });
}

export function buildEc2RecommendationStatusPatch(req: Request): {
  id: number;
  status: Ec2RecommendationStatus;
  reason: string | null;
  snoozedUntil: string | null;
} {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid recommendation id");
  const parsed = parseWithSchema(statusSchema, req.body ?? {});
  const reason = typeof parsed.reason === "string" && parsed.reason.trim().length > 0 ? parsed.reason.trim() : null;
  const snoozedUntil = typeof parsed.snoozed_until === "string" && parsed.snoozed_until.trim().length > 0
    ? parsed.snoozed_until.trim()
    : null;
  if (parsed.status === "snoozed" && !snoozedUntil) {
    throw new Error("snoozed_until is required when status is snoozed");
  }
  if (parsed.status !== "snoozed" && snoozedUntil) {
    throw new Error("snoozed_until is only allowed when status is snoozed");
  }
  return { id, status: parsed.status, reason, snoozedUntil };
}
