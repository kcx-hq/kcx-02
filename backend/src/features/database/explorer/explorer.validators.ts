import type { Request } from "express";
import { z } from "zod";

import { parseWithSchema } from "../../_shared/validation/zod-validate.js";
import { BadRequestError } from "../../../errors/http-errors.js";
import type { ExplorerQueryParams } from "./explorer.types.js";

const metricSchema = z.enum(["cost", "usage"]).default("cost");
const groupBySchema = z.enum(["db_service", "db_engine", "region"]).default("db_service");

const requiredDateString = (fieldName: string) =>
  z.preprocess(
    (value) => (typeof value === "string" ? value : ""),
    z.string().trim().min(1, `${fieldName} is required`),
  );

const firstValue = (value: unknown): unknown => (Array.isArray(value) ? value[0] : value);

const optionalString = (value: unknown): string | undefined => {
  const raw = firstValue(value);
  if (typeof raw !== "string") {
    return undefined;
  }

  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const explorerQuerySchema = z
  .object({
    tenantId: z.string().trim().min(1),
    startDate: requiredDateString("start_date"),
    endDate: requiredDateString("end_date"),
    cloudConnectionId: z.string().trim().min(1).optional(),
    regionKey: z.string().trim().min(1).optional(),
    dbService: z.string().trim().min(1).optional(),
    dbEngine: z.string().trim().min(1).optional(),
    metric: metricSchema,
    groupBy: groupBySchema,
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

export function parseExplorerQuery(req: Request): ExplorerQueryParams {
  return parseWithSchema(explorerQuerySchema, {
    tenantId: resolveTenantId(req),
    startDate: firstValue(req.query.start_date),
    endDate: firstValue(req.query.end_date),
    cloudConnectionId: optionalString(req.query.cloud_connection_id),
    regionKey: optionalString(req.query.region_key),
    dbService: optionalString(req.query.db_service),
    dbEngine: optionalString(req.query.db_engine),
    metric: firstValue(req.query.metric) ?? "cost",
    groupBy: firstValue(req.query.group_by) ?? "db_service",
  });
}
