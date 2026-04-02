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
import { createManualConnectionRecord } from "./manual-connection.repository.js";

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

export async function createManualConnection(
  payload: CreateManualConnectionInput,
  userContext: ManualConnectionUserContext,
): Promise<CreateManualConnectionResult> {
  try {
    const assumedIdentity = await assumeRoleAndGetIdentity({
      roleArn: payload.roleArn,
      externalId: payload.externalId,
      roleSessionName: buildRoleSessionName(),
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
