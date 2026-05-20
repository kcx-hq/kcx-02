import type { Request } from "express";
import { z } from "zod";

import { parseWithSchema } from "../../_shared/validation/zod-validate.js";
import { BadRequestError } from "../../../errors/http-errors.js";
import { isExplorerDatabaseScope, legacyDatabaseTypeToScope } from "./explorer.database-scope.js";
import {
  EXPLORER_ALLOWED_GROUP_BY_BY_METRIC,
  EXPLORER_COST_BASIS,
  type ExplorerDatabaseScope,
  type ExplorerQueryParams,
} from "./explorer.types.js";
import {
  USAGE_CAPABILITY_REGISTRY,
  isUsageCapabilityFamily,
  isUsageMetric,
  metricBelongsToFamily,
  type UsageCapabilityFamily,
  type UsageMetric,
} from "./usage-capabilities.js";

const metricSchema = z.enum(["cost", "usage"]).default("cost");
const costBasisSchema = z.enum(EXPLORER_COST_BASIS).default("billed_cost");
const groupBySchema = z
  .enum(["db_service", "db_engine", "region", "resource_type", "instance_class", "cluster", "cost_category"])
  .default("db_service");

const COST_GROUP_BY = new Set(EXPLORER_ALLOWED_GROUP_BY_BY_METRIC.cost);
const USAGE_GROUP_BY = new Set(EXPLORER_ALLOWED_GROUP_BY_BY_METRIC.usage);

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

  const normalizedServiceMap: Record<string, string> = {
    amazonrds: "Amazon RDS",
    "amazon rds": "Amazon RDS",
    amazonrelationaldatabaseservice: "Amazon RDS",
    aurora: "Amazon Aurora",
    "amazon aurora": "Amazon Aurora",
    amazonelasticache: "Amazon ElastiCache",
    "amazon elasticache": "Amazon ElastiCache",
    elasticache: "Amazon ElastiCache",
    amazonmemorydb: "Amazon MemoryDB",
    "amazon memorydb": "Amazon MemoryDB",
    memorydb: "Amazon MemoryDB",
  };
  const compactServiceText = normalizedServiceText.replace(/[^a-z0-9]/g, "");
  dbService = normalizedServiceMap[normalizedServiceText] ?? normalizedServiceMap[compactServiceText] ?? dbService;

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
  return value.length > 0 ? value : "db_service";
};

const parseGroupValues = (value: unknown): string[] | undefined => {
  if (typeof value === "undefined" || value === null) return undefined;
  const items = Array.isArray(value)
    ? value.flatMap((entry) => String(entry).split(","))
    : String(value).split(",");

  const normalized = [...new Set(items.map((item) => item.trim()).filter((item) => item.length > 0))];
  return normalized.length > 0 ? normalized : undefined;
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
    costBasis: costBasisSchema,
    metric: metricSchema,
    capabilityFamily: z.string().trim().optional(),
    usageMetric: z.string().trim().optional(),
    groupBy: z.preprocess((value) => normalizeGroupByInput(value), groupBySchema),
    groupValues: z.array(z.string().trim().min(1)).optional(),
    resourceTypeValues: z.array(z.string().trim().min(1)).optional(),
    costCategoryValues: z.array(z.string().trim().min(1)).optional(),
  })
  .refine((value) => Date.parse(value.startDate) <= Date.parse(value.endDate), {
    message: "start_date must be less than or equal to end_date",
    path: ["startDate"],
  })
  .superRefine((value, ctx) => {
    const allowed = value.metric === "cost" ? COST_GROUP_BY : USAGE_GROUP_BY;
    if (!allowed.has(value.groupBy)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["groupBy"],
        message: `group_by "${value.groupBy}" is invalid for metric "${value.metric}"`,
      });
    }
    if (value.metric === "usage") {
      const family = value.capabilityFamily;
      const metric = value.usageMetric;
      if (family && !isUsageCapabilityFamily(family)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["capabilityFamily"],
          message: `capability_family \"${family}\" is invalid`,
        });
      }
      if (metric && !isUsageMetric(metric)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["usageMetric"],
          message: `usage_metric \"${metric}\" is invalid`,
        });
      }
      if (family && metric && isUsageCapabilityFamily(family) && isUsageMetric(metric) && !metricBelongsToFamily(family, metric)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["usageMetric"],
          message: `usage_metric \"${metric}\" is invalid for capability_family \"${family}\"`,
        });
      }
    }
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

  const metricInput = firstValue(req.query.metric) ?? "cost";
  const metricString = typeof metricInput === "string" ? metricInput.toLowerCase() : "cost";
  const capabilityFamilyInput = optionalString(req.query.capability_family);
  const usageMetricInput = optionalString(req.query.usage_metric);
  const defaultFamily: UsageCapabilityFamily = "compute_pressure";
  const resolvedFamily: UsageCapabilityFamily =
    metricString === "usage" && capabilityFamilyInput && isUsageCapabilityFamily(capabilityFamilyInput)
      ? capabilityFamilyInput
      : defaultFamily;
  const defaultUsageMetric: UsageMetric = USAGE_CAPABILITY_REGISTRY[resolvedFamily].defaultMetric;
  const resolvedUsageMetric: UsageMetric =
    metricString === "usage" && usageMetricInput && isUsageMetric(usageMetricInput) ? usageMetricInput : defaultUsageMetric;
  const defaultGroupBy = metricString === "usage" ? "db_engine" : "db_service";

  const parsed = parseWithSchema(explorerQuerySchema, {
    tenantId: resolveTenantId(req),
    startDate: firstValue(req.query.start_date),
    endDate: firstValue(req.query.end_date),
    cloudConnectionId: optionalString(req.query.cloud_connection_id),
    regionKey: optionalString(req.query.region_key),
    dbService: normalizedDbFilters.dbService,
    dbEngine: normalizedDbFilters.dbEngine,
    costBasis: firstValue(req.query.cost_basis) ?? firstValue(req.query.costBasis) ?? "billed_cost",
    metric: metricInput,
    capabilityFamily: metricString === "usage" ? resolvedFamily : undefined,
    usageMetric: metricString === "usage" ? resolvedUsageMetric : undefined,
    groupBy: firstValue(req.query.group_by) ?? defaultGroupBy,
    groupValues: parseGroupValues(firstValue(req.query.group_values) ?? firstValue(req.query.groupValues)),
    resourceTypeValues: parseGroupValues(
      firstValue(req.query.resource_type_values) ??
      firstValue(req.query.resourceTypeValues) ??
      firstValue(req.query.resource_type),
    ),
    costCategoryValues: parseGroupValues(
      firstValue(req.query.cost_category_values) ??
      firstValue(req.query.costCategoryValues) ??
      firstValue(req.query.cost_category),
    ),
  });

  return {
    ...parsed,
    capabilityFamily: parsed.metric === "usage" ? (parsed.capabilityFamily as UsageCapabilityFamily) : undefined,
    usageMetric: parsed.metric === "usage" ? (parsed.usageMetric as UsageMetric) : undefined,
    databaseScope,
  };
}
