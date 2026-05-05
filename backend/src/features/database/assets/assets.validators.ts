import type { Request } from "express";
import { z } from "zod";

import { BadRequestError } from "../../../errors/http-errors.js";
import { parseWithSchema } from "../../_shared/validation/zod-validate.js";
import type { DatabaseAssetsQueryParams } from "./assets.types.js";

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

const querySchema = z
  .object({
    tenantId: z.string().trim().min(1),
    startDate: requiredDateString("start_date"),
    endDate: requiredDateString("end_date"),
    cloudConnectionId: z.string().uuid().optional(),
    regionKey: z.string().trim().min(1).optional(),
    dbService: z.string().trim().min(1).optional(),
    dbEngine: z.string().trim().min(1).optional(),
    instanceClass: z.string().trim().min(1).optional(),
    status: z.string().trim().min(1).optional(),
    subAccountKey: z.string().trim().min(1).optional(),
    search: z.string().trim().min(1).max(200).optional(),
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

export function parseAssetsQuery(req: Request): DatabaseAssetsQueryParams {
  return parseWithSchema(querySchema, {
    tenantId: resolveTenantId(req),
    startDate: firstValue(req.query.start_date),
    endDate: firstValue(req.query.end_date),
    cloudConnectionId: optionalString(req.query.cloud_connection_id),
    regionKey: optionalString(req.query.region_key),
    dbService: optionalString(req.query.db_service),
    dbEngine: optionalString(req.query.db_engine),
    instanceClass: optionalString(req.query.instance_class),
    status: optionalString(req.query.status),
    subAccountKey: optionalString(req.query.sub_account_key),
    search: optionalString(req.query.search),
    page: firstValue(req.query.page) ?? 1,
    pageSize: firstValue(req.query.pageSize) ?? firstValue(req.query.page_size) ?? 20,
  });
}
