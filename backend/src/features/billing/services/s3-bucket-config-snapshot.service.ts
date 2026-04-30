/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import {
  GetBucketEncryptionCommand,
  GetBucketLifecycleConfigurationCommand,
  GetBucketLocationCommand,
  GetBucketLoggingCommand,
  GetBucketOwnershipControlsCommand,
  GetBucketPolicyStatusCommand,
  GetPublicAccessBlockCommand,
  GetBucketReplicationCommand,
  GetBucketVersioningCommand,
  ListBucketsCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { BadRequestError, NotFoundError } from "../../../errors/http-errors.js";
import { BillingSource, CloudConnectionV2, S3BucketConfigSnapshot } from "../../../models/index.js";
import { assumeRole } from "../../cloud-connections/aws/infrastructure/aws-sts.service.js";

const normalize = (value) => String(value ?? "").trim();
const now = () => new Date();

const STATUS = {
  present: "present",
  absent: "absent",
  unknownPermissionDenied: "unknown_permission_denied",
  unknownApiError: "unknown_api_error",
};

const toDateOnly = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const toErrorCode = (error) =>
  String(error?.name ?? error?.Code ?? error?.code ?? "").trim();

const toErrorMessage = (error) =>
  error instanceof Error ? error.message : String(error);

const isAccessDeniedError = (error) =>
  ["AccessDenied", "AllAccessDisabled", "UnauthorizedAccess"].includes(toErrorCode(error));

const mapKnownAbsentStatus = (error, absentCodes = []) => {
  if (isAccessDeniedError(error)) return STATUS.unknownPermissionDenied;
  const code = toErrorCode(error);
  if (absentCodes.includes(code)) return STATUS.absent;
  return STATUS.unknownApiError;
};

const normalizeBucketRegion = (value) => {
  const raw = normalize(value);
  if (!raw) return "us-east-1";
  if (raw === "EU") return "eu-west-1";
  return raw;
};

const createS3Client = ({ region, credentials }) =>
  new S3Client({
    region,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
    },
  });

const resolveSourceAndConnection = async ({ tenantId, billingSourceId }) => {
  const source = await BillingSource.findByPk(String(billingSourceId));
  if (!source || String(source.tenantId) !== String(tenantId)) {
    throw new NotFoundError("Billing source not found");
  }

  if (!source.cloudConnectionId) {
    throw new BadRequestError("Billing source is not connected to cloud connection");
  }

  const connection = await CloudConnectionV2.findByPk(String(source.cloudConnectionId));
  if (!connection || String(connection.tenantId) !== String(tenantId)) {
    throw new NotFoundError("Cloud connection not found for billing source");
  }

  const roleArn = normalize(connection.billingRoleArn || connection.actionRoleArn);
  if (!roleArn) {
    throw new BadRequestError("Cloud connection missing billing/action role ARN");
  }

  const accountId = normalize(connection.cloudAccountId);
  if (!accountId) {
    throw new BadRequestError("Cloud connection missing cloud account id");
  }

  return { source, connection, roleArn, accountId };
};

const listAccountBuckets = async (client) => {
  try {
    const response = await client.send(new ListBucketsCommand({}));
    const buckets = Array.isArray(response?.Buckets) ? response.Buckets : [];
    return buckets.map((bucket) => normalize(bucket?.Name)).filter((value) => value.length > 0);
  } catch (error) {
    throw new BadRequestError(
      `Failed to list S3 buckets for account scope: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

async function getBucketRegion({ defaultRegionClient, bucketName }) {
  try {
    const response = await defaultRegionClient.send(
      new GetBucketLocationCommand({ Bucket: bucketName }),
    );
    return normalizeBucketRegion(response?.LocationConstraint);
  } catch {
    return "us-east-1";
  }
}

export async function collectS3BucketConfigSnapshotsForBillingSource({
  tenantId,
  billingSourceId,
}) {
  const { source, connection, roleArn, accountId } = await resolveSourceAndConnection({
    tenantId,
    billingSourceId,
  });
  const externalId = normalize(connection.externalId) || null;
  const credentials = await assumeRole(roleArn, externalId);
  const defaultRegion = normalize(connection.exportRegion || connection.region || "us-east-1");
  const defaultRegionClient = createS3Client({ region: defaultRegion, credentials });
  const buckets = await listAccountBuckets(defaultRegionClient);
  if (buckets.length === 0) {
    return { bucketsScanned: 0, snapshotsCreated: 0 };
  }

  const scanTime = now();
  const snapshots = [];

  for (const bucketName of buckets) {
    const rawErrors = {};
    const snapshot = {
      tenantId: source.tenantId,
      cloudConnectionId: source.cloudConnectionId,
      billingSourceId: source.id,
      providerId: source.cloudProviderId,
      accountId,
      bucketName,
      region: null,
      scanTime,
      lifecycleStatus: null,
      lifecycleRulesCount: null,
      lifecycleRulesJson: null,
      encryptionStatus: null,
      encryptionType: null,
      kmsKeyId: null,
      publicAccessBlockStatus: null,
      blockPublicAcls: null,
      ignorePublicAcls: null,
      blockPublicPolicy: null,
      restrictPublicBuckets: null,
      policyPublicStatus: null,
      versioningStatus: null,
      mfaDeleteStatus: null,
      loggingStatus: null,
      loggingTargetBucket: null,
      loggingTargetPrefix: null,
      replicationStatus: null,
      replicationRulesCount: null,
      replicationConfigJson: null,
      ownershipStatus: null,
      rawErrorsJson: null,
      createdAt: scanTime,
    };

    const region = await getBucketRegion({ defaultRegionClient, bucketName });
    snapshot.region = region;
    const regionalClient = createS3Client({ region, credentials });

    try {
      const response = await regionalClient.send(
        new GetBucketLifecycleConfigurationCommand({ Bucket: bucketName }),
      );
      const rules = Array.isArray(response?.Rules) ? response.Rules : [];
      snapshot.lifecycleStatus = STATUS.present;
      snapshot.lifecycleRulesCount = rules.length;
      snapshot.lifecycleRulesJson = { Rules: rules };
    } catch (error) {
      snapshot.lifecycleStatus = mapKnownAbsentStatus(error, ["NoSuchLifecycleConfiguration"]);
      rawErrors.lifecycle = { code: toErrorCode(error), message: toErrorMessage(error) };
    }

    try {
      const response = await regionalClient.send(new GetBucketEncryptionCommand({ Bucket: bucketName }));
      const rules = response?.ServerSideEncryptionConfiguration?.Rules ?? [];
      const defaultRule = rules[0]?.ApplyServerSideEncryptionByDefault ?? null;
      snapshot.encryptionStatus = STATUS.present;
      snapshot.encryptionType = normalize(defaultRule?.SSEAlgorithm) || null;
      snapshot.kmsKeyId = normalize(defaultRule?.KMSMasterKeyID) || null;
    } catch (error) {
      snapshot.encryptionStatus = mapKnownAbsentStatus(error, ["ServerSideEncryptionConfigurationNotFoundError"]);
      rawErrors.encryption = { code: toErrorCode(error), message: toErrorMessage(error) };
    }

    try {
      const response = await regionalClient.send(new GetPublicAccessBlockCommand({ Bucket: bucketName }));
      const cfg = response?.PublicAccessBlockConfiguration ?? {};
      snapshot.blockPublicAcls = typeof cfg.BlockPublicAcls === "boolean" ? cfg.BlockPublicAcls : null;
      snapshot.ignorePublicAcls = typeof cfg.IgnorePublicAcls === "boolean" ? cfg.IgnorePublicAcls : null;
      snapshot.blockPublicPolicy = typeof cfg.BlockPublicPolicy === "boolean" ? cfg.BlockPublicPolicy : null;
      snapshot.restrictPublicBuckets =
        typeof cfg.RestrictPublicBuckets === "boolean" ? cfg.RestrictPublicBuckets : null;
      const allTrue =
        snapshot.blockPublicAcls === true &&
        snapshot.ignorePublicAcls === true &&
        snapshot.blockPublicPolicy === true &&
        snapshot.restrictPublicBuckets === true;
      snapshot.publicAccessBlockStatus = allTrue ? "fully_blocked" : "partial";
    } catch (error) {
      snapshot.publicAccessBlockStatus = mapKnownAbsentStatus(error, ["NoSuchPublicAccessBlockConfiguration"]);
      rawErrors.publicAccessBlock = { code: toErrorCode(error), message: toErrorMessage(error) };
    }

    try {
      const response = await regionalClient.send(new GetBucketPolicyStatusCommand({ Bucket: bucketName }));
      const isPublic = Boolean(response?.PolicyStatus?.IsPublic);
      snapshot.policyPublicStatus = isPublic ? "public" : "not_public";
    } catch (error) {
      snapshot.policyPublicStatus = mapKnownAbsentStatus(error, []);
      rawErrors.policyStatus = { code: toErrorCode(error), message: toErrorMessage(error) };
    }

    try {
      const response = await regionalClient.send(new GetBucketVersioningCommand({ Bucket: bucketName }));
      const status = normalize(response?.Status);
      snapshot.versioningStatus = status || "disabled";
      snapshot.mfaDeleteStatus = normalize(response?.MFADelete) || "unknown";
    } catch (error) {
      snapshot.versioningStatus = mapKnownAbsentStatus(error, []);
      snapshot.mfaDeleteStatus = "unknown";
      rawErrors.versioning = { code: toErrorCode(error), message: toErrorMessage(error) };
    }

    try {
      const response = await regionalClient.send(new GetBucketLoggingCommand({ Bucket: bucketName }));
      const enabled = response?.LoggingEnabled;
      if (enabled) {
        snapshot.loggingStatus = "enabled";
        snapshot.loggingTargetBucket = normalize(enabled.TargetBucket) || null;
        snapshot.loggingTargetPrefix = normalize(enabled.TargetPrefix) || null;
      } else {
        snapshot.loggingStatus = "disabled";
      }
    } catch (error) {
      snapshot.loggingStatus = mapKnownAbsentStatus(error, []);
      rawErrors.logging = { code: toErrorCode(error), message: toErrorMessage(error) };
    }

    try {
      const response = await regionalClient.send(new GetBucketReplicationCommand({ Bucket: bucketName }));
      const rules = response?.ReplicationConfiguration?.Rules ?? [];
      snapshot.replicationStatus = STATUS.present;
      snapshot.replicationRulesCount = Array.isArray(rules) ? rules.length : 0;
      snapshot.replicationConfigJson = response?.ReplicationConfiguration ?? null;
    } catch (error) {
      snapshot.replicationStatus = mapKnownAbsentStatus(error, ["ReplicationConfigurationNotFoundError"]);
      rawErrors.replication = { code: toErrorCode(error), message: toErrorMessage(error) };
    }

    try {
      const response = await regionalClient.send(new GetBucketOwnershipControlsCommand({ Bucket: bucketName }));
      const rule = response?.OwnershipControls?.Rules?.[0];
      snapshot.ownershipStatus = normalize(rule?.ObjectOwnership) || "unknown";
    } catch (error) {
      snapshot.ownershipStatus = mapKnownAbsentStatus(error, ["OwnershipControlsNotFoundError"]);
      rawErrors.ownership = { code: toErrorCode(error), message: toErrorMessage(error) };
    }

    snapshot.rawErrorsJson = Object.keys(rawErrors).length > 0 ? rawErrors : null;
    snapshots.push(snapshot);
  }

  if (snapshots.length === 0) {
    return { bucketsScanned: buckets.length, snapshotsCreated: 0 };
  }

  await S3BucketConfigSnapshot.bulkCreate(snapshots);

  return {
    bucketsScanned: buckets.length,
    snapshotsCreated: snapshots.length,
  };
}
