import {
  DbAwsAuthError,
  DbAwsError,
  DbAwsPermissionError,
  DbAwsRegionError,
  DbAwsThrottlingError,
  DbAwsValidationError,
} from "./db-aws.errors.js";

type AwsLikeError = {
  name?: string;
  message?: string;
  Code?: string;
  code?: string;
  $metadata?: { httpStatusCode?: number; requestId?: string };
};

const toLower = (value: unknown): string => String(value ?? "").trim().toLowerCase();

export const normalizeDbAwsError = (
  error: unknown,
  context?: Record<string, unknown>,
): DbAwsError => {
  if (error instanceof DbAwsError) return error;

  const source = (error ?? {}) as AwsLikeError;
  const name = String(source.name ?? "").trim();
  const message = String(source.message ?? "Unknown AWS error").trim();
  const code = String(source.Code ?? source.code ?? "").trim();
  const lowerName = toLower(name);
  const lowerCode = toLower(code);
  const lowerMessage = toLower(message);

  const details = {
    ...context,
    sourceName: name || null,
    sourceCode: code || null,
    httpStatusCode: source.$metadata?.httpStatusCode ?? null,
    requestId: source.$metadata?.requestId ?? null,
  };

  if (
    lowerCode.includes("throttl") ||
    lowerName.includes("throttl") ||
    lowerMessage.includes("rate exceeded")
  ) {
    return new DbAwsThrottlingError(message, details);
  }

  if (
    lowerCode.includes("accessdenied") ||
    lowerCode.includes("unauthorized") ||
    lowerName.includes("accessdenied") ||
    lowerMessage.includes("not authorized")
  ) {
    return new DbAwsPermissionError(message, details);
  }

  if (
    lowerCode.includes("invalidclienttokenid") ||
    lowerCode.includes("expiredtoken") ||
    lowerCode.includes("signaturedoesnotmatch") ||
    lowerName.includes("unrecognizedclient")
  ) {
    return new DbAwsAuthError(message, details);
  }

  if (
    lowerCode.includes("invalidsignatureexception") ||
    lowerCode.includes("invalidparameter") ||
    lowerCode.includes("validation") ||
    lowerName.includes("validation")
  ) {
    return new DbAwsValidationError(message, details);
  }

  if (
    lowerCode.includes("invalidregion") ||
    lowerMessage.includes("region") && lowerMessage.includes("not supported")
  ) {
    return new DbAwsRegionError(message, details);
  }

  return new DbAwsError(message, "DB_AWS_ERROR", details);
};
