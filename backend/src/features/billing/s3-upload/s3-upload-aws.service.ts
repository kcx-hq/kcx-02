import {
  AssumeRoleCommand,
  GetCallerIdentityCommand,
  STSClient,
} from "@aws-sdk/client-sts";
import {
  GetBucketLocationCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { Readable } from "node:stream";

import env from "../../../config/env.js";
import { BadRequestError } from "../../../errors/http-errors.js";

export type AwsTempCredentials = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
};

export type S3ExplorerItem = {
  key: string;
  name: string;
  type: "folder" | "file";
  size: number | null;
  lastModified: string | null;
  path: string;
};

type AssumeRoleForSessionParams = {
  roleArn: string;
  externalId?: string | null;
};

type ValidateS3ScopeParams = {
  credentials: AwsTempCredentials;
  bucket: string;
  prefix: string;
};

type ListS3ScopeParams = {
  credentials: AwsTempCredentials;
  bucket: string;
  prefix: string;
};

type ValidateSelectedObjectKeysParams = {
  credentials: AwsTempCredentials;
  bucket: string;
  basePrefix: string;
  objectKeys: string[];
  tenantId?: string | null;
  userId?: string | null;
  sessionId?: string | null;
};

export type ValidatedS3Object = {
  key: string;
  sizeBytes: number;
  lastModified: Date | null;
};

export type SourceS3ObjectStream = {
  stream: Readable;
  contentType: string | null;
  contentLength: number | null;
  lastModified: Date | null;
};

const normalizeBucket = (value: string): string => String(value ?? "").trim();

const normalizePrefix = (value: string | undefined): string =>
  String(value ?? "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");

const normalizeObjectKey = (value: string): string =>
  String(value ?? "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");

const isKeyWithinScope = (key: string, basePrefix: string): boolean => {
  if (!basePrefix) return true;
  if (key === basePrefix) return true;
  if (basePrefix.endsWith("/")) {
    return key.startsWith(basePrefix);
  }
  return key.startsWith(`${basePrefix}/`);
};

const normalizeBucketRegion = (value: string | null | undefined): string => {
  if (!value) return "us-east-1";
  if (value === "EU") return "eu-west-1";
  return value;
};

const extractBucketRegionFromError = (error: unknown): string | null => {
  if (!error || typeof error !== "object") return null;

  const source = error as {
    BucketRegion?: string;
    $response?: { headers?: Record<string, string | undefined> };
    $metadata?: { httpHeaders?: Record<string, string | undefined> };
  };

  const region =
    source.$metadata?.httpHeaders?.["x-amz-bucket-region"] ??
    source.$response?.headers?.["x-amz-bucket-region"] ??
    source.BucketRegion;

  return region ? normalizeBucketRegion(region) : null;
};

const toAwsErrorMessage = (error: unknown): string => {
  if (!(error instanceof Error)) return "Unknown AWS error";
  const code = error.name || "AwsError";
  const message = error.message || "Unknown AWS error";
  return `${code}: ${message}`;
};

const getAssumeRoleBaseCredentials = () => {
  if (!env.awsValidationAccessKeyId || !env.awsValidationSecretAccessKey) {
    throw new BadRequestError("Backend AWS validation credentials are not configured");
  }

  return {
    accessKeyId: env.awsValidationAccessKeyId,
    secretAccessKey: env.awsValidationSecretAccessKey,
    ...(env.awsValidationSessionToken ? { sessionToken: env.awsValidationSessionToken } : {}),
  };
};

const createScopedS3Client = (region: string, credentials: AwsTempCredentials): S3Client =>
  new S3Client({
    region,
    credentials,
  });

const resolveBucketRegion = async (
  bucket: string,
  credentials: AwsTempCredentials,
  fallbackRegion: string,
): Promise<string> => {
  const probeClient = createScopedS3Client(fallbackRegion, credentials);

  try {
    const result = await probeClient.send(new GetBucketLocationCommand({ Bucket: bucket }));
    return normalizeBucketRegion(result.LocationConstraint);
  } catch (error) {
    const regionFromError = extractBucketRegionFromError(error);
    if (regionFromError) return regionFromError;

    throw new BadRequestError("Unable to resolve bucket region", {
      reason: toAwsErrorMessage(error),
    });
  }
};

export async function assumeRoleForUploadSession(
  params: AssumeRoleForSessionParams,
): Promise<{ credentials: AwsTempCredentials; accountId: string | null; assumedArn: string | null }> {
  const roleArn = String(params.roleArn ?? "").trim();
  if (!roleArn) {
    throw new BadRequestError("roleArn is required");
  }

  const externalId = String(params.externalId ?? "").trim();

  const stsClient = new STSClient({
    region: env.awsRegion,
    credentials: getAssumeRoleBaseCredentials(),
  });

  try {
    const assumeRoleResponse = await stsClient.send(
      new AssumeRoleCommand({
        RoleArn: roleArn,
        RoleSessionName: `kcx-s3-upload-${Date.now()}`,
        ...(externalId ? { ExternalId: externalId } : {}),
      }),
    );

    const accessKeyId = assumeRoleResponse.Credentials?.AccessKeyId;
    const secretAccessKey = assumeRoleResponse.Credentials?.SecretAccessKey;
    const sessionToken = assumeRoleResponse.Credentials?.SessionToken;

    if (!accessKeyId || !secretAccessKey || !sessionToken) {
      throw new BadRequestError("AssumeRole returned incomplete credentials");
    }

    const credentials: AwsTempCredentials = {
      accessKeyId,
      secretAccessKey,
      sessionToken,
    };

    const identityClient = new STSClient({
      region: env.awsRegion,
      credentials,
    });
    const identity = await identityClient.send(new GetCallerIdentityCommand({}));

    return {
      credentials,
      accountId: identity.Account ?? null,
      assumedArn: identity.Arn ?? null,
    };
  } catch (error) {
    if (error instanceof BadRequestError) {
      throw error;
    }
    throw new BadRequestError("Unable to assume AWS role", {
      reason: toAwsErrorMessage(error),
    });
  }
}

export async function validateS3ScopeAccess(
  params: ValidateS3ScopeParams,
): Promise<{ resolvedRegion: string }> {
  const bucket = normalizeBucket(params.bucket);
  const prefix = normalizePrefix(params.prefix);
  if (!bucket) {
    throw new BadRequestError("bucket is required");
  }

  const resolvedRegion = await resolveBucketRegion(bucket, params.credentials, env.awsRegion);
  const s3Client = createScopedS3Client(resolvedRegion, params.credentials);

  try {
    await s3Client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix || undefined,
        Delimiter: "/",
        MaxKeys: 1,
      }),
    );
    return { resolvedRegion };
  } catch (error) {
    throw new BadRequestError("Unable to access S3 bucket/prefix", {
      reason: toAwsErrorMessage(error),
    });
  }
}

export async function listS3Scope(params: ListS3ScopeParams): Promise<{
  prefix: string;
  items: S3ExplorerItem[];
  resolvedRegion: string;
}> {
  const bucket = normalizeBucket(params.bucket);
  const prefix = normalizePrefix(params.prefix);
  if (!bucket) {
    throw new BadRequestError("bucket is required");
  }

  const resolvedRegion = await resolveBucketRegion(bucket, params.credentials, env.awsRegion);
  const s3Client = createScopedS3Client(resolvedRegion, params.credentials);

  try {
    const response = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix || undefined,
        Delimiter: "/",
        MaxKeys: 200,
      }),
    );

    const folders: S3ExplorerItem[] = (response.CommonPrefixes ?? [])
      .map((entry) => entry.Prefix ?? "")
      .filter(Boolean)
      .map((folderPrefix) => {
        const sanitized = folderPrefix.endsWith("/") ? folderPrefix.slice(0, -1) : folderPrefix;
        const segments = sanitized.split("/");
        const name = segments[segments.length - 1] || sanitized;
        return {
          key: folderPrefix,
          name,
          type: "folder",
          size: null,
          lastModified: null,
          path: folderPrefix,
        };
      });

    const files: S3ExplorerItem[] = (response.Contents ?? [])
      .filter((entry) => Boolean(entry.Key))
      .map((entry) => {
        const key = String(entry.Key);
        const segments = key.split("/");
        const name = segments[segments.length - 1] || key;
        return {
          key,
          name,
          type: "file" as const,
          size: typeof entry.Size === "number" ? entry.Size : null,
          lastModified: entry.LastModified ? entry.LastModified.toISOString() : null,
          path: key,
        };
      })
      .filter((entry) => entry.path !== prefix);

    return {
      prefix,
      items: [...folders, ...files],
      resolvedRegion,
    };
  } catch (error) {
    throw new BadRequestError("Unable to browse S3 bucket contents", {
      reason: toAwsErrorMessage(error),
    });
  }
}

export async function validateSelectedObjectKeys(
  params: ValidateSelectedObjectKeysParams,
): Promise<ValidatedS3Object[]> {
  const bucket = normalizeBucket(params.bucket);
  const basePrefix = normalizePrefix(params.basePrefix);
  const objectKeys = Array.from(new Set(params.objectKeys.map(normalizeObjectKey).filter(Boolean)));

  if (!bucket) {
    throw new BadRequestError("bucket is required");
  }

  if (objectKeys.length === 0) {
    throw new BadRequestError("At least one object key is required");
  }

  const invalidKey = objectKeys.find((key) => key.startsWith("/") || key.includes("\\") || key.endsWith("/"));
  if (invalidKey) {
    throw new BadRequestError("Invalid selected object key", { key: invalidKey });
  }

  const outOfScopeKey = objectKeys.find((key) => !isKeyWithinScope(key, basePrefix));
  if (outOfScopeKey) {
    throw new BadRequestError("Selected object is outside allowed prefix", {
      key: outOfScopeKey,
      allowedPrefix: basePrefix,
    });
  }

  const resolvedRegion = await resolveBucketRegion(bucket, params.credentials, env.awsRegion);
  const s3Client = createScopedS3Client(resolvedRegion, params.credentials);

  const validatedObjects: ValidatedS3Object[] = [];
  for (const key of objectKeys) {
    console.log("[S3-UPLOAD-DEBUG][IMPORT][HEAD_OBJECT]", {
      tenantId: params.tenantId ?? null,
      userId: params.userId ?? null,
      sessionId: params.sessionId ?? null,
      ingestionRunId: null,
      key,
      bucket,
    });
    try {
      const headResult = await s3Client.send(
        new HeadObjectCommand({
          Bucket: bucket,
          Key: key,
        }),
      );

      validatedObjects.push({
        key,
        sizeBytes: Number(headResult.ContentLength ?? 0),
        lastModified: headResult.LastModified ?? null,
      });
    } catch (error) {
      console.error("[S3-UPLOAD-DEBUG][IMPORT][HEAD_OBJECT_FAILED]", {
        tenantId: params.tenantId ?? null,
        userId: params.userId ?? null,
        sessionId: params.sessionId ?? null,
        ingestionRunId: null,
        key,
        bucket,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new BadRequestError("Selected object is not accessible", {
        key,
        reason: toAwsErrorMessage(error),
      });
    }
  }

  return validatedObjects;
}

export async function getSourceS3ObjectStream(params: {
  credentials: AwsTempCredentials;
  bucket: string;
  key: string;
}): Promise<SourceS3ObjectStream> {
  const bucket = normalizeBucket(params.bucket);
  const key = normalizeObjectKey(params.key);
  if (!bucket || !key) {
    throw new BadRequestError("bucket and key are required");
  }

  const resolvedRegion = await resolveBucketRegion(bucket, params.credentials, env.awsRegion);
  const s3Client = createScopedS3Client(resolvedRegion, params.credentials);

  try {
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );

    const body = response.Body;
    if (!body) {
      throw new BadRequestError("Selected object stream is empty", { key });
    }

    const stream = body instanceof Readable ? body : null;

    if (!stream) {
      throw new BadRequestError("Selected object stream is not readable", { key });
    }

    return {
      stream,
      contentType: response.ContentType ?? null,
      contentLength: typeof response.ContentLength === "number" ? response.ContentLength : null,
      lastModified: response.LastModified ?? null,
    };
  } catch (error) {
    if (error instanceof BadRequestError) {
      throw error;
    }

    throw new BadRequestError("Unable to read selected S3 object", {
      key,
      reason: toAwsErrorMessage(error),
    });
  }
}

export const s3ScopeSecurity = {
  normalizePrefix,
  normalizeObjectKey,
  isKeyWithinScope,
};
