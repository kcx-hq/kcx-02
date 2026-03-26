import { HTTP_STATUS } from "../constants/http-status.js";
import { ERROR_CODE, type ErrorCode } from "../constants/error-codes.js";

type AppErrorParams = {
  message: string;
  statusCode?: number;
  errorCode?: ErrorCode;
  details?: unknown;
  isOperational?: boolean;
};

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: ErrorCode;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor({
    message,
    statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    errorCode = ERROR_CODE.INTERNAL_SERVER_ERROR,
    details,
    isOperational = true,
  }: AppErrorParams) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export type { AppErrorParams };
