import crypto from "node:crypto";

import type {
  BrowseManualBucketInput,
  CompleteManualSetupInput,
  CreateManualConnectionInput,
} from "./manual-connection.schema.js";
import {
  browseS3Bucket,
  assumeRoleAndGetIdentity,
  ManualConnectionAwsError,
  verifyS3Access,
} from "./aws-assume-role.util.js";
import {
  createManualConnectionRecord,
  findManualConnectionByTenantAndName,
  upsertManualConnectionCompletion,
} from "./manual-connection.repository.js";
import {
  assertCloudAccountIsUnique,
  resolveAwsProviderId,
  syncManualCloudIntegration,
} from "../../cloud-integration-registry.service.js";
import { syncS3UploadConnectionFromAwsSetup } from "../s3-upload-connection-sync.service.js";
import { UniqueConstraintError } from "sequelize";
import { HTTP_STATUS } from "../../../../constants/http-status.js";
import { DuplicateCloudConnectionError } from "../../../../errors/http-errors.js";
import { validateAwsConnectionConfig } from "../auto-connection/aws-connection-validation.service.js";
import { logger } from "../../../../utils/logger.js";

export type ManualConnectionUserContext = {
  userId: string;
  tenantId: string;
};

type CreateManualConnectionSuccess = {
  success: true;
  connectionId: string;
  validationStatus: "success";
  accountId: string;
};

type CreateManualConnectionFailure = {
  success: false;
  errorCode: string;
  message: string;
  statusCode: number;
  details?: Record<string, unknown>;
};

export type CreateManualConnectionResult =
  | CreateManualConnectionSuccess
  | CreateManualConnectionFailure;

export type BrowseManualBucketResult = {
  success: boolean;
  assumeRoleSucceeded: boolean;
  callerIdentity: {
    account: string | null;
    userArn: string | null;
  } | null;
  bucketName: string;
  prefix: string;
  items: Array<{
    key: string;
    name: string;
    type: "folder" | "file";
    size: number | null;
    lastModified: string | null;
    path: string;
  }>;
};

type CompleteManualSetupSuccess = {
  success: true;
  connectionId: string;
  status: string;
  validationStatus: string;
  isComplete: true;
};

type CompleteManualSetupFailure = {
  success: false;
  errorCode: string;
  message: string;
  statusCode: number;
  details?: Record<string, unknown>;
};

export type CompleteManualSetupResult = CompleteManualSetupSuccess | CompleteManualSetupFailure;

const buildRoleSessionName = () => {
  const suffix = crypto.randomBytes(4).toString("hex");
  return `kcx-manual-${Date.now()}-${suffix}`.slice(0, 64);
};

const DUPLICATE_ERROR_CODE = "DUPLICATE_CLOUD_CONNECTION";
const DUPLICATE_ERROR_MESSAGE = "This AWS account is already connected in KCX.";

const buildDuplicateFailure = (accountId: string): CreateManualConnectionFailure => ({
  success: false,
  errorCode: DUPLICATE_ERROR_CODE,
  message: DUPLICATE_ERROR_MESSAGE,
  statusCode: HTTP_STATUS.CONFLICT,
  details: {
    provider: "aws",
    awsAccountId: accountId,
  },
});

const isManualAccountUniqueConstraintError = (error: unknown): boolean => {
  if (!(error instanceof UniqueConstraintError)) return false;

  const fieldNames = Object.keys(error.fields ?? {});
  const touchesTenantField = fieldNames.includes("tenant_id") || fieldNames.includes("tenantId");
  const touchesAccountField =
    fieldNames.includes("aws_account_id") || fieldNames.includes("awsAccountId");

  if (touchesTenantField && touchesAccountField) return true;

  const message = error.message.toLowerCase();
  return message.includes("uq_manual_cloud_connections_tenant_aws_account_id");
};

export async function createManualConnection(
  payload: CreateManualConnectionInput,
  userContext: ManualConnectionUserContext,
): Promise<CreateManualConnectionResult> {
  let resolvedAwsAccountId: string | null = null;
  try {
    const assumedIdentity = await assumeRoleAndGetIdentity({
      roleArn: payload.roleArn,
      externalId: payload.externalId,
      roleSessionName: buildRoleSessionName(),
    });
    resolvedAwsAccountId = assumedIdentity.accountId;
    const providerId = await resolveAwsProviderId();
    await assertCloudAccountIsUnique({
      providerId,
      cloudAccountId: assumedIdentity.accountId,
    });

    await verifyS3Access({
      bucketName: payload.bucketName,
      prefix: payload.prefix,
      defaultRegion: assumedIdentity.region,
      tempCredentials: assumedIdentity.tempCredentials,
    });

    const record = await createManualConnectionRecord({
      tenantId: userContext.tenantId,
      createdBy: userContext.userId,
      connectionName: payload.connectionName,
      awsAccountId: assumedIdentity.accountId,
      billingRoleArn: payload.roleArn,
      externalId: payload.externalId,
      bucketName: payload.bucketName,
      prefix: payload.prefix,
      reportName: payload.reportName,
      validationStatus: "success",
      assumeRoleSuccess: true,
      lastValidatedAt: new Date(),
      status: "active",
      errorMessage: null,
    });

    await syncManualCloudIntegration(record, {
      providerId,
      statusMessage: "Pending First Ingest",
      lastCheckedAt: record.lastValidatedAt ?? new Date(),
    });

    return {
      success: true,
      connectionId: record.id,
      validationStatus: "success",
      accountId: assumedIdentity.accountId,
    };
  } catch (error) {
    if (error instanceof ManualConnectionAwsError) {
      return {
        success: false,
        errorCode: error.errorCode,
        message: error.message,
        statusCode: error.statusCode,
      };
    }

    if (error instanceof DuplicateCloudConnectionError) {
      return {
        success: false,
        errorCode: DUPLICATE_ERROR_CODE,
        message: DUPLICATE_ERROR_MESSAGE,
        statusCode: HTTP_STATUS.CONFLICT,
        details: {
          provider: "aws",
          awsAccountId: resolvedAwsAccountId ?? "unknown",
        },
      };
    }

    if (isManualAccountUniqueConstraintError(error)) {
      return buildDuplicateFailure(resolvedAwsAccountId ?? "unknown");
    }

    return {
      success: false,
      errorCode: "MANUAL_CONNECTION_CREATE_FAILED",
      message: "Unable to create manual AWS connection.",
      statusCode: 500,
    };
  }
}

export async function browseManualConnectionBucket(
  payload: BrowseManualBucketInput,
): Promise<BrowseManualBucketResult> {
  const assumedIdentity = await assumeRoleAndGetIdentity({
    roleArn: payload.roleArn,
    externalId: payload.externalId,
    roleSessionName: buildRoleSessionName(),
  });

  const browseResult = await browseS3Bucket({
    bucketName: payload.bucketName,
    prefix: payload.prefix,
    defaultRegion: assumedIdentity.region,
    tempCredentials: assumedIdentity.tempCredentials,
  });

  return {
    success: true,
    assumeRoleSucceeded: true,
    callerIdentity: {
      account: assumedIdentity.accountId,
      userArn: assumedIdentity.userArn,
    },
    bucketName: payload.bucketName,
    prefix: browseResult.prefix,
    items: browseResult.items,
  };
}

export async function completeManualConnectionSetup(
  payload: CompleteManualSetupInput,
  userContext: ManualConnectionUserContext,
): Promise<CompleteManualSetupResult> {
  try {
    const providerId = await resolveAwsProviderId();
    const existing = await findManualConnectionByTenantAndName(
      userContext.tenantId,
      payload.connectionName,
    );

    await assertCloudAccountIsUnique({
      providerId,
      cloudAccountId: payload.awsAccountId,
      ...(existing
        ? {
            excludeDetailRecordType: "manual_cloud_connection",
            excludeDetailRecordId: existing.id,
          }
        : {}),
    });

    const preValidation = await validateAwsConnectionConfig({
      connectionId: existing?.id ?? crypto.randomUUID(),
      billingRoleArn: payload.billingRoleArn,
      externalId: payload.externalId,
      expectedAccountId: payload.awsAccountId,
      exportBucket: payload.exportBucketName,
      exportPrefix: payload.exportPrefix,
      region: payload.awsRegion,
      exportRegion: payload.awsRegion,
    });

    if (preValidation.status === "failed") {
      return {
        success: false,
        errorCode: "AWS_VALIDATION_FAILED",
        message: preValidation.errorMessage ?? "AWS validation failed.",
        statusCode: HTTP_STATUS.BAD_REQUEST,
      };
    }

    let cloudTrailValidationStatus: "active" | "active_with_warnings" | "failed" = "active";
    let cloudTrailValidationError: string | null = null;

    if (payload.enableCloudTrail && payload.cloudtrailBucketName) {
      const cloudTrailValidation = await validateAwsConnectionConfig({
        connectionId: existing?.id ?? crypto.randomUUID(),
        billingRoleArn: payload.billingRoleArn,
        externalId: payload.externalId,
        expectedAccountId: payload.awsAccountId,
        exportBucket: payload.cloudtrailBucketName,
        exportPrefix: payload.cloudtrailPrefix,
        region: payload.awsRegion,
        exportRegion: payload.awsRegion,
      });

      cloudTrailValidationStatus = cloudTrailValidation.status;
      cloudTrailValidationError = cloudTrailValidation.errorMessage;

      if (cloudTrailValidation.status === "failed") {
        return {
          success: false,
          errorCode: "AWS_CLOUDTRAIL_VALIDATION_FAILED",
          message: cloudTrailValidation.errorMessage ?? "AWS CloudTrail validation failed.",
          statusCode: HTTP_STATUS.BAD_REQUEST,
        };
      }
    }

    const now = new Date();
    const cloudtrailEnabled = payload.enableCloudTrail;
    const combinedValidationError = preValidation.errorMessage ?? cloudTrailValidationError;
    const normalizedPayload = {
      setupValues: {
        externalId: payload.externalId,
        connectionName: payload.connectionName,
        kcxPrincipalArn: payload.kcxPrincipalArn,
        fileEventCallbackUrl: payload.fileEventCallbackUrl,
        callbackToken: payload.callbackToken,
        awsAccountId: payload.awsAccountId,
        awsRegion: payload.awsRegion,
        enableCloudTrail: payload.enableCloudTrail,
        enableActionRole: payload.enableActionRole,
        enableEc2Module: payload.enableEc2Module,
        useTagScopedAccess: payload.useTagScopedAccess,
      },
      billing: {
        billingRoleName: payload.billingRoleName,
        billingRoleArn: payload.billingRoleArn,
        exportBucketName: payload.exportBucketName,
        exportPrefix: payload.exportPrefix,
        exportName: payload.exportName ?? null,
        exportArn: payload.exportArn ?? null,
      },
      actionRole: payload.enableActionRole
        ? {
            enabled: true,
            actionRoleName: payload.actionRoleName ?? null,
            actionRoleArn: payload.actionRoleArn ?? null,
            ec2ModuleEnabled: payload.enableEc2Module,
            useTagScopedAccess: payload.useTagScopedAccess,
          }
        : {
            enabled: false,
          },
      billingFileEventAutomation: {
        lambdaArn: payload.billingFileEventLambdaArn,
        eventbridgeRuleName: payload.billingEventbridgeRuleName,
      },
      cloudtrail: cloudtrailEnabled
        ? {
            enabled: true,
            bucketName: payload.cloudtrailBucketName ?? null,
            prefix: payload.cloudtrailPrefix ?? null,
            trailName: payload.cloudtrailTrailName ?? null,
            lambdaArn: payload.cloudtrailLambdaArn ?? null,
            eventbridgeRuleName: payload.cloudtrailEventbridgeRuleName ?? null,
          }
        : {
            enabled: false,
          },
      ...(payload.setupPayloadJson ? { clientSnapshot: payload.setupPayloadJson } : {}),
      completedAt: now.toISOString(),
      completedBy: userContext.userId,
      setupStep: payload.setupStep ?? 6,
    } satisfies Record<string, unknown>;

    const record = await upsertManualConnectionCompletion({
      tenantId: userContext.tenantId,
      userId: userContext.userId,
      connectionName: payload.connectionName,
      awsAccountId: payload.awsAccountId,
      awsRegion: payload.awsRegion,
      externalId: payload.externalId,
      kcxPrincipalArn: payload.kcxPrincipalArn,
      fileEventCallbackUrl: payload.fileEventCallbackUrl,
      callbackToken: payload.callbackToken,
      billingRoleName: payload.billingRoleName,
      billingRoleArn: payload.billingRoleArn,
      exportBucketName: payload.exportBucketName,
      exportPrefix: payload.exportPrefix,
      exportName: payload.exportName ?? null,
      exportArn: payload.exportArn ?? null,
      actionRoleEnabled: payload.enableActionRole,
      actionRoleName: payload.actionRoleName ?? null,
      actionRoleArn: payload.actionRoleArn ?? null,
      ec2ModuleEnabled: payload.enableEc2Module,
      useTagScopedAccess: payload.useTagScopedAccess,
      billingFileEventLambdaArn: payload.billingFileEventLambdaArn,
      billingEventbridgeRuleName: payload.billingEventbridgeRuleName,
      billingFileEventStatus: payload.billingFileEventStatus ?? "validated",
      billingFileEventValidatedAt: payload.billingFileEventValidatedAt
        ? new Date(payload.billingFileEventValidatedAt)
        : now,
      cloudtrailEnabled,
      cloudtrailBucketName: payload.cloudtrailBucketName ?? null,
      cloudtrailPrefix: payload.cloudtrailPrefix ?? null,
      cloudtrailTrailName: payload.cloudtrailTrailName ?? null,
      cloudtrailLambdaArn: payload.cloudtrailLambdaArn ?? null,
      cloudtrailEventbridgeRuleName: payload.cloudtrailEventbridgeRuleName ?? null,
      cloudtrailStatus: cloudtrailEnabled ? payload.cloudtrailStatus ?? "validated" : "disabled",
      cloudtrailValidatedAt: cloudtrailEnabled
        ? (payload.cloudtrailValidatedAt ? new Date(payload.cloudtrailValidatedAt) : now)
        : null,
      setupStep: payload.setupStep ?? 6,
      setupPayloadJson: normalizedPayload,
      status: "completed",
      validationStatus: "success",
      assumeRoleSuccess: true,
      lastValidatedAt: now,
      errorMessage: combinedValidationError,
    });

    await syncManualCloudIntegration(record, {
      providerId,
      statusMessage: "Pending First Ingest",
      lastCheckedAt: now,
    });

    try {
      await syncS3UploadConnectionFromAwsSetup({
        tenantId: userContext.tenantId,
        createdBy: userContext.userId,
        roleArn: payload.billingRoleArn,
        externalId: payload.externalId,
        bucketName: payload.exportBucketName,
        basePrefix: payload.exportPrefix,
        awsAccountId: payload.awsAccountId,
        status: "active",
      });
    } catch (s3SyncError) {
      logger.warn("Manual setup completed but failed to sync S3 upload connection", {
        tenantId: userContext.tenantId,
        connectionName: payload.connectionName,
        bucketName: payload.exportBucketName,
        prefix: payload.exportPrefix,
        message: s3SyncError instanceof Error ? s3SyncError.message : String(s3SyncError),
      });
    }

    return {
      success: true,
      connectionId: record.id,
      status: String(record.status),
      validationStatus: String(record.validationStatus),
      isComplete: true,
    };
  } catch (error) {
    if (error instanceof ManualConnectionAwsError) {
      return {
        success: false,
        errorCode: error.errorCode,
        message: error.message,
        statusCode: error.statusCode,
      };
    }

    if (error instanceof DuplicateCloudConnectionError) {
      return {
        success: false,
        errorCode: DUPLICATE_ERROR_CODE,
        message: DUPLICATE_ERROR_MESSAGE,
        statusCode: HTTP_STATUS.CONFLICT,
        details: {
          provider: "aws",
          awsAccountId: payload.awsAccountId,
        },
      };
    }

    return {
      success: false,
      errorCode: "MANUAL_SETUP_COMPLETE_FAILED",
      message: "Unable to persist manual setup completion.",
      statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    };
  }
}
