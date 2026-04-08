import type { Request, Response } from "express";
import crypto from "node:crypto";
import { Op, type Transaction } from "sequelize";

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
  sequelize,
} from "../../../../models/index.js";
import { sendSuccess } from "../../../../utils/api-response.js";
import { logger } from "../../../../utils/logger.js";
import { parseWithSchema } from "../../../_shared/validation/zod-validate.js";
import {
  assertCloudAccountIsUnique,
  syncAutomaticCloudIntegration,
} from "../../cloud-integration-registry.service.js";
import {
  buildAwsCloudFormationCreateStackUrl,
} from "./aws-cloudformation-url.js";
import { runInitialBackfillAfterValidation } from "../exports/aws-export-ingestion.service.js";
import { validateAwsConnection } from "./aws-connection-validation.service.js";
import {
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
const DEFAULT_AWS_CALLBACK_CADENCE = "hourly";
const AWS_CALLBACK_DELETE_EVENT_TYPE = "stack_delete";
const buildDefaultAwsExportName = (connectionId: string) => `KCX-CUR2-${connectionId.replace(/-/g, "").slice(0, 10)}`;
type CloudConnectionV2Instance = InstanceType<typeof CloudConnectionV2>;
type BillingSourceInstance = InstanceType<typeof BillingSource>;

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

const isDeleteCallbackEvent = (eventType: string): boolean =>
  eventType.trim().toLowerCase() === AWS_CALLBACK_DELETE_EVENT_TYPE;

const hasConnectionCoreChanges = (
  connection: CloudConnectionV2Instance,
  payload: AwsConnectionCallbackPayload,
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
  payload: AwsConnectionCallbackPayload;
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

async function handleAwsDeleteCallback(input: {
  connection: CloudConnectionV2Instance;
  payload: AwsConnectionCallbackPayload;
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
  payload: AwsConnectionCallbackPayload;
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

  const billingSourceIds = billingSources.map((source) => String(source.id));

  let rawBillingFileIds: number[] = [];
  if (billingSourceIds.length > 0) {
    const completedIngestionRuns = await BillingIngestionRun.findAll({
      where: {
        billingSourceId: {
          [Op.in]: billingSourceIds,
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
      cloud_account_id: integration.cloudAccountId,
      detail_record_id: integration.detailRecordId,
      detail_record_type: integration.detailRecordType,
      raw_billing_file_ids: rawBillingFileIds,
      ingested_files_count: rawBillingFileIds.length,
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
  const externalId = normalizeOptional(postPayload?.externalId) ?? ensured.externalId ?? undefined;
  const callbackToken = normalizeOptional(postPayload?.callbackToken) ?? ensured.callbackToken ?? undefined;
  const connectionName = normalizeOptional(postPayload?.connectionName) ?? connection.connectionName ?? undefined;
  const region = normalizeOptional(postPayload?.region) ?? ensured.region ?? undefined;

  const enableBillingExport = postPayload?.enableBillingExport ?? true;
  const enableActionRole = postPayload?.enableActionRole ?? true;
  const enableEC2Module = enableActionRole ? (postPayload?.enableEC2Module ?? true) : false;
  const useTagScopedAccess = postPayload?.useTagScopedAccess ?? false;

  const exportPrefix = normalizeOptional(postPayload?.exportPrefix) ?? DEFAULT_AWS_EXPORT_PREFIX;
  const exportName = normalizeOptional(postPayload?.exportName) ?? buildDefaultAwsExportName(connection.id);
  const callbackUrl = normalizeOptional(postPayload?.callbackUrl) ?? env.awsCallbackUrl ?? undefined;
  const fileEventCallbackUrl = env.awsFileEventCallbackUrl;
  const resourceTagKey = useTagScopedAccess ? normalizeOptional(postPayload?.resourceTagKey) : undefined;
  const resourceTagValue = useTagScopedAccess ? normalizeOptional(postPayload?.resourceTagValue) : undefined;

  if (!stackName || !externalId || !callbackToken || !connectionName || !region) {
    throw new NotFoundError("CloudFormation setup is not available for this connection");
  }
  if (!fileEventCallbackUrl) {
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
    enableActionRole,
    enableEC2Module,
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
  const cadence = normalizeCadence(payload.cadence);

  logger.info("AWS setup callback received", {
    connectionId: connection.id,
    stackId: payload.stack_id.trim(),
    accountId: payload.account_id.trim(),
    billingRoleArn: String(payload.billing_role_arn ?? "").trim(),
    actionRoleArn: payload.action_role_arn?.trim() ?? null,
    exportName: payload.export_name.trim(),
    eventType: payload.event_type,
    cadence,
  });

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

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "AWS callback accepted",
    data: {
      id: accepted.connection.id,
      status: accepted.connection.status,
      accepted: true,
      event_type: payload.event_type,
      cadence: accepted.cadence,
      stack_id: payload.stack_id.trim(),
      export_name: payload.export_name.trim(),
      export_bucket: payload.export_bucket.trim(),
      export_prefix: payload.export_prefix.trim(),
      format: payload.format,
      error_message: accepted.connection.errorMessage ?? null,
      async_validation_scheduled: accepted.shouldScheduleValidation,
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
