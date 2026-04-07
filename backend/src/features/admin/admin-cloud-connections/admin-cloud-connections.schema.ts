import { BadRequestError } from "../../../errors/http-errors.js";
import type {
  AdminCloudConnectionsListQuery,
  AdminCloudConnectionsListQueryParsed,
  AdminCloudIntegrationMode,
  AdminCloudIntegrationStatus,
} from "./admin-cloud-connections.types.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const ALLOWED_MODES = new Set<AdminCloudIntegrationMode>(["manual", "automatic"]);
const ALLOWED_STATUSES = new Set<AdminCloudIntegrationStatus>([
  "draft",
  "connecting",
  "awaiting_validation",
  "active",
  "active_with_warnings",
  "failed",
  "suspended",
]);
const ALLOWED_SORT_FIELDS = new Set<AdminCloudConnectionsListQueryParsed["sortBy"]>([
  "displayName",
  "status",
  "mode",
  "cloudAccountId",
  "lastValidatedAt",
  "connectedAt",
  "createdAt",
  "updatedAt",
]);

const normalizeOptionalString = (value: unknown): string | null => {
  if (typeof value === "undefined" || value === null) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
};

const parsePositiveInt = (value: unknown, fieldName: string, fallback: number): number => {
  if (typeof value === "undefined" || value === null || String(value).trim().length === 0) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new BadRequestError(`${fieldName} must be a positive integer`);
  }

  return parsed;
};

const parseMode = (value: unknown): AdminCloudIntegrationMode | null => {
  const normalized = normalizeOptionalString(value)?.toLowerCase();
  if (!normalized) return null;
  if (ALLOWED_MODES.has(normalized as AdminCloudIntegrationMode)) {
    return normalized as AdminCloudIntegrationMode;
  }
  throw new BadRequestError("mode must be one of manual, automatic");
};

const parseStatus = (value: unknown): AdminCloudIntegrationStatus | null => {
  const normalized = normalizeOptionalString(value)?.toLowerCase();
  if (!normalized) return null;
  if (ALLOWED_STATUSES.has(normalized as AdminCloudIntegrationStatus)) {
    return normalized as AdminCloudIntegrationStatus;
  }
  throw new BadRequestError(
    "status must be one of draft, connecting, awaiting_validation, active, active_with_warnings, failed, suspended",
  );
};

const parseBooleanFilter = (value: unknown, fieldName: string): boolean | null => {
  const normalized = normalizeOptionalString(value)?.toLowerCase();
  if (!normalized) return null;

  if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
  if (normalized === "false" || normalized === "0" || normalized === "no") return false;

  throw new BadRequestError(`${fieldName} must be a boolean (true/false)`);
};

const parseSortBy = (value: unknown): AdminCloudConnectionsListQueryParsed["sortBy"] => {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return "updatedAt";

  if (ALLOWED_SORT_FIELDS.has(normalized as AdminCloudConnectionsListQueryParsed["sortBy"])) {
    return normalized as AdminCloudConnectionsListQueryParsed["sortBy"];
  }

  throw new BadRequestError(
    "sortBy must be one of displayName, status, mode, cloudAccountId, lastValidatedAt, connectedAt, createdAt, updatedAt",
  );
};

const parseSortOrder = (value: unknown): "asc" | "desc" => {
  const normalized = normalizeOptionalString(value)?.toLowerCase();
  if (!normalized) return "desc";
  if (normalized === "asc" || normalized === "desc") return normalized;
  throw new BadRequestError("sortOrder must be asc or desc");
};

const parseDate = (value: unknown, fieldName: string): Date | null => {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return null;

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestError(`${fieldName} must be a valid date`);
  }

  return parsed;
};

const parseDateTo = (value: unknown): Date | null => {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return null;

  const parsed = parseDate(normalized, "dateTo");
  if (!parsed) return null;

  if (DATE_ONLY_REGEX.test(normalized)) {
    return new Date(parsed.getTime() + 24 * 60 * 60 * 1000 - 1);
  }

  return parsed;
};

export const parseAdminCloudConnectionsListQuery = (
  query: AdminCloudConnectionsListQuery,
): AdminCloudConnectionsListQueryParsed => {
  const page = parsePositiveInt(query.page, "page", DEFAULT_PAGE);
  const parsedLimit = parsePositiveInt(query.limit, "limit", DEFAULT_LIMIT);
  const limit = Math.min(parsedLimit, MAX_LIMIT);

  const dateFrom = parseDate(query.dateFrom, "dateFrom");
  const dateTo = parseDateTo(query.dateTo);
  if (dateFrom && dateTo && dateFrom.getTime() > dateTo.getTime()) {
    throw new BadRequestError("dateFrom must be less than or equal to dateTo");
  }

  return {
    page,
    limit,
    search: normalizeOptionalString(query.search),
    provider: normalizeOptionalString(query.provider),
    mode: parseMode(query.mode),
    status: parseStatus(query.status),
    billingSourceLinked: parseBooleanFilter(query.billingSourceLinked, "billingSourceLinked"),
    dateFrom,
    dateTo,
    sortBy: parseSortBy(query.sortBy),
    sortOrder: parseSortOrder(query.sortOrder),
  };
};

export const parseAdminCloudConnectionIntegrationId = (value: unknown): string => {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    throw new BadRequestError("integrationId is required");
  }
  return normalized;
};

