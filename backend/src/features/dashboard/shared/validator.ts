import { BadRequestError } from "../../../errors/http-errors.js";
import type { DashboardRequest } from "../dashboard.types.js";

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const isValidDateOnly = (value: string): boolean => {
  if (!DATE_ONLY_REGEX.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return parsed.toISOString().slice(0, 10) === value;
};

export function validateDashboardRequest(input: DashboardRequest): void {
  if (!input.tenantId || input.tenantId.trim().length === 0) {
    throw new BadRequestError("tenantId is required");
  }

  const hasRawBillingFileId = typeof input.rawBillingFileId === "number";
  const hasRawBillingFileIds = Array.isArray(input.rawBillingFileIds) && input.rawBillingFileIds.length > 0;
  const hasUploadScope = hasRawBillingFileIds || hasRawBillingFileId;
  const hasBillingSourceId = typeof input.billingSourceId === "number";
  const hasBillingSourceIds = Array.isArray(input.billingSourceIds) && input.billingSourceIds.length > 0;
  const hasBillingSourceScope = hasBillingSourceId || hasBillingSourceIds;
  const hasFrom = typeof input.from === "string";
  const hasTo = typeof input.to === "string";
  const hasDateRange = hasFrom && hasTo;
  const hasPartialDateRange = hasFrom !== hasTo;

  if (hasPartialDateRange) {
    throw new BadRequestError("Both from and to are required when using date range scope");
  }

  if (!hasUploadScope && !hasDateRange) {
    throw new BadRequestError("Provide either rawBillingFileId/rawBillingFileIds or from and to");
  }

  if (hasRawBillingFileIds && !input.rawBillingFileIds?.every((id) => Number.isInteger(id))) {
    throw new BadRequestError("rawBillingFileIds must contain valid integers");
  }

  if (hasBillingSourceIds && !input.billingSourceIds?.every((id) => Number.isInteger(id))) {
    throw new BadRequestError("billingSourceIds must contain valid integers");
  }

  if (hasUploadScope && hasBillingSourceScope) {
    throw new BadRequestError("Provide upload scope or billing source scope, not both");
  }

  if (hasDateRange) {
    if (!isValidDateOnly(input.from as string) || !isValidDateOnly(input.to as string)) {
      throw new BadRequestError("from and to must be valid YYYY-MM-DD dates");
    }

    if ((input.from as string) > (input.to as string)) {
      throw new BadRequestError("from must be less than or equal to to");
    }
  }
}
