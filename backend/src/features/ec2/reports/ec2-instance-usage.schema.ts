import type { Request } from "express";
import { z } from "zod";

import { parseWithSchema } from "../../_shared/validation/zod-validate.js";
import { resolveDashboardTenantId } from "../../dashboard/shared/dashboard-request-builder.js";
import type { Ec2InstanceUsageQuery } from "./ec2-instance-usage.types.js";

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const firstQueryValue = (value: unknown): string | undefined => {
  if (typeof value === "undefined") return undefined;
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === "string" ? first : undefined;
  }
  return typeof value === "string" ? value : undefined;
};

const parseOptionalInteger = (value: string | undefined): number | null => {
  if (!value || value.trim().length === 0) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
};

const ec2InstanceUsageSchema = z
  .object({
    tenantId: z.string().trim().min(1, "tenantId is required"),
    startDate: z.string().regex(DATE_ONLY_REGEX, "start_date must be YYYY-MM-DD"),
    endDate: z.string().regex(DATE_ONLY_REGEX, "end_date must be YYYY-MM-DD"),
    cloudConnectionId: z.string().trim().uuid("cloud_connection_id must be a valid UUID").nullable(),
    subAccountKey: z.number().int("sub_account_key must be an integer").nullable(),
    regionKey: z.number().int("region_key must be an integer").nullable(),
    category: z.enum(["none", "region", "instance_type"]).default("none"),
  })
  .superRefine((value, ctx) => {
    if (value.startDate > value.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startDate"],
        message: "start_date must be less than or equal to end_date",
      });
    }
  });

export function buildEc2InstanceUsageQuery(req: Request): Ec2InstanceUsageQuery {
  const startDate =
    firstQueryValue(req.query.start_date) ??
    firstQueryValue(req.query.startDate) ??
    firstQueryValue(req.query.from) ??
    firstQueryValue(req.query.billingPeriodStart);
  const endDate =
    firstQueryValue(req.query.end_date) ??
    firstQueryValue(req.query.endDate) ??
    firstQueryValue(req.query.to) ??
    firstQueryValue(req.query.billingPeriodEnd);
  const cloudConnectionId =
    firstQueryValue(req.query.cloud_connection_id) ??
    firstQueryValue(req.query.cloudConnectionId) ??
    null;
  const subAccountKeyRaw =
    firstQueryValue(req.query.sub_account_key) ??
    firstQueryValue(req.query.subAccountKey) ??
    null;
  const regionKeyRaw =
    firstQueryValue(req.query.region_key) ??
    firstQueryValue(req.query.regionKey) ??
    null;
  const categoryRaw = firstQueryValue(req.query.category) ?? "none";
  const subAccountKey = parseOptionalInteger(subAccountKeyRaw ?? undefined);
  const regionKey = parseOptionalInteger(regionKeyRaw ?? undefined);

  return parseWithSchema(ec2InstanceUsageSchema, {
    tenantId: resolveDashboardTenantId(req),
    startDate,
    endDate,
    cloudConnectionId: cloudConnectionId && cloudConnectionId.trim().length > 0 ? cloudConnectionId.trim() : null,
    subAccountKey,
    regionKey,
    category: categoryRaw,
  });
}
