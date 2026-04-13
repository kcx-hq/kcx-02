import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../../constants/http-status.js";
import { UnauthorizedError } from "../../../errors/http-errors.js";
import { sendSuccess } from "../../../utils/api-response.js";
import { parseWithSchema } from "../../_shared/validation/zod-validate.js";
import {
  createS3UploadConnectionSchema,
  createS3UploadConnectionSessionSchema,
  createS3UploadSessionSchema,
  importS3UploadFilesSchema,
  listS3UploadSessionSchema,
} from "./s3-upload.schema.js";
import {
  createPersistentS3UploadConnection,
  createTemporaryS3UploadSessionFromConnection,
  createTemporaryS3UploadSession,
  importFilesFromTemporaryS3UploadSession,
  listPersistentS3UploadConnections,
  listTemporaryS3UploadSessionScope,
} from "./s3-upload.service.js";

const requireUserContext = (req: Request): { tenantId: string; userId: string } => {
  const userId = req.auth?.user.id;
  const tenantId = req.auth?.user.tenantId;

  if (!userId || typeof userId !== "string") {
    throw new UnauthorizedError("User authentication required");
  }

  if (!tenantId || typeof tenantId !== "string") {
    throw new UnauthorizedError("Tenant context required");
  }

  return { userId, tenantId };
};

export async function handleCreateS3UploadSession(req: Request, res: Response): Promise<void> {
  const user = requireUserContext(req);
  const payload = parseWithSchema(createS3UploadSessionSchema, req.body);

  const result = await createTemporaryS3UploadSession(payload, user);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.CREATED,
    message: "Temporary S3 upload session created",
    data: result,
  });
}

export async function handleCreatePersistentS3UploadConnection(req: Request, res: Response): Promise<void> {
  const user = requireUserContext(req);
  const payload = parseWithSchema(createS3UploadConnectionSchema, req.body);

  const result = await createPersistentS3UploadConnection(payload, user);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.CREATED,
    message: "S3 connection saved",
    data: result,
  });
}

export async function handleListPersistentS3UploadConnections(req: Request, res: Response): Promise<void> {
  const user = requireUserContext(req);
  const result = await listPersistentS3UploadConnections(user);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "S3 connections loaded",
    data: result,
  });
}

export async function handleCreateS3UploadSessionFromConnection(req: Request, res: Response): Promise<void> {
  const user = requireUserContext(req);
  const connectionId = String(req.params.connectionId ?? "").trim();
  const payload = parseWithSchema(createS3UploadConnectionSessionSchema, req.body ?? {});

  const result = await createTemporaryS3UploadSessionFromConnection(connectionId, payload, user);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.CREATED,
    message: "Temporary S3 upload session created from saved connection",
    data: result,
  });
}

export async function handleListS3UploadSessionScope(req: Request, res: Response): Promise<void> {
  const user = requireUserContext(req);
  const sessionId = String(req.params.sessionId ?? "").trim();
  const query = parseWithSchema(listS3UploadSessionSchema, req.query);

  const result = await listTemporaryS3UploadSessionScope(sessionId, query, user);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "S3 upload explorer listing loaded",
    data: result,
  });
}

export async function handleImportFromS3UploadSession(req: Request, res: Response): Promise<void> {
  const user = requireUserContext(req);
  const sessionId = String(req.params.sessionId ?? "").trim();
  const payload = parseWithSchema(importS3UploadFilesSchema, req.body);

  const result = await importFilesFromTemporaryS3UploadSession(sessionId, payload, user);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.CREATED,
    message: "S3 files queued for ingestion",
    data: result,
  });
}
