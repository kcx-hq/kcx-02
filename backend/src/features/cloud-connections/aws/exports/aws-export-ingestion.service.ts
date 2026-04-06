import path from "node:path";
import crypto from "node:crypto";
import { Op } from "sequelize";

import env from "../../../../config/env.js";
import { BadRequestError, InternalServerError, NotFoundError } from "../../../../errors/http-errors.js";
import {
  BillingIngestionRun,
  BillingIngestionRunFile,
  BillingSource,
  CloudConnectionV2,
  RawBillingFile,
  sequelize,
} from "../../../../models/index.js";
import { logger } from "../../../../utils/logger.js";
import type { IngestionRunFileLink } from "../../../billing/services/ingestion-run-file.service.js";
import { ingestionOrchestrator } from "../../../billing/services/ingestion-orchestrator.service.js";
import { createIngestionRun, getIngestionRunById } from "../../../billing/services/ingestion.service.js";
import {
  createRawFileRecord,
  detectFileFormat,
  getProviderNameById,
  uploadToS3,
} from "../../../billing/services/raw-file.service.js";
import { parseCsv, parseParquet } from "../../../billing/services/file-reader.service.js";
import { downloadExportFile, listExportFiles } from "../infrastructure/aws-export-reader.service.js";
import { parseAndValidateAwsManifest } from "./aws-export-manifest.validator.js";
import type { AwsManifestPayload, QueueManifestResult } from "./aws-export-ingestion.types.js";

type BillingSourceInstance = InstanceType<typeof BillingSource>;
type CloudConnectionInstance = InstanceType<typeof CloudConnectionV2>;

type ManualIngestionResult = {
  fileKey: string;
  recordsProcessed: number;
  message: string;
};

type InitialBackfillSummary = {
  filesFound: number;
  filesQueued: number;
  filesSkipped: number;
};

type IngestionContext = {
  connection: CloudConnectionInstance;
  billingSource: BillingSourceInstance;
  exportRegion: string;
  exportBucket: string;
};

const resolveExportRegion = (connection: CloudConnectionInstance): string => {
  return (
    String(connection.exportRegion ?? "").trim() ||
    String(connection.region ?? "").trim() ||
    env.awsRegion ||
    "us-east-1"
  );
};

const requireNonEmpty = (value: string | null | undefined, fieldName: string): string => {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    throw new BadRequestError(`Missing required AWS export field: ${fieldName}`);
  }
  return normalized;
};

const normalizePrefix = (prefix: string | null | undefined): string => {
  const normalized = String(prefix ?? "").trim();
  if (!normalized) return "";
  return normalized.startsWith("/") ? normalized.slice(1) : normalized;
};

const normalizeEtag = (etag: string | null | undefined): string | null => {
  const normalized = String(etag ?? "").trim();
  if (!normalized) return null;
  return normalized.replace(/^"+|"+$/g, "");
};

const resolveExportContext = (connection: CloudConnectionInstance, source: BillingSourceInstance): IngestionContext => {
  const exportBucket = requireNonEmpty(source.bucketName ?? connection.exportBucket, "export bucket");
  requireNonEmpty(connection.roleArn, "roleArn");
  const exportRegion = resolveExportRegion(connection);

  return {
    connection,
    billingSource: source,
    exportRegion,
    exportBucket,
  };
};

const buildRawStorageKey = ({
  tenantId,
  providerName,
  key,
}: {
  tenantId: string;
  providerName: string;
  key: string;
}): string => {
  const fileName = path.basename(key);
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const timestamp = String(now.getTime());

  const slug = (value: string): string => {
    const normalized = value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
    return normalized || "unknown";
  };

  return [
    slug(tenantId),
    slug(providerName),
    "aws_data_exports_manual",
    year,
    month,
    day,
    `${timestamp}_${slug(fileName)}`,
  ].join("/");
};

const pickLatestFileKey = (files: Array<{ key: string; lastModified: Date | null }>): string => {
  const candidates = files.filter((file) => file.key && !file.key.endsWith("/"));
  if (candidates.length === 0) {
    throw new NotFoundError("No export files found for the configured bucket/prefix");
  }

  candidates.sort((a, b) => {
    const aTime = a.lastModified ? a.lastModified.getTime() : 0;
    const bTime = b.lastModified ? b.lastModified.getTime() : 0;
    if (aTime !== bTime) return bTime - aTime;
    return b.key.localeCompare(a.key);
  });

  return candidates[0].key;
};

const resolveFileFormat = (billingSource: BillingSourceInstance, fileKey: string): "csv" | "parquet" => {
  const sourceFormat = String(billingSource.format ?? "")
    .trim()
    .toLowerCase();

  if (sourceFormat === "csv" || sourceFormat === "parquet") {
    return sourceFormat;
  }

  return detectFileFormat(fileKey);
};

const resolveBackfillFileFormat = (billingSource: BillingSourceInstance, fileKey: string): "csv" | "parquet" => {
  const configuredFormat = String(billingSource.format ?? "")
    .trim()
    .toLowerCase();

  if (configuredFormat === "csv" || configuredFormat === "parquet") {
    return configuredFormat;
  }

  const extension = path.extname(fileKey).replace(".", "").toLowerCase();
  if (extension === "csv" || extension === "parquet") {
    return extension;
  }

  return "parquet";
};

const estimateRowsFromFileContent = async ({
  fileFormat,
  fileBuffer,
}: {
  fileFormat: "csv" | "parquet";
  fileBuffer: Buffer;
}): Promise<number> => {
  try {
    if (fileFormat === "csv") {
      const rows = await parseCsv(fileBuffer);
      return Array.isArray(rows) ? rows.length : 0;
    }

    const rows = await parseParquet(fileBuffer);
    return Array.isArray(rows) ? rows.length : 0;
  } catch {
    return 0;
  }
};

const loadConnectionAndSource = async (
  connectionId: string,
): Promise<{ connection: CloudConnectionInstance; billingSource: BillingSourceInstance }> => {
  const normalizedConnectionId = String(connectionId ?? "").trim();
  if (!normalizedConnectionId) {
    throw new BadRequestError("connectionId is required");
  }

  const connection = await CloudConnectionV2.findByPk(normalizedConnectionId);
  if (!connection) {
    throw new NotFoundError("Cloud connection not found");
  }

  const billingSource = await BillingSource.findOne({
    where: { cloudConnectionId: connection.id },
    order: [["updatedAt", "DESC"]],
  });
  if (!billingSource) {
    throw new NotFoundError("Billing source not found for connection");
  }

  return {
    connection,
    billingSource,
  };
};

async function ingestResolvedFile({
  connection,
  billingSource,
  exportRegion,
  exportBucket,
  fileKey,
}: IngestionContext & { fileKey: string }): Promise<ManualIngestionResult> {
  if (!env.rawBillingFilesBucket) {
    throw new InternalServerError("RAW_BILLING_FILES_BUCKET is not configured");
  }

  const downloadedBodyBase64 = await downloadExportFile({
    roleArn: requireNonEmpty(connection.roleArn, "roleArn"),
    externalId: connection.externalId ?? null,
    region: exportRegion,
    bucket: exportBucket,
    key: fileKey,
  });

  const fileBuffer = Buffer.from(downloadedBodyBase64, "base64");
  const fileFormat = resolveFileFormat(billingSource, fileKey);
  const providerName = await getProviderNameById(String(billingSource.cloudProviderId));
  const rawStorageKey = buildRawStorageKey({
    tenantId: billingSource.tenantId,
    providerName,
    key: fileKey,
  });

  await uploadToS3({
    buffer: fileBuffer,
    mimeType: fileFormat === "csv" ? "text/csv" : "application/octet-stream",
    bucket: env.rawBillingFilesBucket,
    key: rawStorageKey,
  });

  const rawFile = await createRawFileRecord({
    billingSourceId: String(billingSource.id),
    tenantId: billingSource.tenantId,
    cloudProviderId: String(billingSource.cloudProviderId),
    sourceType: billingSource.sourceType,
    setupMode: billingSource.setupMode,
    uploadedBy: connection.createdBy ?? null,
    originalFileName: path.basename(fileKey),
    originalFilePath: fileKey,
    rawStorageBucket: env.rawBillingFilesBucket,
    rawStorageKey,
    fileFormat,
    fileSizeBytes: String(fileBuffer.length),
    status: "stored",
  });

  const ingestionRun = await createIngestionRun({
    billingSourceId: String(billingSource.id),
    rawBillingFileId: String(rawFile.id),
  });

  await ingestionOrchestrator.processIngestionRun(ingestionRun.id);

  const finalRun = await getIngestionRunById(ingestionRun.id);
  const fallbackRowCount = await estimateRowsFromFileContent({
    fileFormat,
    fileBuffer,
  });
  const rowsProcessed = Number(finalRun?.rowsLoaded ?? fallbackRowCount ?? 0);

  await billingSource.update({
    lastFileReceivedAt: new Date(),
    status: "active",
    lastIngestedAt: new Date(),
  });

  return {
    fileKey,
    recordsProcessed: rowsProcessed,
    message: "Manual AWS export ingestion completed",
  };
}

type QueueInitialBackfillFileParams = {
  billingSource: BillingSourceInstance;
  connection: CloudConnectionInstance;
  exportBucket: string;
  file: {
    key: string;
    size: number;
    etag: string | null;
    lastModified: Date | null;
  };
};

type QueueRawFileAndIngestionRunParams = {
  billingSource: BillingSourceInstance;
  connection: CloudConnectionInstance;
  originalFilePath: string;
  rawStorageBucket: string;
  rawStorageKey: string;
  fileFormat: "csv" | "parquet";
  statusMessage: string;
  checksum?: string | null;
  fileSizeBytes?: string | null;
};

const queueRawFileAndIngestionRun = async ({
  billingSource,
  connection,
  originalFilePath,
  rawStorageBucket,
  rawStorageKey,
  fileFormat,
  statusMessage,
  checksum = null,
  fileSizeBytes = null,
}: QueueRawFileAndIngestionRunParams): Promise<{
  rawBillingFileId: string;
  ingestionRunId: string;
}> => {
  return sequelize.transaction(async (transaction) => {
    const rawBillingFile = await RawBillingFile.create(
      {
        billingSourceId: String(billingSource.id),
        tenantId: billingSource.tenantId,
        cloudProviderId: String(billingSource.cloudProviderId),
        sourceType: billingSource.sourceType,
        setupMode: billingSource.setupMode,
        uploadedBy: connection.createdBy ?? null,
        originalFileName: path.basename(originalFilePath),
        originalFilePath,
        rawStorageBucket,
        rawStorageKey,
        fileFormat,
        fileSizeBytes,
        checksum,
        status: "queued",
      },
      { transaction },
    );

    const ingestionRun = await BillingIngestionRun.create(
      {
        billingSourceId: String(billingSource.id),
        rawBillingFileId: String(rawBillingFile.id),
        status: "queued",
        rowsRead: 0,
        rowsLoaded: 0,
        rowsFailed: 0,
        progressPercent: 0,
        currentStep: "queued",
        statusMessage,
      },
      { transaction },
    );

    await BillingIngestionRunFile.create(
      {
        ingestionRunId: String(ingestionRun.id),
        rawBillingFileId: String(rawBillingFile.id),
        fileRole: "data",
        processingOrder: 0,
      },
      { transaction },
    );

    return {
      rawBillingFileId: String(rawBillingFile.id),
      ingestionRunId: String(ingestionRun.id),
    };
  });
};

export async function queueInitialBackfillFile({
  billingSource,
  connection,
  exportBucket,
  file,
}: QueueInitialBackfillFileParams): Promise<void> {
  const fileFormat = resolveBackfillFileFormat(billingSource, file.key);
  const normalizedEtag = normalizeEtag(file.etag);

  await queueRawFileAndIngestionRun({
    billingSource,
    connection,
    originalFilePath: file.key,
    rawStorageBucket: exportBucket,
    rawStorageKey: file.key,
    fileFormat,
    checksum: normalizedEtag,
    fileSizeBytes: String(file.size),
    statusMessage: "Queued by initial AWS export backfill",
  });
}

type QueueExportFileFromEventParams = {
  callbackToken: string;
  accountId: string;
  region: string;
  roleArn: string;
  bucketName: string;
  objectKey: string;
};

type QueueExportFileFromEventResult = {
  queued: boolean;
  skipped: boolean;
  reason?: string;
  rawBillingFileId?: string;
  ingestionRunId?: string;
};

const MANIFEST_RAW_FILE_FORMAT = "manifest_json";

const assertManifestObjectKey = (objectKey: string): string => {
  const normalized = requireNonEmpty(objectKey, "objectKey");
  if (!normalized.toLowerCase().endsWith("manifest.json")) {
    throw new BadRequestError("Manifest callback must reference a Manifest.json object");
  }
  return normalized;
};

const resolveBillingSourceForConnection = async (connectionId: string) => {
  const billingSource = await BillingSource.findOne({
    where: { cloudConnectionId: connectionId },
    order: [["updatedAt", "DESC"]],
  });
  if (!billingSource) {
    throw new NotFoundError("Billing source not found for connection");
  }

  return billingSource;
};

const findExistingManifestRun = async ({
  billingSourceId,
  manifestObjectKey,
}: {
  billingSourceId: string;
  manifestObjectKey: string;
}): Promise<{ ingestionRunId: string; manifestRawBillingFileId: string } | null> => {
  const existingManifestFile = await RawBillingFile.findOne({
    where: {
      billingSourceId,
      originalFilePath: manifestObjectKey,
      fileFormat: MANIFEST_RAW_FILE_FORMAT,
    },
    order: [["createdAt", "DESC"]],
  });

  if (!existingManifestFile) {
    return null;
  }

  const existingRunLink = await BillingIngestionRunFile.findOne({
    where: {
      rawBillingFileId: String(existingManifestFile.id),
      fileRole: "manifest",
    },
    order: [["createdAt", "DESC"]],
  });

  if (!existingRunLink) {
    return null;
  }

  return {
    ingestionRunId: String(existingRunLink.ingestionRunId),
    manifestRawBillingFileId: String(existingManifestFile.id),
  };
};

const registerManifestBatchInTransaction = async ({
  billingSource,
  connection,
  bucketName,
  parsedManifest,
  manifestObjectKey,
  normalizedRegion,
}: {
  billingSource: BillingSourceInstance;
  connection: CloudConnectionInstance;
  bucketName: string;
  parsedManifest: ReturnType<typeof parseAndValidateAwsManifest>;
  manifestObjectKey: string;
  normalizedRegion: string;
}): Promise<QueueManifestResult> => {
  return sequelize.transaction(async (transaction) => {
    const manifestChecksum = crypto.createHash("sha256").update(JSON.stringify(parsedManifest.rawManifest)).digest("hex");

    const manifestRawFile = await RawBillingFile.create(
      {
        billingSourceId: String(billingSource.id),
        tenantId: billingSource.tenantId,
        cloudProviderId: String(billingSource.cloudProviderId),
        sourceType: billingSource.sourceType,
        setupMode: billingSource.setupMode,
        uploadedBy: connection.createdBy ?? null,
        originalFileName: path.basename(manifestObjectKey),
        originalFilePath: manifestObjectKey,
        rawStorageBucket: bucketName,
        rawStorageKey: manifestObjectKey,
        fileFormat: MANIFEST_RAW_FILE_FORMAT,
        fileSizeBytes: null,
        checksum: manifestChecksum,
        status: "queued",
      },
      { transaction },
    );

    const dataRawFiles: Array<InstanceType<typeof RawBillingFile>> = [];
    for (const file of parsedManifest.files) {
      const dataRawFile = await RawBillingFile.create(
        {
          billingSourceId: String(billingSource.id),
          tenantId: billingSource.tenantId,
          cloudProviderId: String(billingSource.cloudProviderId),
          sourceType: billingSource.sourceType,
          setupMode: billingSource.setupMode,
          uploadedBy: connection.createdBy ?? null,
          originalFileName: path.basename(file.key),
          originalFilePath: file.key,
          rawStorageBucket: bucketName,
          rawStorageKey: file.key,
          fileFormat: "parquet",
          fileSizeBytes: file.sizeBytes === null ? null : String(file.sizeBytes),
          checksum: file.checksum,
          status: "queued",
        },
        { transaction },
      );

      dataRawFiles.push(dataRawFile);
    }

    const ingestionRun = await BillingIngestionRun.create(
      {
        billingSourceId: String(billingSource.id),
        rawBillingFileId: String(manifestRawFile.id),
        status: "queued",
        rowsRead: 0,
        rowsLoaded: 0,
        rowsFailed: 0,
        progressPercent: 0,
        currentStep: "queued",
        statusMessage: "Queued by AWS manifest_created callback",
      },
      { transaction },
    );

    const runFileLinks: IngestionRunFileLink[] = [
      {
        ingestionRunId: String(ingestionRun.id),
        rawBillingFileId: String(manifestRawFile.id),
        fileRole: "manifest",
        processingOrder: 0,
      },
      ...dataRawFiles.map((dataRawFile, index) => ({
        ingestionRunId: String(ingestionRun.id),
        rawBillingFileId: String(dataRawFile.id),
        fileRole: "data" as const,
        processingOrder: index + 1,
      })),
    ];

    await BillingIngestionRunFile.bulkCreate(
      runFileLinks.map((link) => ({
        ingestionRunId: link.ingestionRunId,
        rawBillingFileId: link.rawBillingFileId,
        fileRole: link.fileRole,
        processingOrder: link.processingOrder,
      })),
      { transaction },
    );

    await billingSource.update(
      {
        lastFileReceivedAt: new Date(),
      },
      { transaction },
    );

    logger.info("AWS manifest batch queued", {
      billingSourceId: billingSource.id,
      ingestionRunId: ingestionRun.id,
      manifestObjectKey,
      region: normalizedRegion,
      parquetFileCount: dataRawFiles.length,
    });

    return {
      queued: true,
      skipped: false,
      ingestionRunId: String(ingestionRun.id),
      manifestRawBillingFileId: String(manifestRawFile.id),
      parquetRawBillingFileIds: dataRawFiles.map((file) => String(file.id)),
      parquetFileCount: dataRawFiles.length,
    };
  });
};

export async function queueExportManifestFromEvent(payload: AwsManifestPayload): Promise<QueueManifestResult> {
  const normalizedCallbackToken = requireNonEmpty(payload.callbackToken, "callbackToken");
  const normalizedAccountId = requireNonEmpty(payload.accountId, "accountId");
  const normalizedRegion = requireNonEmpty(payload.region, "region");
  const normalizedRoleArn = requireNonEmpty(payload.roleArn, "roleArn");
  const normalizedBucketName = requireNonEmpty(payload.bucketName, "bucketName");
  const normalizedManifestKey = assertManifestObjectKey(payload.manifestKey);

  const connection = await CloudConnectionV2.findOne({
    where: { callbackToken: normalizedCallbackToken },
  });
  if (!connection) {
    throw new NotFoundError("Invalid callback token");
  }

  const storedCloudAccountId = String(connection.cloudAccountId ?? "").trim();
  if (storedCloudAccountId && storedCloudAccountId !== normalizedAccountId) {
    throw new BadRequestError("Account id does not match the connected cloud account");
  }

  const storedRoleArn = String(connection.roleArn ?? "").trim();
  if (storedRoleArn && storedRoleArn !== normalizedRoleArn) {
    throw new BadRequestError("Role ARN does not match the connected role");
  }

  const storedExportRegion = String(connection.exportRegion ?? connection.region ?? "").trim();
  if (storedExportRegion && storedExportRegion !== normalizedRegion) {
    throw new BadRequestError("Region does not match the configured export region");
  }

  const billingSource = await resolveBillingSourceForConnection(connection.id);
  const storedBucketName = String(billingSource.bucketName ?? connection.exportBucket ?? "").trim();
  if (storedBucketName && storedBucketName !== normalizedBucketName) {
    throw new BadRequestError("Bucket name does not match the configured export bucket");
  }

  const existingManifestRun = await findExistingManifestRun({
    billingSourceId: String(billingSource.id),
    manifestObjectKey: normalizedManifestKey,
  });
  if (existingManifestRun) {
    return {
      queued: false,
      skipped: true,
      reason: "Manifest already registered",
      ingestionRunId: existingManifestRun.ingestionRunId,
      manifestRawBillingFileId: existingManifestRun.manifestRawBillingFileId,
    };
  }

  const downloadedManifestBase64 = await downloadExportFile({
    roleArn: requireNonEmpty(connection.roleArn, "roleArn"),
    externalId: connection.externalId ?? null,
    region: normalizedRegion,
    bucket: normalizedBucketName,
    key: normalizedManifestKey,
  });

  const manifestBody = Buffer.from(downloadedManifestBase64, "base64").toString("utf8");
  const parsedManifest = parseAndValidateAwsManifest({
    manifestKey: normalizedManifestKey,
    manifestBody,
  });

  return registerManifestBatchInTransaction({
    billingSource,
    connection,
    bucketName: normalizedBucketName,
    parsedManifest,
    manifestObjectKey: normalizedManifestKey,
    normalizedRegion,
  });
}

const findExistingRawFileByIdentity = async ({
  billingSourceId,
  objectKey,
  etag,
}: {
  billingSourceId: string;
  objectKey: string;
  etag: string | null;
}): Promise<InstanceType<typeof RawBillingFile> | null> => {
  const normalizedEtag = normalizeEtag(etag);
  const etagCandidates = normalizedEtag ? Array.from(new Set([normalizedEtag, String(etag ?? "").trim()])) : [];

  return RawBillingFile.findOne({
    where: {
      billingSourceId,
      originalFilePath: objectKey,
      ...(etagCandidates.length > 0 ? { checksum: { [Op.in]: etagCandidates } } : { checksum: { [Op.is]: null } }),
    },
  });
};

export async function queueExportFileFromEvent({
  callbackToken,
  accountId,
  region,
  roleArn,
  bucketName,
  objectKey,
}: QueueExportFileFromEventParams): Promise<QueueExportFileFromEventResult> {
  const normalizedCallbackToken = requireNonEmpty(callbackToken, "callbackToken");
  const normalizedAccountId = requireNonEmpty(accountId, "accountId");
  const normalizedRegion = requireNonEmpty(region, "region");
  const normalizedRoleArn = requireNonEmpty(roleArn, "roleArn");
  const normalizedBucketName = requireNonEmpty(bucketName, "bucketName");
  const normalizedObjectKey = requireNonEmpty(objectKey, "objectKey");

  const connection = await CloudConnectionV2.findOne({
    where: { callbackToken: normalizedCallbackToken },
  });
  if (!connection) {
    throw new NotFoundError("Invalid callback token");
  }

  const storedCloudAccountId = String(connection.cloudAccountId ?? "").trim();
  if (storedCloudAccountId && storedCloudAccountId !== normalizedAccountId) {
    throw new BadRequestError("Account id does not match the connected cloud account");
  }

  const storedRoleArn = String(connection.roleArn ?? "").trim();
  if (storedRoleArn && storedRoleArn !== normalizedRoleArn) {
    throw new BadRequestError("Role ARN does not match the connected role");
  }

  const storedExportRegion = String(connection.exportRegion ?? connection.region ?? "").trim();
  if (storedExportRegion && storedExportRegion !== normalizedRegion) {
    throw new BadRequestError("Region does not match the configured export region");
  }

  const billingSource = await BillingSource.findOne({
    where: { cloudConnectionId: connection.id },
    order: [["updatedAt", "DESC"]],
  });
  if (!billingSource) {
    throw new NotFoundError("Billing source not found for connection");
  }

  const storedBucketName = String(billingSource.bucketName ?? connection.exportBucket ?? "").trim();
  if (storedBucketName && storedBucketName !== normalizedBucketName) {
    throw new BadRequestError("Bucket name does not match the configured export bucket");
  }

  const duplicateRawFile = await RawBillingFile.findOne({
    where: {
      billingSourceId: String(billingSource.id),
      originalFilePath: normalizedObjectKey,
    },
  });
  if (duplicateRawFile) {
    return {
      queued: false,
      skipped: true,
      reason: "File already registered",
    };
  }

  if (!env.rawBillingFilesBucket) {
    throw new InternalServerError("RAW_BILLING_FILES_BUCKET is not configured");
  }

  const fileFormat = resolveBackfillFileFormat(billingSource, normalizedObjectKey);
  const roleArnForDownload = requireNonEmpty(connection.roleArn, "roleArn");
  const providerName = await getProviderNameById(String(billingSource.cloudProviderId));
  const rawStorageKey = buildRawStorageKey({
    tenantId: billingSource.tenantId,
    providerName,
    key: normalizedObjectKey,
  });

  const downloadedBodyBase64 = await downloadExportFile({
    roleArn: roleArnForDownload,
    externalId: connection.externalId ?? null,
    region: normalizedRegion,
    bucket: normalizedBucketName,
    key: normalizedObjectKey,
  });
  const fileBuffer = Buffer.from(downloadedBodyBase64, "base64");

  await uploadToS3({
    buffer: fileBuffer,
    mimeType: fileFormat === "csv" ? "text/csv" : "application/octet-stream",
    bucket: env.rawBillingFilesBucket,
    key: rawStorageKey,
  });

  const queued = await queueRawFileAndIngestionRun({
    billingSource,
    connection,
    originalFilePath: normalizedObjectKey,
    rawStorageBucket: env.rawBillingFilesBucket,
    rawStorageKey,
    fileFormat,
    fileSizeBytes: String(fileBuffer.length),
    statusMessage: "Queued by AWS S3 object-created event",
  });

  await billingSource.update({
    lastFileReceivedAt: new Date(),
  });

  return {
    queued: true,
    skipped: false,
    rawBillingFileId: queued.rawBillingFileId,
    ingestionRunId: queued.ingestionRunId,
  };
}

export async function runInitialBackfillAfterValidation(connectionId: string): Promise<InitialBackfillSummary> {
  const { connection, billingSource } = await loadConnectionAndSource(connectionId);

  const roleArn = requireNonEmpty(connection.roleArn, "roleArn");
  const exportRegion = requireNonEmpty(connection.exportRegion, "exportRegion");
  const exportBucket = requireNonEmpty(billingSource.bucketName, "bucketName");
  const pathPrefix = normalizePrefix(requireNonEmpty(billingSource.pathPrefix, "pathPrefix"));

  const objects = await listExportFiles({
    roleArn,
    externalId: connection.externalId ?? null,
    region: exportRegion,
    bucket: exportBucket,
    prefix: pathPrefix || undefined,
  });

  const files = objects.filter((item) => item.key && !item.key.endsWith("/"));

  let filesQueued = 0;
  let filesSkipped = 0;

  for (const file of files) {
    const existingRawFile = await findExistingRawFileByIdentity({
      billingSourceId: String(billingSource.id),
      objectKey: file.key,
      etag: file.etag,
    });

    if (existingRawFile) {
      filesSkipped += 1;
      continue;
    }

    await queueInitialBackfillFile({
      billingSource,
      connection,
      exportBucket,
      file,
    });

    filesQueued += 1;
  }

  return {
    filesFound: files.length,
    filesQueued,
    filesSkipped,
  };
}

export async function manuallyIngestLatestFile(connectionId: string): Promise<ManualIngestionResult> {
  const { connection, billingSource } = await loadConnectionAndSource(connectionId);
  const context = resolveExportContext(connection, billingSource);
  const prefix = normalizePrefix(billingSource.pathPrefix ?? connection.exportPrefix);

  const files = await listExportFiles({
    roleArn: requireNonEmpty(connection.roleArn, "roleArn"),
    externalId: connection.externalId ?? null,
    region: context.exportRegion,
    bucket: context.exportBucket,
    prefix: prefix || undefined,
  });

  const latestFileKey = pickLatestFileKey(files);
  return ingestResolvedFile({
    ...context,
    fileKey: latestFileKey,
  });
}

export async function manuallyIngestFile(connectionId: string, key: string): Promise<ManualIngestionResult> {
  const normalizedKey = String(key ?? "").trim();
  if (!normalizedKey) {
    throw new BadRequestError("File key is required");
  }

  const { connection, billingSource } = await loadConnectionAndSource(connectionId);
  const context = resolveExportContext(connection, billingSource);

  return ingestResolvedFile({
    ...context,
    fileKey: normalizedKey,
  });
}
