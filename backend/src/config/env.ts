import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env") });

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

const optionalBoolean = (value: string | undefined): boolean | undefined => {
  const normalized = optionalEnv(value)?.toLowerCase();
  if (!normalized) return undefined;
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  return undefined;
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
  adminEmail: optionalEnv(process.env.ADMIN_EMAIL),
  adminPassword: optionalEnv(process.env.ADMIN_PASSWORD),
  calApiKey: optionalEnv(process.env.CAL_API_KEY),
  calApiBaseUrl: optionalEnv(process.env.CAL_API_BASE_URL),
  calApiVersion: optionalEnv(process.env.CAL_API_VERSION) ?? "2024-08-13",
  calSlotsApiVersion: optionalEnv(process.env.CAL_SLOTS_API_VERSION) ?? "2024-09-04",
  calBookingsApiVersion: optionalEnv(process.env.CAL_BOOKINGS_API_VERSION) ?? "2024-08-13",
  calEventTypeId: optionalPositiveInteger(process.env.CAL_EVENT_TYPE_ID),
  calTimezone: optionalEnv(process.env.CAL_TIMEZONE) ?? "UTC",
  calReservationTtlMinutes: optionalPositiveNumber(process.env.CAL_RESERVATION_TTL_MINUTES, 15),
  mailgunApiKey: optionalEnv(process.env.MAILGUN_API_KEY),
  mailgunDomain: optionalEnv(process.env.MAILGUN_DOMAIN),
  mailgunFrom: optionalEnv(process.env.MAILGUN_FROM),
  frontendBaseUrl: optionalEnv(process.env.FRONTEND_BASE_URL),
  awsCallbackUrl: optionalEnv(process.env.AWS_CALLBACK_URL),
  awsFileEventCallbackUrl:
    optionalEnv(process.env.AWS_FILE_EVENT_CALLBACK_URL) ?? optionalEnv(process.env.AWS_CALLBACK_URL),
  awsCloudTrailTemplateUrl: optionalEnv(process.env.AWS_CLOUDTRAIL_TEMPLATE_URL),
  awsValidationAccessKeyId:
    optionalEnv(process.env.AWS_VALIDATION_ACCESS_KEY_ID) ?? optionalEnv(process.env.AWS_ACCESS_KEY_ID),
  awsValidationSecretAccessKey:
    optionalEnv(process.env.AWS_VALIDATION_SECRET_ACCESS_KEY) ?? optionalEnv(process.env.AWS_SECRET_ACCESS_KEY),
  awsValidationSessionToken:
    optionalEnv(process.env.AWS_VALIDATION_SESSION_TOKEN) ?? optionalEnv(process.env.AWS_SESSION_TOKEN),
  resetTokenTtlMinutes: optionalPositiveNumber(process.env.RESET_TOKEN_TTL_MINUTES, 60),
  sessionTtlHours: optionalPositiveNumber(process.env.SESSION_TTL_HOURS, 168),
  awsRegion: optionalEnv(process.env.AWS_REGION) ?? "us-east-1",
  awsAccessKeyId: optionalEnv(process.env.AWS_ACCESS_KEY_ID),
  awsSecretAccessKey: optionalEnv(process.env.AWS_SECRET_ACCESS_KEY),
  awsSessionToken: optionalEnv(process.env.AWS_SESSION_TOKEN),
  awsS3Endpoint: optionalEnv(process.env.AWS_S3_ENDPOINT),
  awsS3ForcePathStyle: optionalBoolean(process.env.AWS_S3_FORCE_PATH_STYLE) ?? false,
  awsFirstFilePollingIntervalMs: optionalPositiveInteger(process.env.AWS_FIRST_FILE_POLLING_INTERVAL_MS) ?? 300000,
  rawBillingFilesBucket: optionalEnv(process.env.RAW_BILLING_FILES_BUCKET),
  billingIngestionBatchSize: optionalPositiveInteger(process.env.BILLING_INGESTION_BATCH_SIZE) ?? 1000,
  billingIngestionRowConcurrency:
    optionalPositiveInteger(process.env.BILLING_INGESTION_ROW_CONCURRENCY) ?? 25,
  billingIngestionStatusMinIntervalMs:
    optionalPositiveInteger(process.env.BILLING_INGESTION_STATUS_MIN_INTERVAL_MS) ?? 2000,
  billingS3UploadSessionTtlMinutes:
    optionalPositiveInteger(process.env.BILLING_S3_UPLOAD_SESSION_TTL_MINUTES) ?? 45,
};

export default env;
