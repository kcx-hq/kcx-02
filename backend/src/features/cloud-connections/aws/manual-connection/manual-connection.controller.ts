import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../../../constants/http-status.js";
import { UnauthorizedError } from "../../../../errors/http-errors.js";
import { sendError, sendSuccess } from "../../../../utils/api-response.js";
import { parseWithSchema } from "../../../_shared/validation/zod-validate.js";
import {
  browseManualBucketSchema,
  createManualConnectionSchema,
} from "./manual-connection.schema.js";
import {
  browseManualConnectionBucket,
  createManualConnection,
} from "./manual-connection.service.js";
import { ManualConnectionAwsError } from "./aws-assume-role.util.js";

const requireUserContext = (req: Request) => {
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

export async function handleCreateManualConnection(req: Request, res: Response): Promise<void> {
  const userContext = requireUserContext(req);
  const payload = parseWithSchema(createManualConnectionSchema, req.body);
  const result = await createManualConnection(payload, userContext);

  if (!result.success) {
    sendError({
      res,
      req,
      statusCode: result.statusCode,
      message: result.message,
      error: {
        code: result.errorCode,
      },
    });
    return;
  }

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.CREATED,
    message: "Manual AWS connection created",
    data: result,
  });
}

export async function handleBrowseManualBucket(req: Request, res: Response): Promise<void> {
  const payload = parseWithSchema(browseManualBucketSchema, req.body);

  try {
    const result = await browseManualConnectionBucket(payload);
    sendSuccess({
      res,
      req,
      statusCode: HTTP_STATUS.OK,
      message: "Manual AWS bucket browse succeeded",
      data: result,
    });
  } catch (error) {
    if (error instanceof ManualConnectionAwsError) {
      sendError({
        res,
        req,
        statusCode: error.statusCode,
        message: error.message,
        error: {
          code: error.errorCode,
        },
      });
      return;
    }

    sendError({
      res,
      req,
      statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      message: "Unable to browse S3 bucket.",
      error: {
        code: "S3_BROWSE_FAILED",
      },
    });
  }
}
