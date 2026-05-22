import type { Request } from "express";
import { z } from "zod";

import { BadRequestError } from "../../../errors/http-errors.js";
import { parseWithSchema } from "../../_shared/validation/zod-validate.js";
import type { DbOptimizationActionsQuery } from "./db-optimization.types.js";

const firstValue = (value: unknown): unknown => (Array.isArray(value) ? value[0] : value);

const optionalString = (value: unknown): string | undefined => {
  const raw = firstValue(value);
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const requiredDateString = (fieldName: string) =>
  z.preprocess(
    (value) => (typeof value === "string" ? value : ""),
    z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, `${fieldName} must be in YYYY-MM-DD format`),
  );

const boolStringSchema = z
  .union([z.literal("true"), z.literal("false"), z.literal("1"), z.literal("0"), z.boolean()])
  .optional();

const querySchema = z
  .object({
    tenantId: z.string().trim().min(1),
    startDate: requiredDateString("start_date"),
    endDate: requiredDateString("end_date"),
    search: z.string().trim().min(1).max(200).optional(),
    regionKey: z.string().trim().min(1).optional(),
    dbService: z.string().trim().min(1).optional(),
    dbEngine: z.string().trim().min(1).optional(),
    resourceType: z.string().trim().min(1).optional(),
    status: z.string().trim().min(1).optional(),
    hasActions: boolStringSchema,
    recommendationType: z.string().trim().min(1).optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
  })
  .refine((value) => Date.parse(value.startDate) <= Date.parse(value.endDate), {
    message: "start_date must be less than or equal to end_date",
    path: ["startDate"],
  });

const resolveTenantId = (req: Request): string => {
  const tenantId = req.auth?.user.tenantId?.trim();
  if (!tenantId) {
    throw new BadRequestError("tenantId is required");
  }
  return tenantId;
};

const toBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return undefined;
};

export function parseDbOptimizationActionsQuery(req: Request): DbOptimizationActionsQuery {
  const parsed = parseWithSchema(querySchema, {
    tenantId: resolveTenantId(req),
    startDate: firstValue(req.query.start_date) ?? firstValue(req.query.startDate) ?? firstValue(req.query.from),
    endDate: firstValue(req.query.end_date) ?? firstValue(req.query.endDate) ?? firstValue(req.query.to),
    search: optionalString(req.query.search),
    regionKey: optionalString(req.query.region_key) ?? optionalString(req.query.regionKey),
    dbService: optionalString(req.query.db_service) ?? optionalString(req.query.dbService),
    dbEngine: optionalString(req.query.db_engine) ?? optionalString(req.query.dbEngine),
    resourceType: optionalString(req.query.resource_type) ?? optionalString(req.query.resourceType),
    status: optionalString(req.query.status),
    hasActions: firstValue(req.query.has_actions) ?? firstValue(req.query.hasActions),
    recommendationType:
      optionalString(req.query.recommendation_type) ?? optionalString(req.query.recommendationType),
    page: firstValue(req.query.page) ?? 1,
    pageSize: firstValue(req.query.page_size) ?? firstValue(req.query.pageSize) ?? 20,
  });

  return {
    tenantId: parsed.tenantId,
    startDate: parsed.startDate,
    endDate: parsed.endDate,
    search: parsed.search,
    regionKey: parsed.regionKey,
    dbService: parsed.dbService,
    dbEngine: parsed.dbEngine,
    resourceType: parsed.resourceType,
    status: parsed.status,
    hasActions: toBoolean(parsed.hasActions),
    recommendationType: parsed.recommendationType,
    page: parsed.page,
    pageSize: parsed.pageSize,
  };
}

