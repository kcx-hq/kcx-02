import path from "node:path";

import type { CreateS3UploadSessionInput, ImportS3UploadFilesInput, ListS3UploadSessionInput } from "./s3-upload.schema.js";
import {
  assumeRoleForUploadSession,
  getSourceS3ObjectStream,
  listS3Scope,
  s3ScopeSecurity,
  validateS3ScopeAccess,
  validateSelectedObjectKeys,
} from "./s3-upload-aws.service.js";
import { s3UploadSessionStore } from "./s3-upload-session.store.js";
import { BadRequestError, InternalServerError } from "../../../errors/http-errors.js";
import { BillingSource, CloudProvider } from "../../../models/index.js";
import {
  BILLING_SOURCE_SETUP_MODES,
  BILLING_SOURCE_TYPES,
} from "../../../models/billing-source.js";
import { createIngestionRun } from "../services/ingestion.service.js";
import { ingestionOrchestrator } from "../services/ingestion-orchestrator.service.js";
import {
  buildRawFileKey,
  createRawFileRecord,
  deleteFromS3,
  detectFileFormat,
  getProviderNameById,
  uploadStreamToS3,
} from "../services/raw-file.service.js";
import env from "../../../config/env.js";

type UserContext = {
  tenantId: string;
  userId: string;
};

type CreateSessionResult = {
  sessionId: string;
  bucket: string;
  basePrefix: string;
  expiresAt: Date;
  accountId: string | null;
  assumedArn: string | null;
};

type ListSessionResult = {
  sessionId: string;
  bucket: string;
  basePrefix: string;
  currentPrefix: string;
  expiresAt: Date;
  items: Array<{
    key: string;
    name: string;
    type: "folder" | "file";
    size: number | null;
    lastModified: string | null;
    path: string;
  }>;
};

type ImportSessionFilesResult = {
  sessionId: string;
  billingSourceId: string;
  selectedFileCount: number;
  rawFileIds: string[];
  ingestionRunIds: string[];
};

const TEMPORARY_SOURCE_TYPE: (typeof BILLING_SOURCE_TYPES)[number] = "s3";
const TEMPORARY_SETUP_MODE: (typeof BILLING_SOURCE_SETUP_MODES)[number] = "temporary";
const AWS_PROVIDER_CODE = "aws";

const formatSourceNameTimestamp = (date: Date): string => date.toISOString().replace("T", " ").slice(0, 19);

const buildTemporarySourceName = (): string => `Temporary S3 Upload ${formatSourceNameTimestamp(new Date())}`;

const getFileNameFromKey = (key: string): string => {
  const normalized = String(key ?? "").trim();
  return path.posix.basename(normalized);
};

const requireSingleFileFormat = (keys: string[]): "csv" | "parquet" => {
  const formats = Array.from(new Set(keys.map((key) => detectFileFormat(key))));
  if (formats.length !== 1) {
    throw new BadRequestError("Selected files must all have the same file format (csv or parquet)");
  }
  return formats[0];
};

const resolveAwsProviderId = async (): Promise<string> => {
  const [provider] = await CloudProvider.findOrCreate({
    where: { code: AWS_PROVIDER_CODE },
    defaults: {
      code: AWS_PROVIDER_CODE,
      name: "Amazon Web Services",
      status: "active",
    },
  });
  return String(provider.id);
};

const normalizeRequestedPrefixForList = (basePrefix: string, requestedPrefix: string): string => {
  const normalizedRequestedPrefix = s3ScopeSecurity.normalizePrefix(requestedPrefix);
  if (!normalizedRequestedPrefix) return basePrefix;

  if (!s3ScopeSecurity.isKeyWithinScope(normalizedRequestedPrefix, basePrefix)) {
    throw new BadRequestError("Requested prefix is outside allowed session scope");
  }

  return normalizedRequestedPrefix;
};

export async function createTemporaryS3UploadSession(
  input: CreateS3UploadSessionInput,
  user: UserContext,
): Promise<CreateSessionResult> {
  const normalizedPrefix = s3ScopeSecurity.normalizePrefix(input.prefix);
  const normalizedBucket = String(input.bucket ?? "").trim();
  const normalizedRoleArn = String(input.roleArn ?? "").trim();
  const normalizedExternalId = String(input.externalId ?? "").trim();

  console.log("[S3-UPLOAD-DEBUG][SESSION_CREATE][START]", {
    tenantId: user.tenantId,
    userId: user.userId,
    sessionId: null,
    ingestionRunId: null,
    roleArn: normalizedRoleArn,
    bucket: normalizedBucket,
    prefix: normalizedPrefix,
    externalIdPresent: Boolean(normalizedExternalId),
  });

  try {
    const assumeRoleResult = await assumeRoleForUploadSession({
      roleArn: normalizedRoleArn,
      externalId: normalizedExternalId || undefined,
    });

    console.log("[S3-UPLOAD-DEBUG][SESSION_CREATE][STS_SUCCESS]", {
      tenantId: user.tenantId,
      userId: user.userId,
      sessionId: null,
      ingestionRunId: null,
      assumedRoleArn: assumeRoleResult.assumedArn,
      accountId: assumeRoleResult.accountId,
      bucket: normalizedBucket,
      key: normalizedPrefix || null,
    });

    const validationResult = await validateS3ScopeAccess({
      credentials: assumeRoleResult.credentials,
      bucket: normalizedBucket,
      prefix: normalizedPrefix,
    });

    console.log("[S3-UPLOAD-DEBUG][SESSION_CREATE][S3_ACCESS_OK]", {
      tenantId: user.tenantId,
      userId: user.userId,
      sessionId: null,
      ingestionRunId: null,
      bucket: normalizedBucket,
      key: normalizedPrefix || null,
      prefix: normalizedPrefix,
    });

    const session = s3UploadSessionStore.create({
      tenantId: user.tenantId,
      userId: user.userId,
      roleArn: normalizedRoleArn,
      externalId: normalizedExternalId || null,
      bucket: normalizedBucket,
      basePrefix: normalizedPrefix,
      resolvedRegion: validationResult.resolvedRegion,
      credentials: assumeRoleResult.credentials,
    });

    return {
      sessionId: session.sessionId,
      bucket: session.bucket,
      basePrefix: session.basePrefix,
      expiresAt: session.expiresAt,
      accountId: assumeRoleResult.accountId,
      assumedArn: assumeRoleResult.assumedArn,
    };
  } catch (error) {
    console.error("[S3-UPLOAD-DEBUG][SESSION_CREATE][ERROR]", {
      tenantId: user.tenantId,
      userId: user.userId,
      sessionId: null,
      ingestionRunId: null,
      bucket: normalizedBucket,
      key: normalizedPrefix || null,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

export async function listTemporaryS3UploadSessionScope(
  sessionId: string,
  input: ListS3UploadSessionInput,
  user: UserContext,
): Promise<ListSessionResult> {
  const session = s3UploadSessionStore.getOwnedActiveOrThrow({
    sessionId,
    tenantId: user.tenantId,
    userId: user.userId,
  });

  const currentPrefix = normalizeRequestedPrefixForList(session.basePrefix, input.prefix ?? "");

  const listResult = await listS3Scope({
    credentials: session.credentials,
    bucket: session.bucket,
    prefix: currentPrefix,
  });

  return {
    sessionId: session.sessionId,
    bucket: session.bucket,
    basePrefix: session.basePrefix,
    currentPrefix: listResult.prefix,
    expiresAt: session.expiresAt,
    items: listResult.items,
  };
}

export async function importFilesFromTemporaryS3UploadSession(
  sessionId: string,
  input: ImportS3UploadFilesInput,
  user: UserContext,
): Promise<ImportSessionFilesResult> {
  console.log("[S3-UPLOAD-DEBUG][IMPORT][START]", {
    tenantId: user.tenantId,
    userId: user.userId,
    sessionId,
    ingestionRunId: null,
    selectedKeysCount: input.objectKeys.length,
    keys: input.objectKeys,
  });

  const session = s3UploadSessionStore.getOwnedActiveOrThrow({
    sessionId,
    tenantId: user.tenantId,
    userId: user.userId,
  });

  const validatedObjects = await validateSelectedObjectKeys({
    credentials: session.credentials,
    bucket: session.bucket,
    basePrefix: session.basePrefix,
    objectKeys: input.objectKeys,
    tenantId: user.tenantId,
    userId: user.userId,
    sessionId,
  });

  console.log("[S3-UPLOAD-DEBUG][IMPORT][VALIDATION_COMPLETE]", {
    tenantId: user.tenantId,
    userId: user.userId,
    sessionId,
    ingestionRunId: null,
    bucket: session.bucket,
    key: session.basePrefix || null,
    validKeys: validatedObjects.length,
  });

  if (validatedObjects.length === 0) {
    throw new BadRequestError("No valid S3 objects selected for import");
  }

  const normalizedObjectKeys = validatedObjects.map((entry) => entry.key);
  const fileFormat = requireSingleFileFormat(normalizedObjectKeys);
  const cloudProviderId = await resolveAwsProviderId();
  const rawStorageBucket = env.rawBillingFilesBucket;
  if (!rawStorageBucket) {
    throw new InternalServerError("RAW_BILLING_FILES_BUCKET is not configured");
  }

  const providerName = await getProviderNameById(cloudProviderId);

  let billingSourceId = "";
  try {
    const billingSource = await BillingSource.create({
      tenantId: user.tenantId,
      cloudConnectionId: null,
      cloudProviderId,
      sourceName: buildTemporarySourceName(),
      sourceType: TEMPORARY_SOURCE_TYPE,
      setupMode: TEMPORARY_SETUP_MODE,
      format: fileFormat,
      schemaType: "focus",
      isTemporary: true,
      bucketName: session.bucket,
      pathPrefix: session.basePrefix || null,
      filePattern: null,
      cadence: "manual",
      status: "active",
    });
    billingSourceId = String(billingSource.id);
  } catch (error) {
    console.error("[S3-UPLOAD-DEBUG][DB][TRANSACTION_FAILED]", {
      tenantId: user.tenantId,
      userId: user.userId,
      sessionId,
      ingestionRunId: null,
      bucket: session.bucket,
      key: session.basePrefix || null,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw new InternalServerError("Failed to create temporary S3 upload records", {
      reason: error instanceof Error ? error.message : String(error),
    });
  }

  console.log("[S3-UPLOAD-DEBUG][DB][SOURCE_CREATED]", {
    tenantId: user.tenantId,
    userId: user.userId,
    sessionId,
    ingestionRunId: null,
    billingSourceId,
    sourceType: "s3",
    setupMode: "temporary",
    bucket: session.bucket,
    prefix: session.basePrefix,
    key: session.basePrefix || null,
  });

  const rawFileIds: string[] = [];
  const ingestionRunIds: string[] = [];
  const failedKeys: Array<{ key: string; reason: string }> = [];

  for (const objectInfo of validatedObjects) {
    const sourceKey = objectInfo.key;
    const fileName = getFileNameFromKey(sourceKey);
    const fileFormatForKey = detectFileFormat(sourceKey);
    const destinationKey = buildRawFileKey({
      tenantId: user.tenantId,
      providerName,
      sourceType: "s3_upload",
      fileName,
    });

    console.log("[S3-UPLOAD-DEBUG][COPY][START]", {
      tenantId: user.tenantId,
      userId: user.userId,
      sessionId,
      ingestionRunId: null,
      sourceBucket: session.bucket,
      sourceKey,
      destinationBucket: rawStorageBucket,
      destinationKey,
    });

    let copied = false;
    try {
      const sourceObject = await getSourceS3ObjectStream({
        credentials: session.credentials,
        bucket: session.bucket,
        key: sourceKey,
      });

      console.log("[S3-UPLOAD-DEBUG][IMPORT][SOURCE_OBJECT_VALIDATED]", {
        tenantId: user.tenantId,
        userId: user.userId,
        sessionId,
        ingestionRunId: null,
        bucket: session.bucket,
        key: sourceKey,
        contentLength: sourceObject.contentLength,
        contentType: sourceObject.contentType,
      });

      await uploadStreamToS3({
        stream: sourceObject.stream,
        mimeType: sourceObject.contentType,
        bucket: rawStorageBucket,
        key: destinationKey,
        contentLength:
          typeof objectInfo.sizeBytes === "number" && objectInfo.sizeBytes >= 0
            ? objectInfo.sizeBytes
            : sourceObject.contentLength,
      });
      copied = true;

      console.log("[S3-UPLOAD-DEBUG][COPY][SUCCESS]", {
        tenantId: user.tenantId,
        userId: user.userId,
        sessionId,
        ingestionRunId: null,
        sourceBucket: session.bucket,
        sourceKey,
        destinationBucket: rawStorageBucket,
        destinationKey,
      });
    } catch (error) {
      console.error("[S3-UPLOAD-DEBUG][COPY][FAILED]", {
        tenantId: user.tenantId,
        userId: user.userId,
        sessionId,
        ingestionRunId: null,
        sourceBucket: session.bucket,
        sourceKey,
        destinationBucket: rawStorageBucket,
        destinationKey,
        message: error instanceof Error ? error.message : String(error),
      });
      failedKeys.push({
        key: sourceKey,
        reason: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    let rawFile = null;
    try {
      rawFile = await createRawFileRecord({
        billingSourceId,
        tenantId: user.tenantId,
        cloudProviderId,
        sourceType: TEMPORARY_SOURCE_TYPE,
        setupMode: TEMPORARY_SETUP_MODE,
        uploadedBy: user.userId,
        originalFileName: fileName,
        originalFilePath: sourceKey,
        rawStorageBucket,
        rawStorageKey: destinationKey,
        fileFormat: fileFormatForKey,
        fileSizeBytes: String(Math.max(0, objectInfo.sizeBytes)),
        status: "stored",
      });

      console.log("[S3-UPLOAD-DEBUG][DB][RAW_FILE_CREATED]", {
        tenantId: user.tenantId,
        userId: user.userId,
        sessionId,
        ingestionRunId: null,
        rawFileId: String(rawFile.id),
        key: destinationKey,
        bucket: rawStorageBucket,
        fileFormat: fileFormatForKey,
      });
    } catch (error) {
      if (copied) {
        try {
          console.log("[S3-UPLOAD-DEBUG][CLEANUP][DELETE_COPIED_OBJECT]", {
            tenantId: user.tenantId,
            userId: user.userId,
            sessionId,
            ingestionRunId: null,
            bucket: rawStorageBucket,
            key: destinationKey,
            reason: "raw_file_record_creation_failed",
          });
          await deleteFromS3(rawStorageBucket, destinationKey);
        } catch (cleanupError) {
          console.error("[S3-UPLOAD-DEBUG][CLEANUP][DELETE_COPIED_OBJECT][FAILED]", {
            tenantId: user.tenantId,
            userId: user.userId,
            sessionId,
            ingestionRunId: null,
            bucket: rawStorageBucket,
            key: destinationKey,
            message: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
          });
        }
      }

      failedKeys.push({
        key: sourceKey,
        reason: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    try {
      const run = await createIngestionRun({
        billingSourceId,
        rawBillingFileId: String(rawFile.id),
      });
      rawFileIds.push(String(rawFile.id));
      ingestionRunIds.push(String(run.id));

      console.log("[S3-UPLOAD-DEBUG][INGESTION][RUN_CREATED]", {
        tenantId: user.tenantId,
        userId: user.userId,
        sessionId,
        ingestionRunId: String(run.id),
        rawFileId: String(rawFile.id),
        bucket: rawStorageBucket,
        key: destinationKey,
        format: fileFormatForKey,
      });

      setImmediate(() => {
        void ingestionOrchestrator.processIngestionRun(run.id);
      });
    } catch (error) {
      try {
        console.log("[S3-UPLOAD-DEBUG][CLEANUP][DELETE_COPIED_OBJECT]", {
          tenantId: user.tenantId,
          userId: user.userId,
          sessionId,
          ingestionRunId: null,
          bucket: rawStorageBucket,
          key: destinationKey,
          reason: "ingestion_run_creation_failed",
        });
        await deleteFromS3(rawStorageBucket, destinationKey);
      } catch (cleanupError) {
        console.error("[S3-UPLOAD-DEBUG][CLEANUP][DELETE_COPIED_OBJECT][FAILED]", {
          tenantId: user.tenantId,
          userId: user.userId,
          sessionId,
          ingestionRunId: null,
          bucket: rawStorageBucket,
          key: destinationKey,
          message: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
        });
      }

      try {
        await rawFile.destroy();
      } catch {
        // Best-effort cleanup only.
      }

      failedKeys.push({
        key: sourceKey,
        reason: error instanceof Error ? error.message : String(error),
      });
      continue;
    }
  }

  if (rawFileIds.length === 0 || ingestionRunIds.length === 0) {
    throw new BadRequestError("No files were imported successfully", {
      failedKeys,
    });
  }

  return {
    sessionId: session.sessionId,
    billingSourceId,
    selectedFileCount: ingestionRunIds.length,
    rawFileIds,
    ingestionRunIds,
  };
}
