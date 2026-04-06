import { ERROR_CODE } from "../constants/error-codes.js";
import { HTTP_STATUS } from "../constants/http-status.js";
import { RESPONSE_MESSAGE } from "../constants/response-messages.js";
import { AppError } from "./app-error.js";

export class BadRequestError extends AppError {
  constructor(message: string = RESPONSE_MESSAGE.BAD_REQUEST, details?: unknown) {
    super({
      message,
      statusCode: HTTP_STATUS.BAD_REQUEST,
      errorCode: ERROR_CODE.BAD_REQUEST,
      details,
    });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = RESPONSE_MESSAGE.UNAUTHORIZED, details?: unknown) {
    super({
      message,
      statusCode: HTTP_STATUS.UNAUTHORIZED,
      errorCode: ERROR_CODE.UNAUTHORIZED,
      details,
    });
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = RESPONSE_MESSAGE.FORBIDDEN, details?: unknown) {
    super({
      message,
      statusCode: HTTP_STATUS.FORBIDDEN,
      errorCode: ERROR_CODE.FORBIDDEN,
      details,
    });
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = RESPONSE_MESSAGE.NOT_FOUND, details?: unknown) {
    super({
      message,
      statusCode: HTTP_STATUS.NOT_FOUND,
      errorCode: ERROR_CODE.NOT_FOUND,
      details,
    });
  }
}

export class ConflictError extends AppError {
  constructor(message: string = RESPONSE_MESSAGE.CONFLICT, details?: unknown) {
    super({
      message,
      statusCode: HTTP_STATUS.CONFLICT,
      errorCode: ERROR_CODE.CONFLICT,
      details,
    });
  }
}

export class DuplicateCloudConnectionError extends AppError {
  constructor(message: string, details?: unknown) {
    super({
      message,
      statusCode: HTTP_STATUS.CONFLICT,
      errorCode: ERROR_CODE.DUPLICATE_CLOUD_CONNECTION,
      details,
    });
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string = RESPONSE_MESSAGE.VALIDATION_FAILED,
    details?: unknown,
  ) {
    super({
      message,
      statusCode: HTTP_STATUS.UNPROCESSABLE_ENTITY,
      errorCode: ERROR_CODE.VALIDATION_ERROR,
      details,
    });
  }
}

export class InternalServerError extends AppError {
  constructor(
    message: string = RESPONSE_MESSAGE.INTERNAL_SERVER_ERROR,
    details?: unknown,
  ) {
    super({
      message,
      statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      errorCode: ERROR_CODE.INTERNAL_SERVER_ERROR,
      details,
      isOperational: false,
    });
  }
}
