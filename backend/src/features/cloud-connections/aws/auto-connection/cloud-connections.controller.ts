import type { Request, Response } from "express";
import crypto from "node:crypto";

import env from "../../../../config/env.js";
import { HTTP_STATUS } from "../../../../constants/http-status.js";
import {
  ConflictError,
  DuplicateCloudConnectionError,
  NotFoundError,
  UnauthorizedError,
} from "../../../../errors/http-errors.js";
import { BillingSource, CloudConnectionV2, CloudIntegration, CloudProvider } from "../../../../models/index.js";
import { sendSuccess } from "../../../../utils/api-response.js";
import { parseWithSchema } from "../../../_shared/validation/zod-validate.js";
import {
  assertCloudAccountIsUnique,
  syncAutomaticCloudIntegration,
} from "../../cloud-integration-registry.service.js";
import {
  buildAwsCloudFormationCreateStackUrl,
  KCX_AWS_CLOUDFORMATION_TEMPLATE_URL,
} from "./aws-cloudformation-url.js";
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

  const connection = await CloudConnectionV2.findOne({
    where: { callbackToken: payload.callback_token.trim() },
  });

  if (!connection) {
    throw new NotFoundError("Invalid callback token");
  }

  const now = new Date();
  const normalizedAccountId = payload.account_id.trim();
  try {
    await assertCloudAccountIsUnique({
      providerId: String(connection.providerId),
      cloudAccountId: normalizedAccountId,
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
      await syncAutomaticCloudIntegration(connection, {
        status: "failed",
        statusMessage: "Connection Failed",
        errorMessage: error.message,
        lastValidatedAt: now,
        lastCheckedAt: now,
      });
    }
    throw error;
  }

  await connection.update({
    cloudAccountId: normalizedAccountId,
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

  await syncAutomaticCloudIntegration(connection, {
    statusMessage: "Awaiting Validation",
    errorMessage: null,
    lastCheckedAt: now,
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
  const nextBillingSourceStatus = resolveBillingSourceStatusAfterValidation(
    validationResult.status,
    billingSource.status,
    billingSource.lastFileReceivedAt ?? null,
  );

  await billingSource.update({
    status: nextBillingSourceStatus,
    lastValidatedAt: validationResult.lastValidatedAt,
  });

  await syncAutomaticCloudIntegration(connection, {
    status: validationResult.status,
    statusMessage:
      validationResult.status === "active"
        ? "Pending First Ingest"
        : validationResult.status === "active_with_warnings"
          ? "Warnings Detected"
          : "Connection Failed",
    errorMessage: validationResult.errorMessage,
    lastValidatedAt: validationResult.lastValidatedAt,
    lastCheckedAt: validationResult.lastValidatedAt,
  });

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "AWS callback processed",
    data: {
      id: connection.id,
      status: validationResult.status,
      stack_id: payload.stack_id.trim(),
      export_name: payload.export_name.trim(),
      export_bucket: payload.export_bucket.trim(),
      export_prefix: payload.export_prefix.trim(),
      format: payload.format,
      error_message: validationResult.errorMessage,
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
