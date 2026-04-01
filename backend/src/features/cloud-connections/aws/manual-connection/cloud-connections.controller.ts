import type { Request, Response } from "express";
import { HTTP_STATUS } from "../../../../constants/http-status.js";
import { AppError } from "../../../../errors/app-error.js";
import { InternalServerError, UnauthorizedError } from "../../../../errors/http-errors.js";
import { sendSuccess } from "../../../../utils/api-response.js";
import {
  createOrUpdateAwsManualConnectionStep1,
  createOrUpdateAwsManualConnectionStep2,
  createOrUpdateAwsManualConnectionStep3,
  validateAwsManualConnection,
} from "./cloud-connections.service.js";
import {
  parseAwsManualStep1Body,
  parseAwsManualStep2Body,
  parseAwsManualStep3Body,
  parseAwsManualValidateBody,
} from "./cloud-connections.validator.js";

export async function handleCreateOrUpdateAwsManualStep1(req: Request, res: Response): Promise<void> {
  try {
    const payload = parseAwsManualStep1Body(req.body);
    const userId = req.auth?.user.id;

    if (!userId) {
      throw new UnauthorizedError("Missing userId in authenticated context");
    }

    const result = await createOrUpdateAwsManualConnectionStep1(String(userId), payload);

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

export async function handleCreateOrUpdateAwsManualStep2(req: Request, res: Response): Promise<void> {
  try {
    const payload = parseAwsManualStep2Body(req.body);
    const userId = req.auth?.user.id;

    if (!userId) {
      throw new UnauthorizedError("Missing userId in authenticated context");
    }

    const result = await createOrUpdateAwsManualConnectionStep2(String(userId), payload);

    sendSuccess({
      res,
      req,
      statusCode: HTTP_STATUS.OK,
      message: "AWS manual setup step 2 saved",
      data: result,
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new InternalServerError("Failed to save AWS manual setup step 2");
  }
}

export async function handleCreateOrUpdateAwsManualStep3(req: Request, res: Response): Promise<void> {
  try {
    const payload = parseAwsManualStep3Body(req.body);
    const userId = req.auth?.user.id;

    if (!userId) {
      throw new UnauthorizedError("Missing userId in authenticated context");
    }

    const result = await createOrUpdateAwsManualConnectionStep3(String(userId), payload);

    sendSuccess({
      res,
      req,
      statusCode: HTTP_STATUS.OK,
      message: "AWS manual setup step 3 saved",
      data: result,
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new InternalServerError("Failed to save AWS manual setup step 3");
  }
}

export async function handleValidateAwsManualConnection(req: Request, res: Response): Promise<void> {
  try {
    const payload = parseAwsManualValidateBody(req.body);
    const userId = req.auth?.user.id;

    if (!userId) {
      throw new UnauthorizedError("Missing userId in authenticated context");
    }

    const result = await validateAwsManualConnection(String(userId), payload);

    sendSuccess({
      res,
      req,
      statusCode: HTTP_STATUS.OK,
      message: "AWS manual connection validation completed",
      data: result,
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new InternalServerError("Failed to validate AWS manual connection");
  }
}
