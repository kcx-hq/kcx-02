import { BadRequestError } from "../../../errors/http-errors.js";
import type { CloudCostReportQuery } from "./report.types.js";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

const asUtcDate = (value: string): Date => new Date(`${value}T00:00:00.000Z`);

export const formatIsoDate = (value: Date): string => value.toISOString().slice(0, 10);

export function parseCloudCostReportQuery(raw: {
  startDate?: unknown;
  endDate?: unknown;
  billingSourceId?: unknown;
}): CloudCostReportQuery {
  const startDate = typeof raw.startDate === "string" ? raw.startDate.trim() : "";
  const endDate = typeof raw.endDate === "string" ? raw.endDate.trim() : "";

  if (!ISO_DATE_PATTERN.test(startDate)) {
    throw new BadRequestError("Invalid or missing startDate. Expected format: YYYY-MM-DD");
  }

  if (!ISO_DATE_PATTERN.test(endDate)) {
    throw new BadRequestError("Invalid or missing endDate. Expected format: YYYY-MM-DD");
  }

  const start = asUtcDate(startDate);
  const end = asUtcDate(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new BadRequestError("Invalid date values provided");
  }

  if (start.getTime() > end.getTime()) {
    throw new BadRequestError("startDate must be before or equal to endDate");
  }

  const maxDays = 370;
  const dayCount = Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1;
  if (dayCount > maxDays) {
    throw new BadRequestError(`Date range too large. Maximum supported window is ${maxDays} days`);
  }

  let billingSourceId: number | undefined;
  if (typeof raw.billingSourceId === "string" && raw.billingSourceId.trim().length > 0) {
    const parsed = Number(raw.billingSourceId);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new BadRequestError("billingSourceId must be a positive integer");
    }
    billingSourceId = parsed;
  }

  return {
    startDate,
    endDate,
    billingSourceId,
  };
}

export function getPreviousPeriodRange(params: CloudCostReportQuery): {
  startDate: string;
  endDate: string;
} {
  const currentStart = asUtcDate(params.startDate);
  const currentEnd = asUtcDate(params.endDate);
  const daysInRange = Math.floor((currentEnd.getTime() - currentStart.getTime()) / DAY_MS) + 1;

  const previousEnd = new Date(currentStart.getTime() - DAY_MS);
  const previousStart = new Date(previousEnd.getTime() - (daysInRange - 1) * DAY_MS);

  return {
    startDate: formatIsoDate(previousStart),
    endDate: formatIsoDate(previousEnd),
  };
}

export function enumerateDateRange(startDate: string, endDate: string): string[] {
  const items: string[] = [];
  let cursor = asUtcDate(startDate);
  const end = asUtcDate(endDate);

  while (cursor.getTime() <= end.getTime()) {
    items.push(formatIsoDate(cursor));
    cursor = new Date(cursor.getTime() + DAY_MS);
  }

  return items;
}

export function formatDisplayPeriod(startDate: string, endDate: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });

  return `${formatter.format(asUtcDate(startDate))} - ${formatter.format(asUtcDate(endDate))}`;
}

