import crypto from "node:crypto";

import type {
  BrowseManualBucketInput,
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
} from "./manual-connection.repository.js";
import {
  assertCloudAccountIsUnique,
  resolveAwsProviderId,
  syncManualCloudIntegration,
} from "../../cloud-integration-registry.service.js";
import { UniqueConstraintError } from "sequelize";
import { HTTP_STATUS } from "../../../../constants/http-status.js";
import { DuplicateCloudConnectionError } from "../../../../errors/http-errors.js";

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
      roleArn: payload.roleArn,
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
