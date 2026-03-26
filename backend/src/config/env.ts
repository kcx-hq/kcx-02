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
};

export default env;
