import env from "../config/env.js";

const TIMEZONE_ALIAS_MAP: Record<string, string> = {
  "Asia/Calcutta": "Asia/Kolkata",
};

function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

function normalizeTimeZone(input: string, fallback: string): string {
  const trimmed = input.trim();
  const mapped = TIMEZONE_ALIAS_MAP[trimmed] ?? trimmed;
  if (isValidTimeZone(mapped)) return mapped;
  return fallback;
}

export const BUSINESS_TIMEZONE = normalizeTimeZone(env.calTimezone, "Asia/Kolkata");

export function isValidIanaTimeZone(input: string): boolean {
  const trimmed = input.trim();
  if (trimmed.length === 0) return false;
  const mapped = TIMEZONE_ALIAS_MAP[trimmed] ?? trimmed;
  return isValidTimeZone(mapped);
}

export function resolveTimeZone(input: string | null | undefined, fallback: string): string {
  if (!input) return fallback;
  return normalizeTimeZone(input, fallback);
}
