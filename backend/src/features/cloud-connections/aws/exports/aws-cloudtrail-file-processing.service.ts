import { Op } from "sequelize";
import { gunzip } from "node:zlib";
import { promisify } from "node:util";

import { BadRequestError, NotFoundError } from "../../../../errors/http-errors.js";
import { CloudConnectionV2, CloudEvent } from "../../../../models/index.js";
import { logger } from "../../../../utils/logger.js";
import { downloadCloudtrailObject } from "../infrastructure/aws-cloudtrail-s3-reader.service.js";
import { mapCloudtrailRecordToCloudEventInsert } from "./cloudtrail-record.mapper.js";

const gunzipAsync = promisify(gunzip);

const CLOUDTRAIL_FILE_EVENT_NAME = "cloudtrail_object_created";
const CLOUDTRAIL_FILE_EVENT_CATEGORY = "cloudtrail_file_event";

type CloudtrailFileProcessingResult = {
  fileEventId: string;
  bucketName: string;
  objectKey: string;
  recordsParsed: number;
  rowsInserted: number;
  skippedDuplicates: number;
  status: "processed" | "skipped" | "failed";
  reason?: string;
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const asNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const shouldGunzip = (key: string, buffer: Buffer): boolean => {
  if (key.toLowerCase().endsWith(".gz")) return true;
  return buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
};

const parseCloudtrailRecordsFromObject = async ({
  objectKey,
  fileBuffer,
}: {
  objectKey: string;
  fileBuffer: Buffer;
}): Promise<Record<string, unknown>[]> => {
  const normalizedBuffer = shouldGunzip(objectKey, fileBuffer) ? await gunzipAsync(fileBuffer) : fileBuffer;
  const rawText = normalizedBuffer.toString("utf8");

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (error) {
    throw new BadRequestError(
      `CloudTrail JSON parse failed for ${objectKey}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const parsedRecord = asRecord(parsed);
  const records = Array.isArray(parsedRecord?.Records)
    ? parsedRecord.Records.filter((entry) => typeof entry === "object" && entry !== null && !Array.isArray(entry))
    : [];

  return records as Record<string, unknown>[];
};

const normalizeProcessingError = (error: unknown): string => {
  const reason = error instanceof Error ? error.message : String(error);
  return reason.slice(0, 4000);
};

const chunkArray = <T>(items: T[], size: number): T[][] => {
  if (items.length === 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const loadExistingFingerprints = async (fingerprints: string[]): Promise<Set<string>> => {
  const existing = new Set<string>();
  const chunks = chunkArray(fingerprints, 1000);

  for (const chunk of chunks) {
    const rows = await CloudEvent.findAll({
      where: { eventFingerprint: { [Op.in]: chunk } },
      attributes: ["eventFingerprint"],
    });

    for (const row of rows) {
      const fingerprint = asNonEmptyString(row.eventFingerprint);
      if (fingerprint) existing.add(fingerprint);
    }
  }

  return existing;
};

const extractFileMarkerDetails = (fileEvent: InstanceType<typeof CloudEvent>) => {
  const metadata = asRecord(fileEvent.metadataJson) ?? {};
  const rawPayload = asRecord(fileEvent.rawPayload) ?? {};

  const bucketName = asNonEmptyString(metadata.bucket_name) ?? asNonEmptyString(rawPayload.bucket_name);
  const objectKey = asNonEmptyString(metadata.object_key) ?? asNonEmptyString(rawPayload.object_key);
  const roleArn = asNonEmptyString(rawPayload.role_arn);
  const region =
    asNonEmptyString(fileEvent.awsRegion) ??
    asNonEmptyString(rawPayload.region) ??
    asNonEmptyString(metadata.bucket_region) ??
    null;

  if (!bucketName || !objectKey) {
    throw new BadRequestError(`Missing bucket_name/object_key metadata for cloud event ${String(fileEvent.id)}`);
  }

  return {
    bucketName,
    objectKey,
    roleArn,
    region,
  };
};

const markFileEventFailed = async (id: string, error: unknown): Promise<void> => {
  await CloudEvent.update(
    {
      processingStatus: "failed",
      processingError: normalizeProcessingError(error),
    },
    { where: { id } },
  );
};

export async function processSingleCloudTrailFileEvent(cloudEventId: number | string): Promise<CloudtrailFileProcessingResult> {
  const normalizedEventId = String(cloudEventId ?? "").trim();
  if (!normalizedEventId) {
    throw new BadRequestError("cloudEventId is required");
  }

  const fileEvent = await CloudEvent.findByPk(normalizedEventId);
  if (!fileEvent) {
    throw new NotFoundError("CloudTrail file event row not found");
  }

  if (
    fileEvent.eventName !== CLOUDTRAIL_FILE_EVENT_NAME ||
    fileEvent.eventCategory !== CLOUDTRAIL_FILE_EVENT_CATEGORY
  ) {
    return {
      fileEventId: String(fileEvent.id),
      bucketName: "",
      objectKey: "",
      recordsParsed: 0,
      rowsInserted: 0,
      skippedDuplicates: 0,
      status: "skipped",
      reason: "row_is_not_cloudtrail_file_event",
    };
  }

  const [claimCount] = await CloudEvent.update(
    {
      processingStatus: "processing",
      processingError: null,
    },
    {
      where: {
        id: normalizedEventId,
        processingStatus: {
          [Op.in]: ["pending", "failed"],
        },
      },
    },
  );

  if (claimCount === 0) {
    return {
      fileEventId: String(fileEvent.id),
      bucketName: "",
      objectKey: "",
      recordsParsed: 0,
      rowsInserted: 0,
      skippedDuplicates: 0,
      status: "skipped",
      reason: "row_not_claimable",
    };
  }

  const claimedFileEvent = await CloudEvent.findByPk(normalizedEventId);
  if (!claimedFileEvent) {
    throw new NotFoundError("CloudTrail file event disappeared during processing");
  }

  const { bucketName, objectKey, roleArn, region } = extractFileMarkerDetails(claimedFileEvent);
  const connection = await CloudConnectionV2.findByPk(claimedFileEvent.cloudConnectionId, {
    attributes: ["id", "externalId"],
  });
  const externalId = connection?.externalId ?? null;

  logger.info("CloudTrail file processing started", {
    fileEventId: normalizedEventId,
    bucketName,
    objectKey,
    roleArn: roleArn ?? null,
    region: region ?? null,
    externalId: externalId ?? null,
  });

  try {
    const fileBuffer = await downloadCloudtrailObject({
      bucket: bucketName,
      key: objectKey,
      region,
      roleArn,
      externalId,
    });
    const records = await parseCloudtrailRecordsFromObject({
      objectKey,
      fileBuffer,
    });

    logger.info("CloudTrail file parsed", {
      fileEventId: normalizedEventId,
      bucketName,
      objectKey,
      recordsParsed: records.length,
    });

    const mappedRows = records.map((record) =>
      mapCloudtrailRecordToCloudEventInsert({
        source: {
          tenantId: claimedFileEvent.tenantId,
          cloudConnectionId: claimedFileEvent.cloudConnectionId,
          providerId: claimedFileEvent.providerId,
          awsAccountId: claimedFileEvent.awsAccountId ?? null,
          awsRegion: claimedFileEvent.awsRegion ?? null,
          eventTime: claimedFileEvent.eventTime,
        },
        record,
      }),
    );

    const fingerprints = mappedRows.map((row) => row.eventFingerprint);
    const existingFingerprints = await loadExistingFingerprints(fingerprints);
    const rowsToInsert = mappedRows.filter((row) => !existingFingerprints.has(row.eventFingerprint));

    if (rowsToInsert.length > 0) {
      await CloudEvent.bulkCreate(rowsToInsert, {
        ignoreDuplicates: true,
      });
    }

    await CloudEvent.update(
      {
        processingStatus: "processed",
        processedAt: new Date(),
        processingError: null,
      },
      { where: { id: normalizedEventId } },
    );

    logger.info("CloudTrail file processing completed", {
      fileEventId: normalizedEventId,
      bucketName,
      objectKey,
      recordsParsed: records.length,
      rowsInserted: rowsToInsert.length,
      skippedDuplicates: records.length - rowsToInsert.length,
    });

    return {
      fileEventId: normalizedEventId,
      bucketName,
      objectKey,
      recordsParsed: records.length,
      rowsInserted: rowsToInsert.length,
      skippedDuplicates: records.length - rowsToInsert.length,
      status: "processed",
    };
  } catch (error) {
    await markFileEventFailed(normalizedEventId, error);

    logger.error("CloudTrail file processing failed", {
      fileEventId: normalizedEventId,
      bucketName,
      objectKey,
      error: normalizeProcessingError(error),
    });

    return {
      fileEventId: normalizedEventId,
      bucketName,
      objectKey,
      recordsParsed: 0,
      rowsInserted: 0,
      skippedDuplicates: 0,
      status: "failed",
      reason: normalizeProcessingError(error),
    };
  }
}

export async function processPendingCloudTrailFiles(input?: { limit?: number }): Promise<{
  pendingFound: number;
  processed: number;
  failed: number;
  skipped: number;
  results: CloudtrailFileProcessingResult[];
}> {
  const limit = Number.isFinite(Number(input?.limit)) ? Math.max(1, Number(input?.limit)) : 25;

  const pendingRows = await CloudEvent.findAll({
    where: {
      eventName: CLOUDTRAIL_FILE_EVENT_NAME,
      eventCategory: CLOUDTRAIL_FILE_EVENT_CATEGORY,
      processingStatus: "pending",
    },
    order: [["eventTime", "ASC"], ["id", "ASC"]],
    limit,
  });

  logger.info("CloudTrail pending file events loaded", {
    pendingFound: pendingRows.length,
    limit,
  });

  const results: CloudtrailFileProcessingResult[] = [];

  for (const row of pendingRows) {
    const result = await processSingleCloudTrailFileEvent(String(row.id));
    results.push(result);
  }

  const summary = {
    pendingFound: pendingRows.length,
    processed: results.filter((item) => item.status === "processed").length,
    failed: results.filter((item) => item.status === "failed").length,
    skipped: results.filter((item) => item.status === "skipped").length,
    results,
  };

  logger.info("CloudTrail pending file processing finished", {
    pendingFound: summary.pendingFound,
    processed: summary.processed,
    failed: summary.failed,
    skipped: summary.skipped,
  });

  return summary;
}
