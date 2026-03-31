import type { Request, Response } from "express";
import { HTTP_STATUS } from "../../constants/http-status.js";
import { AppError } from "../../errors/app-error.js";
import { InternalServerError, UnauthorizedError } from "../../errors/http-errors.js";
import { sendSuccess } from "../../utils/api-response.js";
import { createOrUpdateAwsManualConnectionStep1 } from "./cloud-connections.service.js";
import { parseAwsManualStep1Body } from "./cloud-connections.validator.js";

export async function handleCreateOrUpdateAwsManualStep1(req: Request, res: Response): Promise<void> {
  try {
    const payload = parseAwsManualStep1Body(req.body);
    const clientId = req.auth?.user.id;

    if (!clientId) {
      throw new UnauthorizedError("Missing clientId in authenticated context");
    }

    const result = await createOrUpdateAwsManualConnectionStep1(clientId, payload);

    sendSuccess({
      res,
      req,
      statusCode: HTTP_STATUS.OK,
      message: "AWS manual setup step 1 saved",
      data: result,
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new InternalServerError("Failed to save AWS manual setup step 1");
  }
}
