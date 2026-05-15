import type { Request } from "express";
import { z } from "zod";

import { parseWithSchema } from "../../_shared/validation/zod-validate.js";
import { BadRequestError } from "../../../errors/http-errors.js";
import { isExplorerDatabaseScope, legacyDatabaseTypeToScope } from "./explorer.database-scope.js";
import type { ExplorerDatabaseScope, ExplorerQueryParams } from "./explorer.types.js";

const metricSchema = z.enum(["cost", "usage"]).default("cost");
const groupBySchema = z
  .enum(["db_type", "db_service", "db_engine", "region", "resource_type", "instance_class", "cluster", "cost_category"])
  .default("db_type");

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

const normalizeDbServiceAndEngine = (
  dbServiceRaw: string | undefined,
  dbEngineRaw: string | undefined,
): { dbService?: string; dbEngine?: string } => {
  let dbService = dbServiceRaw;
  let dbEngine = dbEngineRaw;

  if (!dbService) {
    return { dbService, dbEngine };
  }

  const normalizedServiceText = dbService.toLowerCase();

  if (!dbEngine) {
    const parts = dbService
      .split(/\s*(?:•|·|\||\/|:| - )\s*/g)
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    if (parts.length >= 2) {
      dbService = parts[0];
      dbEngine = parts.slice(1).join(" ");
    }
  }

  if (!dbEngine && normalizedServiceText.includes("aurora")) {
    if (normalizedServiceText.includes("postgres")) {
      dbEngine = "Aurora PostgreSQL";
    } else if (normalizedServiceText.includes("mysql")) {
      dbEngine = "Aurora MySQL";
    }
  }

  return { dbService, dbEngine };
};

const normalizeGroupByInput = (raw: unknown): string => {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (value === "database_type") {
    return "db_type";
  }
  return value.length > 0 ? value : "db_type";
};

const resolveDatabaseScope = (
  scopeRaw: string | undefined,
  legacyTypeRaw: string | undefined,
): ExplorerDatabaseScope | undefined => {
  if (scopeRaw) {
    if (!isExplorerDatabaseScope(scopeRaw)) {
      throw new BadRequestError("database_scope must be a supported scope value");
    }
    return scopeRaw;
  }
  if (legacyTypeRaw) {
    return legacyDatabaseTypeToScope(legacyTypeRaw);
  }
  return undefined;
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
    groupBy: z.preprocess((value) => normalizeGroupByInput(value), groupBySchema),
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
  const scopeRaw = optionalString(req.query.database_scope);
  const legacyTypeRaw = optionalString(req.query.database_type);
  const databaseScope = resolveDatabaseScope(scopeRaw, legacyTypeRaw);

  const rawDbService = optionalString(req.query.db_service);
  const rawDbEngine = optionalString(req.query.db_engine);
  const normalizedDbFilters = normalizeDbServiceAndEngine(rawDbService, rawDbEngine);

  const parsed = parseWithSchema(explorerQuerySchema, {
    tenantId: resolveTenantId(req),
    startDate: firstValue(req.query.start_date),
    endDate: firstValue(req.query.end_date),
    cloudConnectionId: optionalString(req.query.cloud_connection_id),
    regionKey: optionalString(req.query.region_key),
    dbService: normalizedDbFilters.dbService,
    dbEngine: normalizedDbFilters.dbEngine,
    metric: firstValue(req.query.metric) ?? "cost",
    groupBy: firstValue(req.query.group_by) ?? "db_type",
  });

  return {
    ...parsed,
    databaseScope,
  };
}
