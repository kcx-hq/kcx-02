import type { Request, Response } from "express";
import crypto from "node:crypto";

import env from "../../../../config/env.js";
import { HTTP_STATUS } from "../../../../constants/http-status.js";
import { ConflictError, NotFoundError, UnauthorizedError } from "../../../../errors/http-errors.js";
import { BillingSource, CloudConnectionV2, CloudProvider } from "../../../../models/index.js";
import { sendSuccess } from "../../../../utils/api-response.js";
import { parseWithSchema } from "../../../_shared/validation/zod-validate.js";
import {
  buildAwsCloudFormationCreateStackUrl,
  KCX_AWS_CLOUDFORMATION_TEMPLATE_URL,
} from "./aws-cloudformation-url.js";
import { runInitialBackfillAfterValidation } from "../exports/aws-export-ingestion.service.js";
import { validateAwsConnection } from "./aws-connection-validation.service.js";
import { awsConnectionCallbackSchema, createCloudConnectionSchema } from "./cloud-connections.schema.js";

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
const buildDefaultAwsExportName = (connectionId: string) => `KCX-CUR2-${connectionId.replace(/-/g, "").slice(0, 10)}`;
type CloudConnectionV2Instance = InstanceType<typeof CloudConnectionV2>;

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

export async function handleGetAwsCloudFormationSetupUrl(req: Request, res: Response): Promise<void> {
  requireUserId(req);
  const tenantId = requireTenantId(req);
  const id = req.params.id;
  if (typeof id !== "string" || id.trim().length === 0) throw new NotFoundError("Connection not found");

  const connection = await CloudConnectionV2.findOne({ where: { id, tenantId } });
  if (!connection) throw new NotFoundError("Connection not found");

  const ensured = await ensureAwsAutoSetupFields(connection);
  const stackName = ensured.stackName;
  const externalId = ensured.externalId;
  const callbackToken = ensured.callbackToken;
  const connectionName = connection.connectionName;
  const region = ensured.region;

  if (!stackName || !externalId || !callbackToken || !connectionName || !region) {
    throw new NotFoundError("CloudFormation setup is not available for this connection");
  }

  const url = buildAwsCloudFormationCreateStackUrl({
    templateUrl: KCX_AWS_CLOUDFORMATION_TEMPLATE_URL,
    stackName,
    externalId,
    connectionName,
    region,
    exportPrefix: DEFAULT_AWS_EXPORT_PREFIX,
    exportName: buildDefaultAwsExportName(connection.id),
    callbackUrl: env.awsCallbackUrl,
    callbackToken,
  });

  if (connection.status === "draft") {
    await connection.update({ status: "connecting", errorMessage: null });
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

  const connection = await CloudConnectionV2.findOne({
    where: { callbackToken: payload.callback_token.trim() },
  });

  if (!connection) {
    throw new NotFoundError("Invalid callback token");
  }

  const now = new Date();

  await connection.update({
    cloudAccountId: payload.account_id.trim(),
    roleArn: payload.role_arn.trim(),
    stackId: payload.stack_id.trim(),
    exportName: payload.export_name.trim(),
    exportBucket: payload.export_bucket.trim(),
    exportPrefix: payload.export_prefix.trim(),
    exportRegion: payload.export_region.trim(),
    exportArn: payload.export_arn.trim(),
    status: "awaiting_validation",
    connectedAt: now,
    errorMessage: null,
  });

  const existingBillingSource = await BillingSource.findOne({
    where: {
      tenantId: connection.tenantId,
      cloudConnectionId: connection.id,
      sourceType: payload.source_type,
    },
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
    cadence: "daily",
    status: "awaiting_validation",
  };

  const billingSource = existingBillingSource
    ? await existingBillingSource.update(billingSourcePayload)
    : await BillingSource.create(billingSourcePayload);

  const validationResult = await validateAwsConnection(connection.id);
  const validationStatus = String(validationResult.status);
  const isValidationSuccessful =
    validationStatus === "validated" || validationStatus === "active" || validationStatus === "active_with_warnings";

  let initialBackfillSummary: { filesFound: number; filesQueued: number; filesSkipped: number } | null = null;
  let callbackStatus: string = validationStatus;

  if (isValidationSuccessful) {
    initialBackfillSummary = await runInitialBackfillAfterValidation(connection.id);

    const isFirstFilePending = initialBackfillSummary.filesFound === 0;
    const nextBillingSourceStatus = isFirstFilePending ? "waiting_for_first_file" : "syncing";
    const nextBillingSourceStatusMessage = isFirstFilePending
      ? "Waiting for first export file from AWS"
      : "Initial backfill queued";

    const billingSourcePatch: Record<string, unknown> = {
      status: nextBillingSourceStatus,
      lastValidatedAt: validationResult.lastValidatedAt,
    };

    if ("statusMessage" in BillingSource.getAttributes()) {
      billingSourcePatch.statusMessage = nextBillingSourceStatusMessage;
    }

    await billingSource.update(billingSourcePatch);

    await connection.update({
      status: "active",
      lastValidatedAt: validationResult.lastValidatedAt,
      errorMessage: validationResult.errorMessage,
    });

    callbackStatus = nextBillingSourceStatus;
  } else {
    await connection.update({
      status: "failed",
      lastValidatedAt: validationResult.lastValidatedAt,
      errorMessage: validationResult.errorMessage,
    });

    await billingSource.update({
      status: "failed",
      lastValidatedAt: validationResult.lastValidatedAt,
    });

    callbackStatus = "failed";
  }

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "AWS callback processed",
    data: {
      id: connection.id,
      status: callbackStatus,
      stack_id: payload.stack_id.trim(),
      export_name: payload.export_name.trim(),
      export_bucket: payload.export_bucket.trim(),
      export_prefix: payload.export_prefix.trim(),
      format: payload.format,
      error_message: validationResult.errorMessage,
      initial_backfill: initialBackfillSummary
        ? {
            files_found: initialBackfillSummary.filesFound,
            files_queued: initialBackfillSummary.filesQueued,
            files_skipped: initialBackfillSummary.filesSkipped,
          }
        : null,
    },
  });
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
