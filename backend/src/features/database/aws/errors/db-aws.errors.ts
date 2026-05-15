import type { AwsDatabaseClientKind } from "../types/db-aws.types.js";

export class DbAwsError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "DbAwsError";
  }
}

export class DbAwsAuthError extends DbAwsError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "DB_AWS_AUTH_ERROR", details);
    this.name = "DbAwsAuthError";
  }
}

export class DbAwsPermissionError extends DbAwsError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "DB_AWS_PERMISSION_ERROR", details);
    this.name = "DbAwsPermissionError";
  }
}

export class DbAwsRegionError extends DbAwsError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "DB_AWS_REGION_ERROR", details);
    this.name = "DbAwsRegionError";
  }
}

export class DbAwsMissingSdkClientError extends DbAwsError {
  constructor(clientKind: AwsDatabaseClientKind, moduleName: string, details?: Record<string, unknown>) {
    super(
      `AWS SDK client is not available for '${clientKind}'. Install '${moduleName}' to enable this DB service.`,
      "DB_AWS_MISSING_SDK_CLIENT",
      { ...details, clientKind, moduleName },
    );
    this.name = "DbAwsMissingSdkClientError";
  }
}

export class DbAwsThrottlingError extends DbAwsError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "DB_AWS_THROTTLING_ERROR", details);
    this.name = "DbAwsThrottlingError";
  }
}

export class DbAwsValidationError extends DbAwsError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "DB_AWS_VALIDATION_ERROR", details);
    this.name = "DbAwsValidationError";
  }
}
