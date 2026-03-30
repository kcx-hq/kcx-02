import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../constants/http-status.js";
import { ConflictError, NotFoundError, UnauthorizedError } from "../../errors/http-errors.js";
import { CloudConnection } from "../../models/index.js";
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

export async function handleCreateCloudConnection(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const payload = parseWithSchema(createCloudConnectionSchema, req.body);

  const existing = await CloudConnection.findOne({ where: { userId } });
  if (existing) {
    throw new ConflictError("Cloud connection already exists for this user");
  }

  const connection = await CloudConnection.create({
    userId,
    connectionName: payload.connection_name.trim(),
    provider: payload.provider,
    status: payload.status,
    accountType: payload.account_type,
  });

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.CREATED,
    message: "Cloud connection created",
    data: {
      id: connection.id,
      user_id: connection.userId,
      connection_name: connection.connectionName,
      provider: connection.provider,
      status: connection.status,
      account_type: connection.accountType,
    },
  });
}

export async function handleGetCloudConnection(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    throw new NotFoundError("Connection not found");
  }

  const connection = await CloudConnection.findOne({ where: { id, userId } });
  if (!connection) {
    throw new NotFoundError("Connection not found");
  }

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Cloud connection loaded",
    data: {
      id: connection.id,
      user_id: connection.userId,
      connection_name: connection.connectionName,
      provider: connection.provider,
      status: connection.status,
      account_type: connection.accountType,
    },
  });
}
