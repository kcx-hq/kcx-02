import type { Request } from "express";
import { z } from "zod";

import { parseWithSchema } from "../../_shared/validation/zod-validate.js";
import { resolveDashboardTenantId } from "../../dashboard/shared/dashboard-request-builder.js";
import {
  EC2_OPTIMIZATION_RECOMMENDATION_FILTER_TYPES,
  type Ec2OptimizationRecommendationsQuery,
} from "./ec2-optimization.types.js";

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const firstQueryValue = (value: unknown): string | undefined => {
  if (typeof value === "undefined") return undefined;
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === "string" ? first : undefined;
  }
  return typeof value === "string" ? value : undefined;
};

const toNullableString = (value: string | undefined): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const parseOptionalInteger = (value: string | undefined): number | null => {
  if (!value || value.trim().length === 0) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
};

const querySchema = z
  .object({
    tenantId: z.string().trim().min(1, "tenantId is required"),
    dateFrom: z.string().regex(DATE_ONLY_REGEX, "dateFrom must be YYYY-MM-DD"),
    dateTo: z.string().regex(DATE_ONLY_REGEX, "dateTo must be YYYY-MM-DD"),
    cloudConnectionId: z.string().trim().uuid("cloudConnectionId must be a valid UUID").nullable(),
    billingSourceId: z.number().int("billingSourceId must be an integer").nullable(),
    regionKey: z.number().int("regionKey must be an integer").nullable(),
    subAccountKey: z.number().int("subAccountKey must be an integer").nullable(),
    recommendationType: z.enum(EC2_OPTIMIZATION_RECOMMENDATION_FILTER_TYPES).nullable(),
    region: z.string().trim().min(1).max(120).nullable(),
    riskLevel: z.enum(["low", "medium", "high"]).nullable(),
    status: z.string().trim().min(1).max(50).nullable(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(200).default(25),
  })
  .superRefine((value, ctx) => {
    if (value.dateFrom > value.dateTo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dateFrom"],
        message: "dateFrom must be less than or equal to dateTo",
      });
    }
  });

const getDateFrom = (req: Request): string | undefined =>
  firstQueryValue(req.query.dateFrom) ??
  firstQueryValue(req.query.date_from) ??
  firstQueryValue(req.query.startDate) ??
  firstQueryValue(req.query.start_date) ??
  firstQueryValue(req.query.from) ??
  firstQueryValue(req.query.billingPeriodStart);

const getDateTo = (req: Request): string | undefined =>
  firstQueryValue(req.query.dateTo) ??
  firstQueryValue(req.query.date_to) ??
  firstQueryValue(req.query.endDate) ??
  firstQueryValue(req.query.end_date) ??
  firstQueryValue(req.query.to) ??
  firstQueryValue(req.query.billingPeriodEnd);

export function buildEc2OptimizationRecommendationsQuery(req: Request): Ec2OptimizationRecommendationsQuery {
  const recommendationType = toNullableString(
    firstQueryValue(req.query.recommendationType) ??
      firstQueryValue(req.query.recommendation_type) ??
      firstQueryValue(req.query.optimizationType) ??
      firstQueryValue(req.query.optimization_type),
  );
  return parseWithSchema(querySchema, {
    tenantId: resolveDashboardTenantId(req),
    dateFrom: getDateFrom(req),
    dateTo: getDateTo(req),
    cloudConnectionId: toNullableString(
      firstQueryValue(req.query.cloudConnectionId) ?? firstQueryValue(req.query.cloud_connection_id),
    ),
    billingSourceId: parseOptionalInteger(
      firstQueryValue(req.query.billingSourceId) ?? firstQueryValue(req.query.billing_source_id),
    ),
    regionKey: parseOptionalInteger(
      firstQueryValue(req.query.regionKey) ?? firstQueryValue(req.query.region_key),
    ),
    subAccountKey: parseOptionalInteger(
      firstQueryValue(req.query.subAccountKey) ??
        firstQueryValue(req.query.sub_account_key) ??
        firstQueryValue(req.query.accountKey) ??
        firstQueryValue(req.query.account_key),
    ),
    recommendationType,
    region: toNullableString(firstQueryValue(req.query.region)),
    riskLevel: toNullableString(
      firstQueryValue(req.query.riskLevel) ?? firstQueryValue(req.query.risk_level),
    ),
    status: toNullableString(firstQueryValue(req.query.status)),
    page: firstQueryValue(req.query.page) ?? "1",
    pageSize: firstQueryValue(req.query.pageSize) ?? firstQueryValue(req.query.page_size) ?? "25",
  });
}
