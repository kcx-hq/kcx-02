import "dotenv/config";

import type { LogLevel } from "../utils/logger.js";

const requiredEnv = (value: string | undefined, key: keyof NodeJS.ProcessEnv): string => {
  if (!value) {
    throw new Error(`${key} is not set`);
  }

  return value;
};

const optionalEnv = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
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

const env = {
  dbUrl: requiredEnv(process.env.DB_URL, "DB_URL"),
  port,
  logLevel,
  // Optional at boot to avoid breaking migrations/build tooling that imports config.
  // Feature services validate these when used.
  mailgunApiKey: optionalEnv(process.env.MAILGUN_API_KEY),
  mailgunDomain: optionalEnv(process.env.MAILGUN_DOMAIN),
  mailgunFrom: optionalEnv(process.env.MAILGUN_FROM),
  frontendBaseUrl: optionalEnv(process.env.FRONTEND_BASE_URL),
  resetTokenTtlMinutes: Number(process.env.RESET_TOKEN_TTL_MINUTES ?? 60),
  sessionTtlHours: Number(process.env.SESSION_TTL_HOURS ?? 24 * 7),
};

export default env;
