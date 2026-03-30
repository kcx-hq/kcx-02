import type { Request, Response } from "express";
import crypto from "node:crypto";

import { HTTP_STATUS } from "../../constants/http-status.js";
import { ConflictError, NotFoundError, UnauthorizedError } from "../../errors/http-errors.js";
import { CloudConnectionV2, CloudProvider } from "../../models/index.js";
import { sendSuccess } from "../../utils/api-response.js";
import { parseWithSchema } from "../_shared/validation/zod-validate.js";
import { createCloudConnectionSchema } from "./cloud-connections.schema.js";

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

  const [provider] = await CloudProvider.findOrCreate({
    where: { code: providerCode },
    defaults: { code: providerCode, name: providerName, status: "active" },
  });

  const existing = await CloudConnectionV2.findOne({
    where: { tenantId, connectionName: payload.connection_name.trim() },
  });
  if (existing) {
    throw new ConflictError("Cloud connection already exists with this name");
  }

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
