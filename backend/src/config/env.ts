import "dotenv/config";

import type { LogLevel } from "../utils/logger.js";

const requiredEnv = (value: string | undefined, key: keyof NodeJS.ProcessEnv): string => {
  if (!value) {
    throw new Error(`${key} is not set`);
  }

  return value;
};

const optionalEnv = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const optionalPositiveNumber = (value: string | undefined, fallback: number): number => {
  const normalized = optionalEnv(value);
  if (!normalized) return fallback;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;

  return parsed;
};

const optionalPositiveInteger = (value: string | undefined): number | undefined => {
  const normalized = optionalEnv(value);
  if (!normalized) return undefined;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
    return undefined;
  }

  return parsed;
};

const rawPort = process.env.PORT;
const parsedPort = Number(rawPort ?? 5000);

const port = Number.isNaN(parsedPort) ? 5000 : parsedPort;

const logLevel: LogLevel =
  process.env.LOG_LEVEL === "debug" ||
  process.env.LOG_LEVEL === "info" ||
  process.env.LOG_LEVEL === "warn" ||
  process.env.LOG_LEVEL === "error"
    ? process.env.LOG_LEVEL
    : "info";

const nodeEnv: "development" | "test" | "production" =
  process.env.NODE_ENV === "production" ||
  process.env.NODE_ENV === "test" ||
  process.env.NODE_ENV === "development"
    ? process.env.NODE_ENV
    : "development";

const env = {
  dbUrl: requiredEnv(process.env.DB_URL, "DB_URL"),
  port,
  logLevel,
  nodeEnv,
  calApiKey: optionalEnv(process.env.CAL_API_KEY),
  calApiBaseUrl: optionalEnv(process.env.CAL_API_BASE_URL),
  calEventTypeId: optionalPositiveInteger(process.env.CAL_EVENT_TYPE_ID),
  calTimezone: optionalEnv(process.env.CAL_TIMEZONE) ?? "UTC",
  calReservationTtlMinutes: optionalPositiveNumber(process.env.CAL_RESERVATION_TTL_MINUTES, 15),
  mailgunApiKey: optionalEnv(process.env.MAILGUN_API_KEY),
  mailgunDomain: optionalEnv(process.env.MAILGUN_DOMAIN),
  mailgunFrom: optionalEnv(process.env.MAILGUN_FROM),
  frontendBaseUrl: optionalEnv(process.env.FRONTEND_BASE_URL),
  resetTokenTtlMinutes: optionalPositiveNumber(process.env.RESET_TOKEN_TTL_MINUTES, 60),
  sessionTtlHours: optionalPositiveNumber(process.env.SESSION_TTL_HOURS, 168),
};

export default env;
