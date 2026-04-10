import { GetCallerIdentityCommand, AssumeRoleCommand, STSClient } from "@aws-sdk/client-sts";
import {
  GetBucketLocationCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";

import env from "../../../../config/env.js";

export type AwsTempCredentials = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
};

export type AssumedRoleIdentity = {
  tempCredentials: AwsTempCredentials;
  accountId: string;
  userArn: string | null;
  region: string;
};

export type BrowseBucketItem = {
  key: string;
  name: string;
  type: "folder" | "file";
  size: number | null;
  lastModified: string | null;
  path: string;
};

export class ManualConnectionAwsError extends Error {
  constructor(
    public readonly errorCode: string,
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}

const sanitizeAwsError = (error: unknown): string => {
  if (!(error instanceof Error)) return "Unknown AWS error";
  const name = error.name || "AwsError";
  const message = error.message || "Unknown AWS error";
  return `${name}: ${message}`;
};

const normalizePrefix = (prefix: string | undefined): string => {
  if (!prefix) return "";
  return prefix.startsWith("/") ? prefix.slice(1) : prefix;
};

const normalizeBucketRegion = (regionValue: string | null | undefined): string => {
  if (!regionValue) return "us-east-1";
  if (regionValue === "EU") return "eu-west-1";
  return regionValue;
};

const extractBucketRegionFromError = (error: unknown): string | null => {
  if (!error || typeof error !== "object") return null;

  const maybeError = error as {
    BucketRegion?: string;
    $response?: { headers?: Record<string, string | undefined> };
    $metadata?: { httpHeaders?: Record<string, string | undefined> };
  };

  const regionFromHeaders =
    maybeError.$metadata?.httpHeaders?.["x-amz-bucket-region"] ??
    maybeError.$response?.headers?.["x-amz-bucket-region"] ??
    maybeError.BucketRegion;

  return regionFromHeaders ? normalizeBucketRegion(regionFromHeaders) : null;
};

const getValidationCredentials = () => {
  if (!env.awsValidationAccessKeyId || !env.awsValidationSecretAccessKey) {
    throw new ManualConnectionAwsError(
      "AWS_VALIDATION_CREDENTIALS_MISSING",
      "Missing backend AWS validation credentials.",
      500,
    );
  }

  return {
    accessKeyId: env.awsValidationAccessKeyId,
    secretAccessKey: env.awsValidationSecretAccessKey,
    ...(env.awsValidationSessionToken ? { sessionToken: env.awsValidationSessionToken } : {}),
  };
};

export async function assumeRoleAndGetIdentity(params: {
  roleArn: string;
  externalId: string;
  roleSessionName: string;
}): Promise<AssumedRoleIdentity> {
  const region = env.awsRegion || "us-east-1";
  const stsClient = new STSClient({
    region,
    credentials: getValidationCredentials(),
  });

  let tempCredentials: AwsTempCredentials;

  try {
    const assumeRoleResponse = await stsClient.send(
      new AssumeRoleCommand({
        RoleArn: params.roleArn,
        ExternalId: params.externalId,
        RoleSessionName: params.roleSessionName,
      }),
    );

    if (
      !assumeRoleResponse.Credentials?.AccessKeyId ||
      !assumeRoleResponse.Credentials.SecretAccessKey ||
      !assumeRoleResponse.Credentials.SessionToken
    ) {
      throw new ManualConnectionAwsError(
        "ASSUME_ROLE_FAILED",
        "Unable to assume role. Incomplete temporary credentials returned by AWS.",
        400,
      );
    }

    tempCredentials = {
      accessKeyId: assumeRoleResponse.Credentials.AccessKeyId,
      secretAccessKey: assumeRoleResponse.Credentials.SecretAccessKey,
      sessionToken: assumeRoleResponse.Credentials.SessionToken,
    };
  } catch (error) {
    if (error instanceof ManualConnectionAwsError) throw error;
    throw new ManualConnectionAwsError(
      "ASSUME_ROLE_FAILED",
      `Unable to assume role. Check trust policy and externalId. ${sanitizeAwsError(error)}`,
      400,
    );
  }

  try {
    const assumedSts = new STSClient({ region, credentials: tempCredentials });
    const identity = await assumedSts.send(new GetCallerIdentityCommand({}));

    if (!identity.Account) {
      throw new ManualConnectionAwsError(
        "CALLER_IDENTITY_FAILED",
        "Unable to verify caller identity after AssumeRole.",
        400,
      );
    }

    return {
      tempCredentials,
      accountId: identity.Account,
      userArn: identity.Arn ?? null,
      region,
    };
  } catch (error) {
    if (error instanceof ManualConnectionAwsError) throw error;
    throw new ManualConnectionAwsError(
      "CALLER_IDENTITY_FAILED",
      `Unable to fetch caller identity. ${sanitizeAwsError(error)}`,
      400,
    );
  }
}

export async function resolveBucketRegion(params: {
  bucketName: string;
  defaultRegion: string;
  tempCredentials: AwsTempCredentials;
}): Promise<string> {
  const probeClient = new S3Client({
    region: params.defaultRegion,
    credentials: params.tempCredentials,
  });

  try {
    const location = await probeClient.send(new GetBucketLocationCommand({ Bucket: params.bucketName }));
    return normalizeBucketRegion(location.LocationConstraint);
  } catch (error) {
    const regionFromError = extractBucketRegionFromError(error);
    if (regionFromError) return regionFromError;

    const errorName =
      error && typeof error === "object" && "name" in error && typeof error.name === "string"
        ? error.name
        : "";
    if (errorName === "AccessDenied") {
      // Some customer policies intentionally omit s3:GetBucketLocation.
      // Fall back to configured/default region and let ListObjectsV2 verify access.
      return normalizeBucketRegion(params.defaultRegion);
    }

    throw new ManualConnectionAwsError(
      "BUCKET_REGION_RESOLUTION_FAILED",
      `Unable to resolve bucket region. ${sanitizeAwsError(error)}`,
      400,
    );
  }
}

export async function verifyS3Access(params: {
  bucketName: string;
  prefix?: string;
  defaultRegion: string;
  tempCredentials: AwsTempCredentials;
}): Promise<{ resolvedRegion: string }> {
  const resolvedRegion = await resolveBucketRegion({
    bucketName: params.bucketName,
    defaultRegion: params.defaultRegion,
    tempCredentials: params.tempCredentials,
  });

  try {
    const s3Client = new S3Client({
      region: resolvedRegion,
      credentials: params.tempCredentials,
    });

    await s3Client.send(
      new ListObjectsV2Command({
        Bucket: params.bucketName,
        Prefix: normalizePrefix(params.prefix) || undefined,
        Delimiter: "/",
        MaxKeys: 1,
      }),
    );

    return { resolvedRegion };
  } catch (error) {
    throw new ManualConnectionAwsError(
      "S3_ACCESS_CHECK_FAILED",
      `Unable to access S3 bucket/prefix. ${sanitizeAwsError(error)}`,
      400,
    );
  }
}

export async function browseS3Bucket(params: {
  bucketName: string;
  prefix?: string;
  defaultRegion: string;
  tempCredentials: AwsTempCredentials;
}): Promise<{ prefix: string; items: BrowseBucketItem[]; resolvedRegion: string }> {
  const prefix = normalizePrefix(params.prefix);
  const resolvedRegion = await resolveBucketRegion({
    bucketName: params.bucketName,
    defaultRegion: params.defaultRegion,
    tempCredentials: params.tempCredentials,
  });

  try {
    const s3Client = new S3Client({
      region: resolvedRegion,
      credentials: params.tempCredentials,
    });

    const result = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: params.bucketName,
        Prefix: prefix || undefined,
        Delimiter: "/",
        MaxKeys: 200,
      }),
    );

    const folderItems: BrowseBucketItem[] = (result.CommonPrefixes ?? [])
      .map((prefixEntry) => prefixEntry.Prefix ?? "")
      .filter(Boolean)
      .map((folderPrefix) => {
        const rawName = folderPrefix.endsWith("/") ? folderPrefix.slice(0, -1) : folderPrefix;
        const segments = rawName.split("/");
        const name = segments[segments.length - 1] || rawName;
        return {
          key: folderPrefix,
          name,
          type: "folder" as const,
          size: null,
          lastModified: null,
          path: folderPrefix,
        };
      });

    const fileItems: BrowseBucketItem[] = (result.Contents ?? [])
      .filter((obj) => Boolean(obj.Key))
      .map((obj) => {
        const key = obj.Key as string;
        const segments = key.split("/");
        const name = segments[segments.length - 1] || key;
        return {
          key,
          name,
          type: "file" as const,
          size: typeof obj.Size === "number" ? obj.Size : null,
          lastModified: obj.LastModified ? obj.LastModified.toISOString() : null,
          path: key,
        };
      })
      .filter((obj) => obj.path !== prefix);

    return {
      prefix,
      items: [...folderItems, ...fileItems],
      resolvedRegion,
    };
  } catch (error) {
    throw new ManualConnectionAwsError(
      "S3_BROWSE_FAILED",
      `Unable to browse S3 bucket contents. ${sanitizeAwsError(error)}`,
      400,
    );
  }
}
