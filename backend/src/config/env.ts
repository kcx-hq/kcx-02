import "dotenv/config";

import type { LogLevel } from "../utils/logger.js";

const requiredEnv = (value: string | undefined, key: keyof NodeJS.ProcessEnv): string => {
  if (!value) {
    throw new Error(`${key} is not set`);
  }

  return value;
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
};

export default env;
