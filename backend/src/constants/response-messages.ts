export const RESPONSE_MESSAGE = {
  SUCCESS: "Request completed successfully",
  HEALTH_OK: "Service is healthy",
  BAD_REQUEST: "Bad request",
  UNAUTHORIZED: "Unauthorized",
  FORBIDDEN: "Forbidden",
  NOT_FOUND: "Resource not found",
  CONFLICT: "Conflict occurred",
  VALIDATION_FAILED: "Validation failed",
  INTERNAL_SERVER_ERROR: "Internal server error",
} as const;

export type ResponseMessage =
  (typeof RESPONSE_MESSAGE)[keyof typeof RESPONSE_MESSAGE];
