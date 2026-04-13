import type { Request } from "express";

import { BadRequestError } from "../../../errors/http-errors.js";
import type { DashboardRequest } from "../dashboard.types.js";

const parseOptionalInteger = (value: unknown, fieldName: string): number | undefined => {
  if (typeof value === "undefined") {
    return undefined;
  }

  if (Array.isArray(value)) {
    throw new BadRequestError(`${fieldName} must be a single value`);
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new BadRequestError(`${fieldName} must be a valid integer`);
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new BadRequestError(`${fieldName} must be a valid integer`);
  }

  return parsed;
};

const parseIntegerList = (value: unknown, fieldName: string): number[] | undefined => {
  if (typeof value === "undefined") {
    return undefined;
  }

  const rawValues = Array.isArray(value) ? value : [value];
  const normalizedValues = rawValues
    .flatMap((entry) => String(entry).split(","))
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (normalizedValues.length === 0) {
    return undefined;
  }

  const parsed = normalizedValues.map((entry) => Number(entry));
  if (!parsed.every((entry) => Number.isInteger(entry))) {
    throw new BadRequestError(`${fieldName} must be a list of valid integers`);
  }

  return [...new Set(parsed)];
};

const parseOptionalString = (value: unknown): string | undefined => {
  if (typeof value === "undefined") {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value[0];
  }
  if (typeof value !== "string") {
    return undefined;
  }
  return value.trim();
};

export const resolveDashboardTenantId = (req: Request): string => {
  const tenantFromQuery = parseOptionalString(req.query.tenantId);

  if (tenantFromQuery && tenantFromQuery.length > 0) {
    return tenantFromQuery;
  }

  const tenantFromAuth =
    req.auth?.user.tenantId ??
    (req as Request & { user?: { tenantId?: string } }).user?.tenantId ??
    (req as Request & { tenantId?: string }).tenantId;

  if (tenantFromAuth && tenantFromAuth.trim().length > 0) {
    return tenantFromAuth.trim();
  }

  throw new BadRequestError("tenantId is required");
};

export const buildDashboardRequest = (req: Request): DashboardRequest => ({
  // Backward-compatible single-value support.
  rawBillingFileId: parseOptionalInteger(req.query.rawBillingFileId, "rawBillingFileId"),
  // Preferred multi-file upload scope input.
  rawBillingFileIds: parseIntegerList(req.query.rawBillingFileIds, "rawBillingFileIds"),
  tenantId: resolveDashboardTenantId(req),
  from: parseOptionalString(req.query.from) ?? parseOptionalString(req.query.billingPeriodStart),
  to: parseOptionalString(req.query.to) ?? parseOptionalString(req.query.billingPeriodEnd),
  providerId: parseOptionalInteger(req.query.providerId, "providerId"),
  billingAccountKey: parseOptionalInteger(req.query.billingAccountKey, "billingAccountKey"),
  subAccountKey: parseOptionalInteger(req.query.subAccountKey, "subAccountKey"),
  serviceKey: parseOptionalInteger(req.query.serviceKey, "serviceKey"),
  regionKey: parseOptionalInteger(req.query.regionKey, "regionKey"),
});
