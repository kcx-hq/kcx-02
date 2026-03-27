import { BUSINESS_TIMEZONE, resolveTimeZone } from "./timezone.js";

const DATE_TIME_FORMATTER_OPTIONS: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
};

const TIME_FORMATTER_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
};

export function formatUtcSlotRangeForEmail(
  slotStart: Date,
  slotEnd: Date,
  timeZone?: string,
): string {
  const effectiveTimeZone = resolveTimeZone(timeZone, BUSINESS_TIMEZONE);

  const startText = new Intl.DateTimeFormat("en-US", {
    timeZone: effectiveTimeZone,
    ...DATE_TIME_FORMATTER_OPTIONS,
  }).format(slotStart);

  const endText = new Intl.DateTimeFormat("en-US", {
    timeZone: effectiveTimeZone,
    ...TIME_FORMATTER_OPTIONS,
  }).format(slotEnd);

  return `${startText} - ${endText} (${effectiveTimeZone})`;
}

