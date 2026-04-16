import type { Request, Response } from "express";
import crypto from "node:crypto";
import { ComputeOptimizerClient, UpdateEnrollmentStatusCommand } from "@aws-sdk/client-compute-optimizer";
import { Op, QueryTypes, type Transaction } from "sequelize";

import env from "../../../../config/env.js";
import { HTTP_STATUS } from "../../../../constants/http-status.js";
import {
  ConflictError,
  DuplicateCloudConnectionError,
  InternalServerError,
  NotFoundError,
  UnauthorizedError,
} from "../../../../errors/http-errors.js";
import {
  BillingIngestionRun,
  BillingIngestionRunFile,
  BillingSource,
  CloudConnectionV2,
  CloudIntegration,
  CloudProvider,
  CloudtrailSource,
  sequelize,
} from "../../../../models/index.js";
import { sendSuccess } from "../../../../utils/api-response.js";
import { logger } from "../../../../utils/logger.js";
import { parseWithSchema } from "../../../_shared/validation/zod-validate.js";
import {
  assertCloudAccountIsUnique,
  syncAutomaticCloudIntegration,
} from "../../cloud-integration-registry.service.js";
import { syncS3UploadConnectionFromAwsSetup } from "../s3-upload-connection-sync.service.js";
import {
  buildAwsCloudFormationCreateStackUrl,
} from "./aws-cloudformation-url.js";
import { runInitialBackfillAfterValidation } from "../exports/aws-export-ingestion.service.js";
import { validateAwsConnection } from "./aws-connection-validation.service.js";
import { assumeRole } from "../infrastructure/aws-sts.service.js";
import {
  type AwsBillingConnectionCallbackPayload,
  type AwsCloudTrailConnectionCallbackPayload,
  type AwsConnectionCallbackPayload,
  type GenerateAwsCloudFormationSetupPayload,
  awsConnectionCallbackSchema,
  createCloudConnectionSchema,
  generateAwsCloudFormationSetupSchema,
} from "./cloud-connections.schema.js";

const requireUserId = (req: Request) => {
  const userId = req.auth?.user.id;
  if (!userId || typeof userId !== "string") {
    throw new UnauthorizedError("User authentication required");
  }
  return userId;
};

const requireTenantId = (req: Request) => {
  const tenantId = req.auth?.user.tenantId;
  if (!tenantId || typeof tenantId !== "string") {
    throw new UnauthorizedError("Tenant context required");
  }
  return tenantId;
};

const PROVIDER_NAME_BY_CODE: Record<string, string> = {
  aws: "Amazon Web Services",
  azure: "Microsoft Azure",
  gcp: "Google Cloud Platform",
  oracle: "Oracle Cloud",
  custom: "Custom",
};

const DEFAULT_AWS_EXPORT_PREFIX = "kcx/data-exports/cur2";
const DEFAULT_AWS_CLOUDTRAIL_PREFIX = "kcx/cloudtrail";
const DEFAULT_AWS_CALLBACK_CADENCE = "hourly";
const DEFAULT_AWS_CLOUDTRAIL_CADENCE = "event_driven";
const AWS_CALLBACK_DELETE_EVENT_TYPE = "stack_delete";
const buildDefaultAwsExportName = (connectionId: string) => `KCX-CUR2-${connectionId.replace(/-/g, "").slice(0, 10)}`;
const buildDefaultAwsCloudTrailName = (connectionId: string) =>
  `kcx-cloudtrail-${connectionId.replace(/-/g, "").slice(0, 8)}`;
type CloudConnectionV2Instance = InstanceType<typeof CloudConnectionV2>;
type BillingSourceInstance = InstanceType<typeof BillingSource>;
type CloudtrailSourceInstance = InstanceType<typeof CloudtrailSource>;

type AwsCallbackLogContext = {
  connectionId: string;
  accountId: string;
  stackId: string;
  exportName: string;
  eventType: string;
};

type BillingSourceUpsertResult = {
  billingSource: BillingSourceInstance;
  changed: boolean;
};

type AwsCallbackAcceptanceResult = {
  connection: CloudConnectionV2Instance;
  billingSource: BillingSourceInstance;
  cadence: string;
  shouldScheduleValidation: boolean;
  logContext: AwsCallbackLogContext;
};

type AwsCloudTrailCallbackAcceptanceResult = {
  connection: CloudConnectionV2Instance;
  cloudtrailSource: CloudtrailSourceInstance;
  cadence: string;
  shouldScheduleValidation: false;
};

type ComputeOptimizerEnableResult = {
  enabled: boolean;
  error: string | null;
};

const postCallbackValidationInFlight = new Set<string>();

const normalizeOptional = (value: string | undefined): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const ensureAwsAutoSetupFields = async (connection: CloudConnectionV2Instance): Promise<CloudConnectionV2Instance> => {
  const patch: Partial<{
    externalId: string;
    callbackToken: string;
    stackName: string;
    region: string;
  }> = {};

  if (!connection.externalId || connection.externalId.trim().length === 0) {
    patch.externalId = `kcx-${crypto.randomUUID()}`;
  }
  if (!connection.callbackToken || connection.callbackToken.trim().length === 0) {
    patch.callbackToken = crypto.randomBytes(32).toString("hex");
  }
  if (!connection.stackName || connection.stackName.trim().length === 0) {
    patch.stackName = `kcx-${connection.id.substring(0, 8)}`;
  }
  if (!connection.region || connection.region.trim().length === 0) {
    patch.region = "us-east-1";
  }

  if (Object.keys(patch).length === 0) {
    return connection;
  }

  await connection.update(patch);
  return connection;
};

const resolveBillingSourceStatusAfterValidation = (
  validationStatus: string,
  currentStatus: string,
  lastFileReceivedAt: Date | null,
): string => {
  if (validationStatus !== "active") return validationStatus;
  if (currentStatus === "active" || lastFileReceivedAt) return "active";
  return "pending_first_file";
};

const normalizeCadence = (value: string | null | undefined): string => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized || DEFAULT_AWS_CALLBACK_CADENCE;
};

const normalizeCloudTrailCadence = (value: string | null | undefined): string => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized || DEFAULT_AWS_CLOUDTRAIL_CADENCE;
};

const isDeleteCallbackEvent = (eventType: string): boolean =>
  eventType.trim().toLowerCase() === AWS_CALLBACK_DELETE_EVENT_TYPE;

const hasConnectionCoreChanges = (
  connection: CloudConnectionV2Instance,
  payload: AwsBillingConnectionCallbackPayload,
): boolean => {
  const nextBillingRoleArn = String(payload.billing_role_arn ?? "").trim();
  const nextActionRoleArn = payload.action_role_arn?.trim();
  const hasActionRoleArnChange =
    typeof nextActionRoleArn === "string" && String(connection.actionRoleArn ?? "").trim() !== nextActionRoleArn;

  return (
    String(connection.cloudAccountId ?? "").trim() !== payload.account_id.trim() ||
    String(connection.billingRoleArn ?? "").trim() !== nextBillingRoleArn ||
    hasActionRoleArnChange ||
    String(connection.stackId ?? "").trim() !== payload.stack_id.trim() ||
    String(connection.exportName ?? "").trim() !== payload.export_name.trim() ||
    String(connection.exportBucket ?? "").trim() !== payload.export_bucket.trim() ||
    String(connection.exportPrefix ?? "").trim() !== payload.export_prefix.trim() ||
    String(connection.exportRegion ?? "").trim() !== payload.export_region.trim() ||
    String(connection.exportArn ?? "").trim() !== payload.export_arn.trim()
  );
};

async function enableComputeOptimizerBestEffort(input: {
  connection: CloudConnectionV2Instance;
  payload: AwsBillingConnectionCallbackPayload;
}): Promise<ComputeOptimizerEnableResult> {
  const { connection, payload } = input;
  const preferredRoleArn = payload.action_role_arn?.trim();
  const fallbackRoleArn = String(payload.billing_role_arn ?? "").trim();
  const roleArn = preferredRoleArn || fallbackRoleArn;

  if (!roleArn) {
    return {
      enabled: false,
      error: "Missing AWS role ARN for Compute Optimizer enrollment",
    };
  }

  const region = String(payload.export_region ?? connection.region ?? "us-east-1").trim() || "us-east-1";

  try {
    const credentials = await assumeRole(roleArn, connection.externalId ?? null);
    const client = new ComputeOptimizerClient({
      region,
      credentials,
    });
    await client.send(
      new UpdateEnrollmentStatusCommand({
        status: "Active",
      }),
    );

    logger.info("AWS Compute Optimizer enrollment enabled", {
      connectionId: connection.id,
      accountId: payload.account_id.trim(),
      roleArn,
      region,
      sourceType: payload.source_type,
      eventType: payload.event_type,
    });

    return {
      enabled: true,
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn("AWS callback accepted but Compute Optimizer enrollment failed", {
      connectionId: connection.id,
      accountId: payload.account_id.trim(),
      roleArn,
      region,
      sourceType: payload.source_type,
      eventType: payload.event_type,
      message,
    });

    return {
      enabled: false,
      error: message,
    };
  }
}

async function findConnectionByCallbackToken(callbackToken: string): Promise<CloudConnectionV2Instance> {
  const normalizedCallbackToken = callbackToken.trim();
  const connection = await CloudConnectionV2.findOne({
    where: { callbackToken: normalizedCallbackToken },
  });

  if (!connection) {
    throw new NotFoundError("Invalid callback token");
  }

  return connection;
}

async function upsertBillingSourceFromCallback(input: {
  connection: CloudConnectionV2Instance;
  payload: AwsBillingConnectionCallbackPayload;
  cadence: string;
  status?: string;
  transaction: Transaction;
}): Promise<BillingSourceUpsertResult> {
  const { connection, payload, cadence, status, transaction } = input;

  const existingBillingSource = await BillingSource.findOne({
    where: {
      tenantId: connection.tenantId,
      cloudConnectionId: connection.id,
      sourceType: payload.source_type,
    },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  const billingSourcePayload = {
    tenantId: connection.tenantId,
    cloudConnectionId: connection.id,
    cloudProviderId: connection.providerId,
    sourceName: `AWS Data Exports (${payload.export_name.trim()})`,
    sourceType: payload.source_type,
    setupMode: payload.setup_mode,
    format: payload.format,
    schemaType: payload.schema_type,
    bucketName: payload.export_bucket.trim(),
    pathPrefix: payload.export_prefix.trim(),
    cadence,
    status: status ?? "awaiting_validation",
  };

  if (!existingBillingSource) {
    const created = await BillingSource.create(billingSourcePayload, { transaction });
    return { billingSource: created, changed: true };
  }

  const changed =
    String(existingBillingSource.sourceName ?? "").trim() !== billingSourcePayload.sourceName ||
    String(existingBillingSource.format ?? "").trim() !== billingSourcePayload.format ||
    String(existingBillingSource.schemaType ?? "").trim() !== billingSourcePayload.schemaType ||
    String(existingBillingSource.bucketName ?? "").trim() !== billingSourcePayload.bucketName ||
    String(existingBillingSource.pathPrefix ?? "").trim() !== billingSourcePayload.pathPrefix ||
    String(existingBillingSource.cadence ?? "").trim().toLowerCase() !== cadence ||
    (status !== undefined && String(existingBillingSource.status ?? "").trim() !== status);

  const billingSource = await existingBillingSource.update(
    {
      ...billingSourcePayload,
      status: status ?? existingBillingSource.status,
    },
    { transaction },
  );
  return { billingSource, changed };
}

const normalizeCloudtrailPrefix = (value: string | null | undefined): string => {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  return trimmed.replace(/^\/+/, "");
};

async function upsertCloudtrailSourceFromCallback(input: {
  connection: CloudConnectionV2Instance;
  payload: AwsCloudTrailConnectionCallbackPayload;
  status: string;
  transaction: Transaction;
}): Promise<CloudtrailSourceInstance> {
  const { connection, payload, status, transaction } = input;
  const trailName = payload.trail_name.trim();
  const bucketName = payload.bucket_name.trim();
  const prefix = normalizeCloudtrailPrefix(payload.prefix);

  let existingCloudtrailSource: CloudtrailSourceInstance | null = null;
  if (trailName) {
    existingCloudtrailSource = await CloudtrailSource.findOne({
      where: {
        cloudConnectionId: connection.id,
        trailName,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
  }

  if (!existingCloudtrailSource) {
    existingCloudtrailSource = await CloudtrailSource.findOne({
      where: {
        cloudConnectionId: connection.id,
        bucketName,
        prefix,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
  }

  const cloudtrailSourcePayload = {
    tenantId: connection.tenantId,
    cloudConnectionId: connection.id,
    trailName,
    bucketName,
    bucketRegion: payload.bucket_region.trim(),
    prefix,
    status,
    updatedAt: new Date(),
  };

  if (!existingCloudtrailSource) {
    return CloudtrailSource.create(cloudtrailSourcePayload, { transaction });
  }

  return existingCloudtrailSource.update(cloudtrailSourcePayload, { transaction });
}

async function handleAwsDeleteCallback(input: {
  connection: CloudConnectionV2Instance;
  payload: AwsBillingConnectionCallbackPayload;
  cadence: string;
}): Promise<AwsCallbackAcceptanceResult> {
  const { connection, payload, cadence } = input;
  const billingRoleArn = String(payload.billing_role_arn ?? "").trim();
  const actionRoleArn = payload.action_role_arn?.trim();
  const now = new Date();
  const logContext: AwsCallbackLogContext = {
    connectionId: connection.id,
    accountId: payload.account_id.trim(),
    stackId: payload.stack_id.trim(),
    exportName: payload.export_name.trim(),
    eventType: payload.event_type,
  };

  const billingSource = await sequelize.transaction(async (transaction) => {
    await connection.update(
      {
        cloudAccountId: payload.account_id.trim(),
        billingRoleArn,
        ...(actionRoleArn ? { actionRoleArn } : {}),
        stackId: payload.stack_id.trim(),
        exportName: payload.export_name.trim(),
        exportBucket: payload.export_bucket.trim(),
        exportPrefix: payload.export_prefix.trim(),
        exportRegion: payload.export_region.trim(),
        exportArn: payload.export_arn.trim(),
        status: "suspended",
        errorMessage: null,
      },
      { transaction },
    );

    const upserted = await upsertBillingSourceFromCallback({
      connection,
      payload,
      cadence,
      status: "suspended",
      transaction,
    });

    return upserted.billingSource;
  });

  await syncAutomaticCloudIntegration(connection, {
    status: "suspended",
    statusMessage: "Disconnected",
    errorMessage: null,
    lastCheckedAt: now,
  });

  try {
    await syncS3UploadConnectionFromAwsSetup({
      tenantId: connection.tenantId,
      createdBy: connection.createdBy ?? null,
      roleArn: billingRoleArn,
      externalId: connection.externalId ?? null,
      bucketName: payload.export_bucket.trim(),
      basePrefix: payload.export_prefix.trim(),
      awsAccountId: payload.account_id.trim(),
      status: "suspended",
      createIfMissing: false,
    });
  } catch (s3SyncError) {
    logger.warn("AWS delete callback accepted but failed to suspend S3 upload connection", {
      connectionId: connection.id,
      tenantId: connection.tenantId,
      bucketName: payload.export_bucket.trim(),
      prefix: payload.export_prefix.trim(),
      message: s3SyncError instanceof Error ? s3SyncError.message : String(s3SyncError),
    });
  }

  logger.info("AWS setup callback accepted (delete)", {
    ...logContext,
    cadence,
    billingRoleArn: connection.billingRoleArn ?? null,
    actionRoleArn: connection.actionRoleArn ?? null,
    billingSourceId: billingSource.id,
    status: "suspended",
  });

  return {
    connection,
    billingSource,
    cadence,
    shouldScheduleValidation: false,
    logContext,
  };
}

async function acceptAwsCallback(input: {
  connection: CloudConnectionV2Instance;
  payload: AwsBillingConnectionCallbackPayload;
  cadence: string;
}): Promise<AwsCallbackAcceptanceResult> {
  const { connection, payload, cadence } = input;
  const billingRoleArn = String(payload.billing_role_arn ?? "").trim();
  const actionRoleArn = payload.action_role_arn?.trim();
  const now = new Date();
  const logContext: AwsCallbackLogContext = {
    connectionId: connection.id,
    accountId: payload.account_id.trim(),
    stackId: payload.stack_id.trim(),
    exportName: payload.export_name.trim(),
    eventType: payload.event_type,
  };

  const coreConnectionChanged = hasConnectionCoreChanges(connection, payload);
  const shouldScheduleValidation =
    coreConnectionChanged ||
    !connection.lastValidatedAt ||
    connection.status === "draft" ||
    connection.status === "connecting" ||
    connection.status === "awaiting_validation";

  const nextConnectionStatus = shouldScheduleValidation ? "awaiting_validation" : connection.status;
  const nextBillingSourceStatus = shouldScheduleValidation ? "awaiting_validation" : undefined;

  const { billingSource } = await sequelize.transaction(async (transaction) => {
    await connection.update(
      {
        cloudAccountId: payload.account_id.trim(),
        billingRoleArn,
        ...(actionRoleArn ? { actionRoleArn } : {}),
        stackId: payload.stack_id.trim(),
        exportName: payload.export_name.trim(),
        exportBucket: payload.export_bucket.trim(),
        exportPrefix: payload.export_prefix.trim(),
        exportRegion: payload.export_region.trim(),
        exportArn: payload.export_arn.trim(),
        status: nextConnectionStatus,
        connectedAt: connection.connectedAt ?? now,
        errorMessage: shouldScheduleValidation ? null : connection.errorMessage,
      },
      { transaction },
    );

    return upsertBillingSourceFromCallback({
      connection,
      payload,
      cadence,
      status: nextBillingSourceStatus,
      transaction,
    });
  });

  await syncAutomaticCloudIntegration(connection, {
    status:
      nextConnectionStatus === "suspended"
        ? "suspended"
        : nextConnectionStatus === "failed"
          ? "failed"
          : shouldScheduleValidation
            ? "awaiting_validation"
            : connection.status === "active_with_warnings"
              ? "active_with_warnings"
              : "active",
    statusMessage:
      nextConnectionStatus === "suspended"
        ? "Disconnected"
        : nextConnectionStatus === "failed"
          ? "Connection Failed"
          : shouldScheduleValidation
            ? "Awaiting Validation"
            : connection.status === "active_with_warnings"
              ? "Warnings Detected"
              : "Pending First Ingest",
    errorMessage: shouldScheduleValidation ? null : connection.errorMessage,
    lastCheckedAt: now,
    ...(shouldScheduleValidation ? {} : { lastValidatedAt: connection.lastValidatedAt ?? null }),
  });

  try {
    await syncS3UploadConnectionFromAwsSetup({
      tenantId: connection.tenantId,
      createdBy: connection.createdBy ?? null,
      roleArn: billingRoleArn,
      externalId: connection.externalId ?? null,
      bucketName: payload.export_bucket.trim(),
      basePrefix: payload.export_prefix.trim(),
      awsAccountId: payload.account_id.trim(),
      status: "active",
    });
  } catch (s3SyncError) {
    logger.warn("AWS callback accepted but failed to sync S3 upload connection", {
      connectionId: connection.id,
      tenantId: connection.tenantId,
      bucketName: payload.export_bucket.trim(),
      prefix: payload.export_prefix.trim(),
      message: s3SyncError instanceof Error ? s3SyncError.message : String(s3SyncError),
    });
  }

  logger.info("AWS setup callback accepted", {
    ...logContext,
    cadence,
    billingRoleArn: connection.billingRoleArn ?? null,
    actionRoleArn: connection.actionRoleArn ?? null,
    shouldScheduleValidation,
    billingSourceId: billingSource.id,
    status: nextConnectionStatus,
  });

  return {
    connection,
    billingSource,
    cadence,
    shouldScheduleValidation,
    logContext,
  };
}

async function acceptAwsCloudTrailCallback(input: {
  connection: CloudConnectionV2Instance;
  payload: AwsCloudTrailConnectionCallbackPayload;
  cadence: string;
}): Promise<AwsCloudTrailCallbackAcceptanceResult> {
  const { connection, payload, cadence } = input;
  const now = new Date();
  const nextStatus = isDeleteCallbackEvent(payload.event_type) ? "suspended" : "active";
  const nextSourceStatus = isDeleteCallbackEvent(payload.event_type) ? "suspended" : "active";
  const normalizedRoleArn = payload.role_arn?.trim();

  const cloudtrailSource = await sequelize.transaction(async (transaction) => {
    await connection.update(
      {
        cloudAccountId: payload.account_id.trim(),
        stackId: payload.stack_id.trim(),
        // CloudTrail callback role_arn represents the billing/read role, not the EC2 action role.
        ...(normalizedRoleArn ? { billingRoleArn: normalizedRoleArn } : {}),
        status: nextStatus,
        connectedAt: nextStatus === "active" ? connection.connectedAt ?? now : connection.connectedAt,
        errorMessage: null,
      },
      { transaction },
    );

    return upsertCloudtrailSourceFromCallback({
      connection,
      payload,
      status: nextSourceStatus,
      transaction,
    });
  });

  await syncAutomaticCloudIntegration(connection, {
    status: nextStatus === "suspended" ? "suspended" : "active",
    statusMessage: nextStatus === "suspended" ? "Disconnected" : "Connected",
    errorMessage: null,
    lastCheckedAt: now,
    ...(nextStatus === "active" ? { lastValidatedAt: now } : {}),
  });

  logger.info("AWS CloudTrail setup callback accepted", {
    connectionId: connection.id,
    accountId: payload.account_id.trim(),
    stackId: payload.stack_id.trim(),
    trailName: payload.trail_name.trim(),
    bucketName: payload.bucket_name.trim(),
    prefix: normalizeCloudtrailPrefix(payload.prefix),
    sourceType: payload.source_type,
    schemaType: payload.schema_type,
    eventType: payload.event_type,
    cadence,
    cloudtrailSourceId: cloudtrailSource.id,
    status: nextStatus,
  });

  return {
    connection,
    cloudtrailSource,
    cadence,
    shouldScheduleValidation: false,
  };
}

async function processAcceptedAwsCallback(accepted: AwsCallbackAcceptanceResult): Promise<void> {
  const { connection, billingSource, logContext } = accepted;
  const now = new Date();

  logger.info("AWS post-callback validation started", {
    ...logContext,
    billingSourceId: billingSource.id,
  });

  try {
    await assertCloudAccountIsUnique({
      providerId: String(connection.providerId),
      cloudAccountId: logContext.accountId,
      excludeDetailRecordType: "automatic_cloud_connection",
      excludeDetailRecordId: connection.id,
    });
  } catch (error) {
    if (error instanceof DuplicateCloudConnectionError) {
      await connection.update({
        status: "failed",
        errorMessage: error.message,
        lastValidatedAt: now,
      });
      await billingSource.update({
        status: "failed",
        lastValidatedAt: now,
      });
      await syncAutomaticCloudIntegration(connection, {
        status: "failed",
        statusMessage: "Connection Failed",
        errorMessage: error.message,
        lastValidatedAt: now,
        lastCheckedAt: now,
      });
      logger.warn("AWS post-callback validation failed with duplicate cloud account", {
        ...logContext,
        billingSourceId: billingSource.id,
        reason: error.message,
      });
      return;
    }
    throw error;
  }

  try {
    const validationResult = await validateAwsConnection(connection.id);
    const validationStatus = String(validationResult.status);
    const isValidationSuccessful =
      validationStatus === "validated" || validationStatus === "active" || validationStatus === "active_with_warnings";

    if (!isValidationSuccessful) {
      await billingSource.update({
        status: "failed",
        lastValidatedAt: validationResult.lastValidatedAt,
      });
      await syncAutomaticCloudIntegration(connection, {
        status: "failed",
        statusMessage: "Connection Failed",
        errorMessage: validationResult.errorMessage,
        lastValidatedAt: validationResult.lastValidatedAt,
        lastCheckedAt: validationResult.lastValidatedAt,
      });
      logger.warn("AWS post-callback validation finished with failure", {
        ...logContext,
        billingSourceId: billingSource.id,
        validationStatus,
        error: validationResult.errorMessage,
      });
      return;
    }

    try {
      const initialBackfillSummary = await runInitialBackfillAfterValidation(connection.id);
      const isFirstFilePending = initialBackfillSummary.filesFound === 0;
      const billingStatus = isFirstFilePending ? "waiting_for_first_file" : "syncing";

      await billingSource.update({
        status: billingStatus,
        lastValidatedAt: validationResult.lastValidatedAt,
      });

      await connection.update({
        status: validationStatus === "active_with_warnings" ? "active_with_warnings" : "active",
        lastValidatedAt: validationResult.lastValidatedAt,
        errorMessage: validationResult.errorMessage,
      });

      await syncAutomaticCloudIntegration(connection, {
        status: validationResult.status,
        statusMessage:
          validationResult.status === "active_with_warnings" ? "Warnings Detected" : "Pending First Ingest",
        errorMessage: validationResult.errorMessage,
        lastValidatedAt: validationResult.lastValidatedAt,
        lastCheckedAt: validationResult.lastValidatedAt,
      });

      logger.info("AWS post-callback validation and backfill completed", {
        ...logContext,
        billingSourceId: billingSource.id,
        validationStatus: validationResult.status,
        backfill: {
          filesFound: initialBackfillSummary.filesFound,
          filesQueued: initialBackfillSummary.filesQueued,
          filesSkipped: initialBackfillSummary.filesSkipped,
        },
      });
      return;
    } catch (error) {
      const backfillError = error instanceof Error ? error.message : String(error);
      await connection.update({
        status: "active_with_warnings",
        lastValidatedAt: validationResult.lastValidatedAt,
        errorMessage: `Initial backfill failed: ${backfillError}`,
      });
      await billingSource.update({
        status: "failed",
        lastValidatedAt: validationResult.lastValidatedAt,
      });
      await syncAutomaticCloudIntegration(connection, {
        status: "active_with_warnings",
        statusMessage: "Warnings Detected",
        errorMessage: `Initial backfill failed: ${backfillError}`,
        lastValidatedAt: validationResult.lastValidatedAt,
        lastCheckedAt: validationResult.lastValidatedAt,
      });
      logger.error("AWS initial backfill failed after successful validation", {
        ...logContext,
        billingSourceId: billingSource.id,
        error: backfillError,
      });
      return;
    }
  } catch (error) {
    const validationError = error instanceof Error ? error.message : String(error);
    const failedAt = new Date();
    await connection.update({
      status: "failed",
      lastValidatedAt: failedAt,
      errorMessage: validationError,
    });
    await billingSource.update({
      status: "failed",
      lastValidatedAt: failedAt,
    });
    await syncAutomaticCloudIntegration(connection, {
      status: "failed",
      statusMessage: "Connection Failed",
      errorMessage: validationError,
      lastValidatedAt: failedAt,
      lastCheckedAt: failedAt,
    });
    logger.error("AWS post-callback validation crashed", {
      ...logContext,
      billingSourceId: billingSource.id,
      error: validationError,
    });
  }
}

function schedulePostCallbackValidation(accepted: AwsCallbackAcceptanceResult): void {
  const { connection, logContext } = accepted;

  if (!accepted.shouldScheduleValidation) {
    logger.info("AWS post-callback validation skipped (idempotent)", {
      ...logContext,
      reason: isDeleteCallbackEvent(logContext.eventType) ? "delete_event" : "already_validated_and_unchanged",
    });
    return;
  }

  if (postCallbackValidationInFlight.has(connection.id)) {
    logger.info("AWS post-callback validation already in flight", logContext);
    return;
  }

  postCallbackValidationInFlight.add(connection.id);
  setImmediate(() => {
    void processAcceptedAwsCallback(accepted).finally(() => {
      postCallbackValidationInFlight.delete(connection.id);
    });
  });
}

export async function handleCreateCloudConnection(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const tenantId = requireTenantId(req);
  const payload = parseWithSchema(createCloudConnectionSchema, req.body);

  const providerCode = payload.provider.trim().toLowerCase();
  const providerName = PROVIDER_NAME_BY_CODE[providerCode] ?? providerCode.toUpperCase();

  const existing = await CloudConnectionV2.findOne({
    where: { tenantId, connectionName: payload.connection_name.trim() },
    include: [{ model: CloudProvider }],
  });
  if (existing) {
    const existingProviderCode =
      (existing as unknown as { CloudProvider?: { code?: string } }).CloudProvider?.code?.toLowerCase() ?? null;

    if (existingProviderCode && existingProviderCode !== providerCode) {
      throw new ConflictError("Connection name already exists for a different provider");
    }

    await ensureAwsAutoSetupFields(existing);
    await syncAutomaticCloudIntegration(existing, { lastCheckedAt: new Date() });

    sendSuccess({
      res,
      req,
      statusCode: HTTP_STATUS.OK,
      message: "Cloud connection already exists",
      data: {
        id: existing.id,
        tenant_id: existing.tenantId,
        provider_id: existing.providerId,
        connection_name: existing.connectionName,
        provider: existingProviderCode ?? providerCode,
        status: existing.status,
        account_type: existing.accountType,
      },
    });
    return;
  }

  const [provider] = await CloudProvider.findOrCreate({
    where: { code: providerCode },
    defaults: { code: providerCode, name: providerName, status: "active" },
  });

  const connectionId = crypto.randomUUID();
  const externalId = `kcx-${crypto.randomUUID()}`;
  const callbackToken = crypto.randomBytes(32).toString("hex");
  const stackName = `kcx-${connectionId.substring(0, 8)}`;

  const connection = await CloudConnectionV2.create({
    id: connectionId,
    tenantId,
    providerId: provider.id,
    connectionName: payload.connection_name.trim(),
    status: "draft",
    accountType: payload.account_type,
    createdBy: userId,
    region: "us-east-1",
    externalId,
    callbackToken,
    stackName,
  });

  await syncAutomaticCloudIntegration(connection, {
    statusMessage: "Setup In Progress",
    lastCheckedAt: new Date(),
  });

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.CREATED,
    message: "Cloud connection created",
    data: {
      id: connection.id,
      tenant_id: connection.tenantId,
      provider_id: connection.providerId,
      connection_name: connection.connectionName,
      provider: provider.code,
      status: connection.status,
      account_type: connection.accountType,
      stack_name: connection.stackName,
      external_id: connection.externalId,
      callback_token: connection.callbackToken,
      region: connection.region,
      callback_url: env.awsCallbackUrl ?? null,
    },
  });
}

export async function handleGetCloudConnection(req: Request, res: Response): Promise<void> {
  requireUserId(req);
  const tenantId = requireTenantId(req);
  const id = req.params.id;
  if (typeof id !== "string" || id.trim().length === 0) throw new NotFoundError("Connection not found");

  const connection = await CloudConnectionV2.findOne({
    where: { id, tenantId },
    include: [{ model: CloudProvider }],
  });
  if (!connection) {
    throw new NotFoundError("Connection not found");
  }

  const provider = (connection as unknown as { CloudProvider?: { code?: string } }).CloudProvider ?? null;

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Cloud connection loaded",
    data: {
      id: connection.id,
      tenant_id: connection.tenantId,
      provider_id: connection.providerId,
      connection_name: connection.connectionName,
      provider: provider?.code ?? "unknown",
      status: connection.status,
      account_type: connection.accountType,
      export_name: connection.exportName ?? null,
      export_bucket: connection.exportBucket ?? null,
      export_prefix: connection.exportPrefix ?? null,
      export_region: connection.exportRegion ?? null,
      export_arn: connection.exportArn ?? null,
    },
  });
}

export async function handleGetCloudIntegrations(req: Request, res: Response): Promise<void> {
  requireUserId(req);
  const tenantId = requireTenantId(req);

  const integrations = await CloudIntegration.findAll({
    where: { tenantId },
    include: [{ model: CloudProvider, attributes: ["id", "code", "name"] }],
    order: [["updatedAt", "DESC"]],
  });

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Cloud integrations loaded",
    data: integrations.map((integration: InstanceType<typeof CloudIntegration>) => {
      const provider = (integration as unknown as { CloudProvider?: { id: string; code: string; name: string } })
        .CloudProvider;

      return {
        id: integration.id,
        tenant_id: integration.tenantId,
        created_by: integration.createdBy,
        provider_id: integration.providerId,
        provider: provider
          ? {
              id: provider.id,
              code: provider.code,
              name: provider.name,
            }
          : null,
        connection_mode: integration.connectionMode,
        display_name: integration.displayName,
        status: integration.status,
        detail_record_id: integration.detailRecordId,
        detail_record_type: integration.detailRecordType,
        cloud_account_id: integration.cloudAccountId,
        payer_account_id: integration.payerAccountId,
        last_validated_at: integration.lastValidatedAt?.toISOString() ?? null,
        last_success_at: integration.lastSuccessAt?.toISOString() ?? null,
        last_checked_at: integration.lastCheckedAt?.toISOString() ?? null,
        status_message: integration.statusMessage,
        error_message: integration.errorMessage,
        connected_at: integration.connectedAt?.toISOString() ?? null,
        created_at: integration.createdAt?.toISOString() ?? null,
        updated_at: integration.updatedAt?.toISOString() ?? null,
      };
    }),
  });
}

export async function handleGetCloudIntegrationDashboardScope(req: Request, res: Response): Promise<void> {
  requireUserId(req);
  const tenantId = requireTenantId(req);
  const id = req.params.id;

  if (typeof id !== "string" || id.trim().length === 0) {
    throw new NotFoundError("Cloud integration not found");
  }

  const integration = await CloudIntegration.findOne({
    where: { id, tenantId },
  });

  if (!integration) {
    throw new NotFoundError("Cloud integration not found");
  }

  const billingSources = await BillingSource.findAll({
    where: {
      tenantId,
      cloudConnectionId: integration.detailRecordId,
    },
    attributes: ["id"],
  });

  const billingSourceIds = billingSources
    .map((source) => Number(source.id))
    .filter((billingSourceId) => Number.isInteger(billingSourceId));
  const billingSourceIdsAsText = billingSourceIds.map((billingSourceId) => String(billingSourceId));

type UsageRangeRow = {
    usage_from: string | null;
    usage_to: string | null;
  };

  let usageFrom: string | null = null;
  let usageTo: string | null = null;
  if (billingSourceIds.length > 0) {
    const usageRangeRows = await sequelize.query<UsageRangeRow>(
      `
        SELECT
          MIN(dd.full_date) AS usage_from,
          MAX(dd.full_date) AS usage_to
        FROM fact_cost_line_items fcli
        JOIN dim_date dd ON dd.id = fcli.usage_date_key
        WHERE fcli.tenant_id = $1
          AND fcli.billing_source_id = ANY($2::bigint[]);
      `,
      {
        bind: [tenantId, billingSourceIds],
        type: QueryTypes.SELECT,
      },
    );

    usageFrom = usageRangeRows[0]?.usage_from ?? null;
    usageTo = usageRangeRows[0]?.usage_to ?? null;
  }

  let rawBillingFileIds: number[] = [];
  let latestIngestedAt: string | null = null;
  let latestIngestionRowsLoaded: number | null = null;
  if (billingSourceIdsAsText.length > 0) {
    const completedIngestionRuns = await BillingIngestionRun.findAll({
      where: {
        billingSourceId: {
          [Op.in]: billingSourceIdsAsText,
        },
        status: {
          [Op.in]: ["completed", "completed_with_warnings"],
        },
      },
      attributes: ["id"],
      order: [["updatedAt", "DESC"]],
    });

    const completedIngestionRunIds = completedIngestionRuns
      .map((run) => Number(run.id))
      .filter((ingestionRunId) => Number.isInteger(ingestionRunId));

    if (completedIngestionRunIds.length > 0) {
      const latestCompletedRun = completedIngestionRuns[0];
      if (latestCompletedRun) {
        latestIngestedAt =
          latestCompletedRun.finishedAt?.toISOString() ??
          latestCompletedRun.updatedAt?.toISOString() ??
          null;
        latestIngestionRowsLoaded =
          Number.isFinite(Number(latestCompletedRun.rowsLoaded)) ? Number(latestCompletedRun.rowsLoaded) : null;
      }

      const runFiles = await BillingIngestionRunFile.findAll({
        where: {
          ingestionRunId: {
            [Op.in]: completedIngestionRunIds,
          },
          fileRole: "data",
        },
        attributes: ["rawBillingFileId"],
        order: [["createdAt", "DESC"]],
      });

      rawBillingFileIds = [
        ...new Set(
          runFiles
            .map((runFile) => Number(runFile.rawBillingFileId))
            .filter((rawBillingFileId) => Number.isInteger(rawBillingFileId)),
        ),
      ];
    }
  }

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Cloud integration dashboard scope loaded",
    data: {
      cloud_integration_id: integration.id,
      display_name: integration.displayName,
      tenant_id: integration.tenantId,
      cloud_account_id: integration.cloudAccountId,
      detail_record_id: integration.detailRecordId,
      detail_record_type: integration.detailRecordType,
      billing_source_ids: billingSourceIds,
      billing_sources_count: billingSourceIds.length,
      usage_from: usageFrom,
      usage_to: usageTo,
      raw_billing_file_ids: rawBillingFileIds,
      ingested_files_count: rawBillingFileIds.length,
      latest_ingested_at: latestIngestedAt,
      latest_ingestion_rows_loaded: latestIngestionRowsLoaded,
    },
  });
}

export async function handleGetAwsCloudFormationSetupUrl(req: Request, res: Response): Promise<void> {
  requireUserId(req);
  const tenantId = requireTenantId(req);
  const id = req.params.id;
  if (typeof id !== "string" || id.trim().length === 0) throw new NotFoundError("Connection not found");

  const connection = await CloudConnectionV2.findOne({ where: { id, tenantId } });
  if (!connection) throw new NotFoundError("Connection not found");

  const ensured = await ensureAwsAutoSetupFields(connection);

  let postPayload: GenerateAwsCloudFormationSetupPayload | null = null;
  if (req.method.toUpperCase() === "POST") {
    postPayload = parseWithSchema(generateAwsCloudFormationSetupSchema, req.body);
  }

  const stackName = normalizeOptional(postPayload?.stackName) ?? ensured.stackName ?? undefined;
  const externalId = ensured.externalId ?? undefined;
  const callbackToken = ensured.callbackToken ?? undefined;
  const connectionName = connection.connectionName ?? undefined;
  const region = normalizeOptional(postPayload?.region) ?? ensured.region ?? undefined;

  const enableBillingExport = true;
  const enableCloudTrail = postPayload?.enableCloudTrail ?? false;
  const enableEC2Module = postPayload?.enableEC2Module ?? true;
  const enableCloudWatchModule = postPayload?.enableCloudWatchModule ?? true;
  const enableActionRole =
    enableEC2Module || enableCloudWatchModule ? true : (postPayload?.enableActionRole ?? false);
  const useTagScopedAccess = postPayload?.useTagScopedAccess ?? false;

  const exportPrefix = normalizeOptional(postPayload?.exportPrefix) ?? DEFAULT_AWS_EXPORT_PREFIX;
  const exportName = normalizeOptional(postPayload?.exportName) ?? buildDefaultAwsExportName(connection.id);
  const callbackUrl = env.awsCallbackUrl ?? undefined;
  const fileEventCallbackUrl =
    normalizeOptional(postPayload?.fileEventCallbackUrl) ?? env.awsFileEventCallbackUrl ?? undefined;
  const cloudTrailPrefix = normalizeOptional(postPayload?.cloudTrailPrefix) ?? DEFAULT_AWS_CLOUDTRAIL_PREFIX;
  const cloudTrailName = normalizeOptional(postPayload?.cloudTrailName) ?? buildDefaultAwsCloudTrailName(connection.id);
  const resourceTagKey = useTagScopedAccess ? normalizeOptional(postPayload?.resourceTagKey) : undefined;
  const resourceTagValue = useTagScopedAccess ? normalizeOptional(postPayload?.resourceTagValue) : undefined;

  if (!stackName || !externalId || !callbackToken || !connectionName || !region) {
    throw new NotFoundError("CloudFormation setup is not available for this connection");
  }
  if ((enableBillingExport || enableCloudTrail) && !fileEventCallbackUrl) {
    throw new InternalServerError(
      "AWS CloudFormation setup is temporarily unavailable because callback configuration is missing",
    );
  }

  const patch: Partial<{
    stackName: string;
    externalId: string;
    callbackToken: string;
    region: string;
    accountType: "payer" | "member";
    exportPrefix: string;
    exportName: string;
  }> = {};

  if (ensured.stackName !== stackName) patch.stackName = stackName;
  if (ensured.externalId !== externalId) patch.externalId = externalId;
  if (ensured.callbackToken !== callbackToken) patch.callbackToken = callbackToken;
  if (ensured.region !== region) patch.region = region;
  if (normalizeOptional(connection.exportPrefix ?? undefined) !== exportPrefix) patch.exportPrefix = exportPrefix;
  if (normalizeOptional(connection.exportName ?? undefined) !== exportName) patch.exportName = exportName;
  if (postPayload?.accountType && connection.accountType !== postPayload.accountType) {
    patch.accountType = postPayload.accountType;
  }

  if (Object.keys(patch).length > 0) {
    await connection.update(patch);
  }

  const url = buildAwsCloudFormationCreateStackUrl({
    stackName,
    externalId,
    connectionName,
    region,
    fileEventCallbackUrl,
    exportPrefix,
    exportName,
    callbackUrl,
    callbackToken,
    enableBillingExport,
    enableCloudTrail,
    cloudTrailPrefix,
    cloudTrailName,
    enableActionRole,
    enableEC2Module,
    enableCloudWatchModule,
    useTagScopedAccess,
    resourceTagKey,
    resourceTagValue,
  });

  if (connection.status === "draft") {
    await connection.update({ status: "connecting", errorMessage: null });
    await syncAutomaticCloudIntegration(connection, {
      statusMessage: "Connecting",
      errorMessage: null,
      lastCheckedAt: new Date(),
    });
  }

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "AWS CloudFormation setup URL generated",
    data: { url },
  });
}

export async function handleAwsConnectionCallback(req: Request, res: Response): Promise<void> {
  const payload = parseWithSchema(awsConnectionCallbackSchema, req.body);
  const connection = await findConnectionByCallbackToken(payload.callback_token);

  if (payload.source_type === "aws_cloudtrail") {
    const cadence = normalizeCloudTrailCadence(payload.cadence);

    logger.info("AWS CloudTrail setup callback received", {
      connectionId: connection.id,
      stackId: payload.stack_id.trim(),
      accountId: payload.account_id.trim(),
      trailName: payload.trail_name.trim(),
      bucketName: payload.bucket_name.trim(),
      prefix: normalizeCloudtrailPrefix(payload.prefix),
      eventType: payload.event_type,
      sourceType: payload.source_type,
      schemaType: payload.schema_type,
      cadence,
    });

    // Explicit routing: aws_cloudtrail setup callbacks use CloudTrail source upsert flow.
    const accepted = await acceptAwsCloudTrailCallback({
      connection,
      payload,
      cadence,
    });

    sendSuccess({
      res,
      req,
      statusCode: HTTP_STATUS.OK,
      message: "AWS callback accepted",
      data: {
        id: accepted.connection.id,
        status: accepted.connection.status,
        accepted: true,
        source_type: payload.source_type,
        schema_type: payload.schema_type,
        event_type: payload.event_type,
        cadence: accepted.cadence,
        stack_id: payload.stack_id.trim(),
        trail_name: payload.trail_name.trim(),
        bucket_name: payload.bucket_name.trim(),
        bucket_region: payload.bucket_region.trim(),
        prefix: normalizeCloudtrailPrefix(payload.prefix),
        cloudtrail_source_id: accepted.cloudtrailSource.id,
        error_message: accepted.connection.errorMessage ?? null,
        async_validation_scheduled: false,
      },
    });
    return;
  }

  const cadence = normalizeCadence(payload.cadence);

  logger.info("AWS setup callback received", {
    connectionId: connection.id,
    stackId: payload.stack_id.trim(),
    accountId: payload.account_id.trim(),
    billingRoleArn: String(payload.billing_role_arn ?? "").trim(),
    actionRoleArn: payload.action_role_arn?.trim() ?? null,
    exportName: payload.export_name.trim(),
    eventType: payload.event_type,
    sourceType: payload.source_type,
    schemaType: payload.schema_type,
    cadence,
  });

  // Explicit routing: aws_data_exports_cur2 setup callbacks use existing billing setup flow.
  const accepted = isDeleteCallbackEvent(payload.event_type)
    ? await handleAwsDeleteCallback({
        connection,
        payload,
        cadence,
      })
    : await acceptAwsCallback({
        connection,
        payload,
        cadence,
      });
  const isDeleteEvent = isDeleteCallbackEvent(payload.event_type);
  const computeOptimizerResult = isDeleteEvent
    ? { enabled: false, error: null }
    : await enableComputeOptimizerBestEffort({ connection, payload });

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "AWS callback accepted",
    data: {
      id: accepted.connection.id,
      status: accepted.connection.status,
      accepted: true,
      source_type: payload.source_type,
      schema_type: payload.schema_type,
      event_type: payload.event_type,
      cadence: accepted.cadence,
      stack_id: payload.stack_id.trim(),
      export_name: payload.export_name.trim(),
      export_bucket: payload.export_bucket.trim(),
      export_prefix: payload.export_prefix.trim(),
      format: payload.format,
      error_message: accepted.connection.errorMessage ?? null,
      async_validation_scheduled: accepted.shouldScheduleValidation,
      compute_optimizer_enabled: computeOptimizerResult.enabled,
      compute_optimizer_error: computeOptimizerResult.error,
    },
  });

  schedulePostCallbackValidation(accepted);
}

export async function handleValidateCloudConnection(req: Request, res: Response): Promise<void> {
  requireUserId(req);
  const tenantId = requireTenantId(req);
  const id = req.params.id;
  if (typeof id !== "string" || id.trim().length === 0) throw new NotFoundError("Connection not found");

  const connection = await CloudConnectionV2.findOne({ where: { id, tenantId } });
  if (!connection) throw new NotFoundError("Connection not found");

  const result = await validateAwsConnection(connection.id);
  const billingSources = await BillingSource.findAll({
    where: {
      tenantId,
      cloudConnectionId: connection.id,
      sourceType: "aws_data_exports_cur2",
    },
  });

  for (const billingSource of billingSources) {
    const nextStatus = resolveBillingSourceStatusAfterValidation(
      result.status,
      billingSource.status,
      billingSource.lastFileReceivedAt ?? null,
    );
    await billingSource.update({
      status: nextStatus,
      lastValidatedAt: result.lastValidatedAt,
    });
  }

  await syncAutomaticCloudIntegration(connection, {
    status: result.status,
    statusMessage:
      result.status === "active"
        ? "Pending First Ingest"
        : result.status === "active_with_warnings"
          ? "Warnings Detected"
          : "Connection Failed",
    errorMessage: result.errorMessage,
    lastValidatedAt: result.lastValidatedAt,
    lastCheckedAt: result.lastValidatedAt,
  });

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Cloud connection validated",
    data: {
      id: result.connectionId,
      status: result.status,
      last_validated_at: result.lastValidatedAt.toISOString(),
      error_message: result.errorMessage,
    },
  });
}
