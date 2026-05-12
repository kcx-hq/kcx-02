import type { Request } from "express";
import { z } from "zod";

import { parseWithSchema } from "../../_shared/validation/zod-validate.js";
import { ValidationError } from "../../../errors/http-errors.js";
import { resolveDashboardTenantId } from "../shared/dashboard-request-builder.js";
import type { OverviewFilters, SortOrder } from "./overview.types.js";

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PAGE_SIZE = 100;

const toArray = (value: unknown): string[] => {
  if (typeof value === "undefined") {
    return [];
  }

  const values = Array.isArray(value) ? value : [value];
  return values
    .flatMap((entry) => String(entry).split(","))
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

const parseOptionalIntArray = (value: unknown, fieldName: string): number[] | undefined => {
  if (typeof value === "undefined") {
    return undefined;
  }

  const values = toArray(value);
  if (values.length === 0) {
    return undefined;
  }

  const parsed = values.map((entry) => Number(entry));
  if (!parsed.every((entry) => Number.isInteger(entry) && entry > 0)) {
    throw new ValidationError(`Invalid ${fieldName}`, {
      fieldErrors: {
        [fieldName]: ["must be a comma-separated list of positive integers"],
      },
    });
  }

  return [...new Set(parsed)];
};

const parseOptionalStringArray = (value: unknown): string[] | undefined => {
  const values = toArray(value);
  if (values.length === 0) {
    return undefined;
  }

  return [...new Set(values)];
};

const normalizeDate = (value: unknown, fieldName: string): string | undefined => {
  if (typeof value === "undefined") {
    return undefined;
  }

  const input = Array.isArray(value) ? value[0] : value;
  if (typeof input !== "string") {
    return undefined;
  }

  const trimmed = input.trim();
  if (!DATE_ONLY_REGEX.test(trimmed)) {
    throw new ValidationError(`Invalid ${fieldName}`, {
      fieldErrors: {
        [fieldName]: ["must be a valid date in YYYY-MM-DD format"],
      },
    });
  }

  const date = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== trimmed) {
    throw new ValidationError(`Invalid ${fieldName}`, {
      fieldErrors: {
        [fieldName]: ["must be a valid calendar date"],
      },
    });
  }

  return trimmed;
};

const parsePositiveInt = (value: unknown, fallback: number, fieldName: string): number => {
  if (typeof value === "undefined") {
    return fallback;
  }
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ValidationError(`Invalid ${fieldName}`, {
      fieldErrors: {
        [fieldName]: ["must be a positive integer"],
      },
    });
  }
  return parsed;
};

const parseSortOrder = (value: unknown): SortOrder => {
  const normalized = typeof value === "string" ? value.toLowerCase() : "";
  return normalized === "asc" ? "asc" : "desc";
};

const parseForecastingEnabled = (value: unknown): boolean => {
  if (typeof value === "undefined") {
    return true;
  }

  const raw = Array.isArray(value) ? value[0] : value;
  const normalized = String(raw ?? "").trim().toLowerCase();
  if (normalized.length === 0) {
    return true;
  }

  if (["false", "0", "off", "disabled", "none", "exclude", "no"].includes(normalized)) {
    return false;
  }

  return true;
};

const computeDefaultBillingPeriod = (): { start: string; end: string } => {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 0));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
};

const overviewFiltersSchema = z
  .object({
    tenantId: z.string().trim().min(1),
    billingSourceIds: z.array(z.number().int().positive()).optional(),
    billingPeriodStart: z.string().regex(DATE_ONLY_REGEX),
    billingPeriodEnd: z.string().regex(DATE_ONLY_REGEX),
    forecastingEnabled: z.boolean(),
    accountKeys: z.array(z.number().int().positive()).optional(),
    serviceKeys: z.array(z.number().int().positive()).optional(),
    regionKeys: z.array(z.number().int().positive()).optional(),
    severity: z.array(z.enum(["low", "medium", "high"])).optional(),
    status: z.array(z.string().trim().min(1)).optional(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive().max(MAX_PAGE_SIZE),
    sortBy: z.string().trim().min(1).optional(),
    sortOrder: z.enum(["asc", "desc"]),
  })
  .refine((value) => value.billingPeriodStart <= value.billingPeriodEnd, {
    message: "billingPeriodStart must be less than or equal to billingPeriodEnd",
    path: ["billingPeriodStart"],
  });

export function buildOverviewFilters(req: Request): OverviewFilters {
  const tenantId = resolveDashboardTenantId(req);
  const defaultPeriod = computeDefaultBillingPeriod();

  const billingPeriodStart =
    normalizeDate(req.query.billingPeriodStart, "billingPeriodStart") ??
    normalizeDate(req.query.from, "from") ??
    defaultPeriod.start;
  const billingPeriodEnd =
    normalizeDate(req.query.billingPeriodEnd, "billingPeriodEnd") ??
    normalizeDate(req.query.to, "to") ??
    defaultPeriod.end;
  const billingSourceIds =
    parseOptionalIntArray(req.query.billingSourceIds, "billingSourceIds") ??
    parseOptionalIntArray(req.query.billingSourceId, "billingSourceId");
  const forecastingEnabled = parseForecastingEnabled(
    req.query.forecastingEnabled ??
      req.query.forecasting ??
      req.query.forecastEnabled ??
      req.query.forecastFilter ??
      req.query.forecastingFilter,
  );

  const accountKeys =
    parseOptionalIntArray(req.query.accountKeys, "accountKeys") ??
    parseOptionalIntArray(req.query.subAccountKeys, "subAccountKeys") ??
    parseOptionalIntArray(req.query.subAccountKey, "subAccountKey");
  const serviceKeys =
    parseOptionalIntArray(req.query.serviceKeys, "serviceKeys") ??
    parseOptionalIntArray(req.query.serviceKey, "serviceKey");
  const regionKeys =
    parseOptionalIntArray(req.query.regionKeys, "regionKeys") ??
    parseOptionalIntArray(req.query.regionKey, "regionKey");

  const severity = parseOptionalStringArray(req.query.severity)?.map((entry) => entry.toLowerCase());
  const status = parseOptionalStringArray(req.query.status)?.map((entry) => entry.toLowerCase());

  const page = parsePositiveInt(req.query.page, 1, "page");
  const pageSize = Math.min(parsePositiveInt(req.query.pageSize, 25, "pageSize"), MAX_PAGE_SIZE);
  const sortBy = parseOptionalStringArray(req.query.sortBy)?.[0];
  const sortOrder = parseSortOrder(req.query.sortOrder);

  return parseWithSchema(overviewFiltersSchema, {
    tenantId,
    billingSourceIds,
    billingPeriodStart,
    billingPeriodEnd,
    forecastingEnabled,
    accountKeys,
    serviceKeys,
    regionKeys,
    severity,
    status,
    page,
    pageSize,
    sortBy,
    sortOrder,
  });
}
