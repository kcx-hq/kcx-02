import path from "node:path";
import type { Readable } from "node:stream";

import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import env from "../../../config/env.js";
import { BadRequestError, InternalServerError, NotFoundError } from "../../../errors/http-errors.js";
import { BillingSource, CloudProvider, RawBillingFile } from "../../../models/index.js";

export type ManualUploadFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
};

type BuildRawFileKeyParams = {
  tenantId: string;
  providerName: string;
  sourceType: string;
  fileName: string;
};

type UploadToS3Params = {
  buffer: Buffer;
  mimeType: string;
  bucket: string;
  key: string;
};

type UploadStreamToS3Params = {
  stream: Readable;
  mimeType?: string | null;
  bucket: string;
  key: string;
  contentLength?: number | null;
};

type CreateRawFileRecordParams = {
  billingSourceId: string;
  tenantId: string;
  cloudProviderId: string;
  sourceType: string;
  setupMode: string;
  uploadedBy?: string | null;
  originalFileName: string;
  originalFilePath: string | null;
  rawStorageBucket: string;
  rawStorageKey: string;
  fileFormat: string;
  fileSizeBytes: string;
  status: string;
};

type StoreManualFileParams = {
  file: ManualUploadFile;
  billingSourceId: string | number;
  tenantId: string;
  uploadedByUserId?: string | null;
};

type StoreManualFileResult = {
  rawFileId: string;
  bucket: string;
  key: string;
  format: "csv" | "parquet";
  status: string;
};

const SUPPORTED_FORMATS = new Set(["csv", "parquet"] as const);

const s3Client = new S3Client({
  region: env.awsRegion,
  endpoint: env.awsS3Endpoint,
  forcePathStyle: env.awsS3ForcePathStyle,
  credentials:
    env.awsAccessKeyId && env.awsSecretAccessKey
      ? {
          accessKeyId: env.awsAccessKeyId,
          secretAccessKey: env.awsSecretAccessKey,
          ...(env.awsSessionToken ? { sessionToken: env.awsSessionToken } : {}),
        }
      : undefined,
});

const toKeySegment = (value: string): string => {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized.length > 0 ? normalized : "unknown";
};

const normalizeCloudProviderIdOrThrow = (cloudProviderId: string): string => {
  const normalizedCloudProviderId = String(cloudProviderId ?? "").trim();

  if (!/^\d+$/.test(normalizedCloudProviderId)) {
    throw new BadRequestError("Invalid cloudProviderId");
  }

  return normalizedCloudProviderId;
};

export function detectFileFormat(fileName: string): "csv" | "parquet" {
  const extension = path.extname(fileName).replace(".", "").toLowerCase();

  if (SUPPORTED_FORMATS.has(extension as "csv" | "parquet")) {
    return extension as "csv" | "parquet";
  }

  throw new BadRequestError("Unsupported format. Only csv and parquet files are allowed");
}

export function buildRawFileKey({ tenantId, providerName, sourceType, fileName }: BuildRawFileKeyParams): string {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const timestamp = String(now.getTime());

  return [
    toKeySegment(tenantId),
    toKeySegment(providerName),
    toKeySegment(sourceType),
    year,
    month,
    day,
    `${timestamp}_${toKeySegment(fileName)}`,
  ].join("/");
}

export async function getProviderNameById(cloudProviderId: string): Promise<string> {
  const normalizedCloudProviderId = normalizeCloudProviderIdOrThrow(cloudProviderId);

  const provider = await CloudProvider.findByPk(normalizedCloudProviderId, {
    attributes: ["id", "name"],
  });

  if (!provider) {
    throw new BadRequestError("Invalid cloudProviderId");
  }

  return provider.name;
}

export async function uploadToS3({ buffer, mimeType, bucket, key }: UploadToS3Params): Promise<void> {
  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      }),
    );
  } catch (error) {
    throw new InternalServerError("Failed to upload file to S3", {
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function uploadStreamToS3({
  stream,
  mimeType,
  bucket,
  key,
  contentLength,
}: UploadStreamToS3Params): Promise<void> {
  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: stream,
        ...(mimeType ? { ContentType: mimeType } : {}),
        ...(typeof contentLength === "number" && Number.isFinite(contentLength) && contentLength >= 0
          ? { ContentLength: Math.floor(contentLength) }
          : {}),
      }),
    );
  } catch (error) {
    throw new InternalServerError("Failed to upload file stream to S3", {
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function deleteFromS3(bucket: string, key: string): Promise<void> {
  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );
  } catch (error) {
    throw new InternalServerError("Failed to delete file from S3", {
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function createRawFileRecord(params: CreateRawFileRecordParams) {
  try {
    return await RawBillingFile.create({
      billingSourceId: params.billingSourceId,
      tenantId: params.tenantId,
      cloudProviderId: params.cloudProviderId,
      sourceType: params.sourceType,
      setupMode: params.setupMode,
      uploadedBy: params.uploadedBy ?? null,
      originalFileName: params.originalFileName,
      originalFilePath: params.originalFilePath,
      rawStorageBucket: params.rawStorageBucket,
      rawStorageKey: params.rawStorageKey,
      fileFormat: params.fileFormat,
      fileSizeBytes: params.fileSizeBytes,
      status: params.status,
    });
  } catch (error) {
    throw new InternalServerError("Failed to insert raw_billing_files record", {
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function storeManualFile({
  file,
  billingSourceId,
  tenantId,
  uploadedByUserId,
}: StoreManualFileParams): Promise<StoreManualFileResult> {
  if (!file || !file.buffer || file.buffer.length === 0) {
    throw new BadRequestError("Missing file in upload request");
  }

  if (!env.rawBillingFilesBucket) {
    // Assumption: bucket should be environment-driven for production deploys.
    throw new InternalServerError("RAW_BILLING_FILES_BUCKET is not configured");
  }

  const normalizedBillingSourceId = String(billingSourceId).trim();
  if (!normalizedBillingSourceId) {
    throw new NotFoundError("Billing source not found");
  }

  const billingSource = await BillingSource.findByPk(normalizedBillingSourceId);
  if (!billingSource || billingSource.tenantId !== tenantId) {
    throw new NotFoundError("Billing source not found");
  }

  if (!billingSource.cloudProviderId) {
    throw new BadRequestError("Billing source has invalid cloud_provider_id");
  }

  const providerName = await getProviderNameById(billingSource.cloudProviderId);
  const format = detectFileFormat(file.originalname);

  const key = buildRawFileKey({
    tenantId,
    providerName,
    sourceType: "manual_upload",
    fileName: file.originalname,
  });

  await uploadToS3({
    buffer: file.buffer,
    mimeType: file.mimetype || "application/octet-stream",
    bucket: env.rawBillingFilesBucket,
    key,
  });

  const rawFile = await createRawFileRecord({
    billingSourceId: normalizedBillingSourceId,
    tenantId,
    cloudProviderId: billingSource.cloudProviderId,
    sourceType: billingSource.sourceType,
    setupMode: billingSource.setupMode,
    uploadedBy: uploadedByUserId ?? null,
    originalFileName: file.originalname,
    originalFilePath: null,
    rawStorageBucket: env.rawBillingFilesBucket,
    rawStorageKey: key,
    fileFormat: format,
    fileSizeBytes: String(file.size),
    status: "stored",
  });

  return {
    rawFileId: rawFile.id,
    bucket: env.rawBillingFilesBucket,
    key,
    format,
    status: rawFile.status,
  };
}
