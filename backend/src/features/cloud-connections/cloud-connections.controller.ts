import type { Request, Response } from "express";
import crypto from "node:crypto";

import env from "../../config/env.js";
import { HTTP_STATUS } from "../../constants/http-status.js";
import { ConflictError, NotFoundError, UnauthorizedError } from "../../errors/http-errors.js";
import { CloudConnectionV2, CloudProvider } from "../../models/index.js";
import { sendSuccess } from "../../utils/api-response.js";
import { parseWithSchema } from "../_shared/validation/zod-validate.js";
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

  const stackName = connection.stackName;
  const externalId = connection.externalId;
  const callbackToken = connection.callbackToken;
  const connectionName = connection.connectionName;
  const region = connection.region;

  if (!stackName || !externalId || !callbackToken || !connectionName || !region) {
    throw new NotFoundError("CloudFormation setup is not available for this connection");
  }

  const url = buildAwsCloudFormationCreateStackUrl({
    templateUrl: KCX_AWS_CLOUDFORMATION_TEMPLATE_URL,
    stackName,
    externalId,
    connectionName,
    region,
    callbackUrl: env.awsCallbackUrl,
    callbackToken,
  });

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
    status: "awaiting_validation",
    connectedAt: now,
    errorMessage: null,
  });

  const validationResult = await validateAwsConnection(connection.id);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "AWS callback processed",
    data: {
      id: connection.id,
      status: validationResult.status,
      stack_id: payload.stack_id.trim(),
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
