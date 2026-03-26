import type { ErrorRequestHandler } from "express";
import { ERROR_CODE } from "../constants/error-codes.js";
import { RESPONSE_MESSAGE } from "../constants/response-messages.js";
import { AppError } from "../errors/app-error.js";
import { InternalServerError } from "../errors/http-errors.js";
import { sendError } from "../utils/api-response.js";
import { logger } from "../utils/logger.js";

const isProduction = process.env.NODE_ENV === "production";

export const errorHandlerMiddleware: ErrorRequestHandler = (
  error,
  req,
  res,
  next,
) => {
  void next;

  const appError =
    error instanceof AppError
      ? error
      : new InternalServerError(RESPONSE_MESSAGE.INTERNAL_SERVER_ERROR);

  const shouldLogAsError =
    !(error instanceof AppError) || appError.statusCode >= 500;

  if (shouldLogAsError) {
    logger.error("Request failed", {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: appError.statusCode,
      errorCode: appError.errorCode,
      message: appError.message,
      details: appError.details,
      stack: error instanceof Error ? error.stack : undefined,
    });
  }

  const details =
    appError.details ??
    (!isProduction && error instanceof Error ? { stack: error.stack } : undefined);

  sendError({
    res,
    req,
    statusCode: appError.statusCode,
    message: appError.message || RESPONSE_MESSAGE.INTERNAL_SERVER_ERROR,
    error: {
      code: appError.errorCode || ERROR_CODE.INTERNAL_SERVER_ERROR,
      ...(details !== undefined ? { details } : {}),
    },
  });
};
