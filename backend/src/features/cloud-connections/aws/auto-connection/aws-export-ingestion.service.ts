import path from "node:path";
import { Op } from "sequelize";

import env from "../../../../config/env.ts";
import { BadRequestError, InternalServerError, NotFoundError } from "../../../../errors/http-errors.ts";
import { BillingIngestionRun, BillingSource, CloudConnectionV2, RawBillingFile, sequelize } from "../../../../models/index.ts";
import { ingestionOrchestrator } from "../../../billing/services/ingestion-orchestrator.service.ts";
import { createIngestionRun, getIngestionRunById } from "../../../billing/services/ingestion.service.ts";
import {
  createRawFileRecord,
  detectFileFormat,
  getProviderNameById,
  uploadToS3,
} from "../../../billing/services/raw-file.service.ts";
import { parseCsv, parseParquet } from "../../../billing/services/file-reader.service.ts";
import { downloadExportFile, listExportFiles } from "../infrastructure/aws-export-reader.service.ts";

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

export async function queueInitialBackfillFile({
  billingSource,
  connection,
  exportBucket,
  file,
}: QueueInitialBackfillFileParams): Promise<void> {
  const fileFormat = resolveBackfillFileFormat(billingSource, file.key);
  const normalizedEtag = normalizeEtag(file.etag);

  await sequelize.transaction(async (transaction) => {
    const rawBillingFile = await RawBillingFile.create(
      {
        billingSourceId: String(billingSource.id),
        tenantId: billingSource.tenantId,
        cloudProviderId: String(billingSource.cloudProviderId),
        sourceType: billingSource.sourceType,
        setupMode: billingSource.setupMode,
        uploadedBy: connection.createdBy ?? null,
        originalFileName: path.basename(file.key),
        originalFilePath: file.key,
        rawStorageBucket: exportBucket,
        rawStorageKey: file.key,
        fileFormat,
        fileSizeBytes: String(file.size),
        checksum: normalizedEtag,
        status: "queued",
      },
      { transaction },
    );

    await BillingIngestionRun.create(
      {
        billingSourceId: String(billingSource.id),
        rawBillingFileId: String(rawBillingFile.id),
        status: "queued",
        rowsRead: 0,
        rowsLoaded: 0,
        rowsFailed: 0,
        progressPercent: 0,
        currentStep: "queued",
        statusMessage: "Queued by initial AWS export backfill",
      },
      { transaction },
    );
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
