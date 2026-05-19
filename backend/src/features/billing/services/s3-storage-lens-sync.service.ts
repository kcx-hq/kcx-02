/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { BadRequestError, NotFoundError } from "../../../errors/http-errors.js";
import {
  BillingSource,
  CloudConnectionV2,
  DimRegion,
  DimSubAccount,
  StorageLensIngestionRun,
  StorageLensRawFile,
} from "../../../models/index.js";
import { logger } from "../../../utils/logger.js";
import { downloadExportFile, listExportFiles } from "../../cloud-connections/aws/infrastructure/aws-export-reader.service.js";
import { detectFileFormatFromKey, parseCsv, readParquetRowChunksFromBuffer } from "./file-reader.service.js";
import {
  extractStorageLensSnapshotFromRow,
  getStorageLensRowDropReason,
  mergeStorageLensSnapshot,
  upsertStorageLensSnapshots,
} from "./s3-storage-lens-ingestion.service.js";
import { collectS3BucketConfigSnapshotsForBillingSource } from "./s3-bucket-config-snapshot.service.js";
import { refreshS3BucketCostSummaryForBillingSource } from "./s3-bucket-cost-summary.service.js";
import { syncS3CostDaily } from "./s3-cost-daily.service.js";

const normalize = (value) => String(value ?? "").trim();

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const toSerializable = (value: unknown): unknown => {
  if (value == null) return value;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  if (typeof value === "object") {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return String(value);
    }
  }
  return value;
};

const buildDetailedErrorMessage = (error: unknown): string => {
  if (!(error instanceof Error)) return String(error);
  const asAny = error as Record<string, unknown>;
  const payload = {
    name: error.name,
    message: error.message,
    stack: error.stack,
    errors: toSerializable(asAny.errors),
    fields: toSerializable(asAny.fields),
    parent: toSerializable(asAny.parent),
    original: toSerializable(asAny.original),
    sql: toSerializable(asAny.sql),
  };
  const serialized = JSON.stringify(payload);
  return serialized.length > 3900 ? `${serialized.slice(0, 3900)}...<truncated>` : serialized;
};

const sortByLastModifiedDesc = (items) =>
  [...items].sort((a, b) => {
    const left = a?.lastModified ? new Date(a.lastModified).getTime() : 0;
    const right = b?.lastModified ? new Date(b.lastModified).getTime() : 0;
    return right - left;
  });

const isProcessableKey = (key) => {
  const normalized = normalize(key).toLowerCase();
  const hasSupportedExtension =
    normalized.endsWith(".csv") || normalized.endsWith(".parquet") || normalized.endsWith(".par");
  if (!hasSupportedExtension) return false;

  // Guardrail: only process actual Storage Lens export objects in this sync path.
  const isStorageLensPath =
    normalized.includes("/storage-lens/") &&
    normalized.includes("/storagelens/") &&
    normalized.includes("/reports/");
  if (!isStorageLensPath) return false;

  // Explicitly reject CUR/data-export objects even if extension matches.
  if (normalized.includes("/data-exports/cur2/")) return false;

  return true;
};

const pickStorageLensObjects = (objects, maxFiles) => {
  const files = sortByLastModifiedDesc(objects).filter((item) => item?.key && isProcessableKey(item.key));
  return files.slice(0, maxFiles);
};

const appendSnapshot = (snapshotMap, snapshot) => {
  const key = `${snapshot.tenantId}|${snapshot.bucketName}|${snapshot.usageDate}`;
  const existingSnapshot = snapshotMap.get(key);
  snapshotMap.set(key, existingSnapshot ? mergeStorageLensSnapshot(existingSnapshot, snapshot) : snapshot);
};

const toDateOnly = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const normalizeKey = (value: unknown): string => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");

const lookupByAliases = (rawRow: Record<string, unknown>, aliases: string[]): unknown => {
  const entries = Object.entries(rawRow ?? {});
  const aliasSet = new Set((aliases ?? []).map((alias) => normalizeKey(alias)));
  for (const [key, value] of entries) {
    if (aliasSet.has(normalizeKey(key))) return value;
  }
  return undefined;
};

const resolveConnectionContext = async ({ tenantId, billingSourceId }) => {
  const source = await BillingSource.findByPk(String(billingSourceId));
  if (!source || String(source.tenantId) !== String(tenantId)) {
    throw new NotFoundError("Billing source not found");
  }

  if (!source.cloudConnectionId) {
    throw new BadRequestError("Billing source is not connected to a cloud connection");
  }

  const connection = await CloudConnectionV2.findByPk(String(source.cloudConnectionId));
  if (!connection || String(connection.tenantId) !== String(tenantId)) {
    throw new NotFoundError("Cloud connection not found for billing source");
  }

  const roleArn = normalize(connection.billingRoleArn || connection.actionRoleArn);
  const region = normalize(connection.exportRegion || connection.region || "us-east-1");
  const externalId = normalize(connection.externalId) || null;

  if (!roleArn) {
    throw new BadRequestError("Cloud connection is missing billing role ARN");
  }

  return { source, connection, roleArn, region, externalId };
};

export async function syncStorageLensFromClientAccount({
  tenantId,
  billingSourceId,
  bucket,
  prefix,
  maxFiles = 10,
}) {
  const { source, connection, roleArn, region, externalId } = await resolveConnectionContext({
    tenantId,
    billingSourceId,
  });
  const ingestionRun = await StorageLensIngestionRun.create({
    billingSourceId: source.id,
    status: "processing",
    currentStep: "listing_files",
    progressPercent: 5,
    statusMessage: "Listing Storage Lens export files",
    startedAt: new Date(),
  });

  try {
    const regionKeyCache = new Map<string, number | null>();
    const subAccountKeyCache = new Map<string, number | null>();

    const resolveRegionKey = async (providerId: string | number, regionNameRaw: unknown): Promise<number | null> => {
      const regionName = normalize(regionNameRaw);
      if (!regionName) return null;
      const providerIdValue = String(providerId);
      const regionId = regionName.toLowerCase();
      const cacheKey = `${providerIdValue}|${regionId}`;
      if (regionKeyCache.has(cacheKey)) return regionKeyCache.get(cacheKey) ?? null;

      const existing = await DimRegion.findOne({
        where: {
          providerId: providerIdValue,
          regionId,
        },
      });

      if (existing?.id) {
        const existingKey = Number(existing.id);
        regionKeyCache.set(cacheKey, existingKey);
        return existingKey;
      }

      let row = null;
      try {
        row = await DimRegion.create({
          providerId: providerIdValue,
          regionId,
          regionName: regionName || regionId,
          availabilityZone: null,
        });
      } catch (error) {
        // Another concurrent worker may have inserted this region between findOne and create.
        const raceWinner = await DimRegion.findOne({
          where: {
            providerId: providerIdValue,
            regionId,
          },
        });
        if (!raceWinner) throw error;
        row = raceWinner;
      }

      const key = row?.id ? Number(row.id) : null;
      regionKeyCache.set(cacheKey, key);
      return key;
    };

    const resolveSubAccountKey = async (
      tenantIdValue: string,
      providerId: string | number,
      accountIdRaw: unknown,
    ): Promise<number | null> => {
      const subAccountId = normalize(accountIdRaw);
      if (!subAccountId) return null;
      const cacheKey = `${tenantIdValue}|${providerId}|${subAccountId}`;
      if (subAccountKeyCache.has(cacheKey)) return subAccountKeyCache.get(cacheKey) ?? null;

      const [row] = await DimSubAccount.findOrCreate({
        where: {
          tenantId: tenantIdValue,
          providerId: String(providerId),
          subAccountId,
        },
        defaults: {
          tenantId: tenantIdValue,
          providerId: String(providerId),
          subAccountId,
          subAccountName: subAccountId,
        },
      });
      const key = row?.id ? Number(row.id) : null;
      subAccountKeyCache.set(cacheKey, key);
      return key;
    };

    const resolvedBucket = normalize(bucket || source.bucketName || connection.exportBucket);
    const resolvedPrefix = normalize(prefix || source.pathPrefix || connection.exportPrefix);
    if (!resolvedBucket) {
      throw new BadRequestError("Storage Lens export bucket is required");
    }

    const objectList = await listExportFiles({
      roleArn,
      externalId,
      region,
      bucket: resolvedBucket,
      prefix: resolvedPrefix || undefined,
    });

    const selectedObjects = pickStorageLensObjects(objectList, Math.max(1, Number(maxFiles) || 10));
    await ingestionRun.update({
      currentStep: "processing_files",
      statusMessage: "Reading Storage Lens export files",
      progressPercent: 20,
      filesDiscovered: selectedObjects.length,
      totalRowsEstimated: null,
    });

    const snapshotMap = new Map();
    let rowsScanned = 0;
    let rowsRejected = 0;
    let filesProcessed = 0;
    const rejectionReasonCounts = new Map<string, number>();
    const rejectionSamples = new Map<string, { keys: string[]; bucketLike?: string | null; usageLike?: string | null }>();

    for (const objectItem of selectedObjects) {
      const objectKey = String(objectItem.key);
      const reportGeneratedDate = toDateOnly(objectItem.lastModified);
      const fileFormat = detectFileFormatFromKey(objectKey);
      if (!fileFormat) continue;

      const [trackedFile] = await StorageLensRawFile.findOrCreate({
        where: {
          billingSourceId: source.id,
          storageBucket: resolvedBucket,
          storageKey: objectKey,
        },
        defaults: {
          billingSourceId: source.id,
          ingestionRunId: ingestionRun.id,
          tenantId: source.tenantId,
          cloudProviderId: source.cloudProviderId,
          cloudConnectionId: source.cloudConnectionId,
          storageBucket: resolvedBucket,
          storageKey: objectKey,
          fileFormat,
          fileSizeBytes: objectItem?.size ?? null,
          etag: objectItem?.eTag ?? null,
          lastModifiedAt: objectItem?.lastModified ? new Date(objectItem.lastModified) : null,
          status: "processing",
        },
      });

      await trackedFile.update({
        ingestionRunId: ingestionRun.id,
        fileFormat,
        fileSizeBytes: objectItem?.size ?? trackedFile.fileSizeBytes,
        etag: objectItem?.eTag ?? trackedFile.etag,
        lastModifiedAt: objectItem?.lastModified ? new Date(objectItem.lastModified) : trackedFile.lastModifiedAt,
        status: "processing",
        errorMessage: null,
      });

      try {
        const base64 = await downloadExportFile({
          roleArn,
          externalId,
          region,
          bucket: resolvedBucket,
          key: objectKey,
        });
        const buffer = Buffer.from(base64, "base64");

        if (fileFormat === "csv") {
          const rows = await parseCsv(buffer);
          rowsScanned += rows.length;
          for (const rawRow of rows) {
            const regionRaw = lookupByAliases(rawRow, ["aws_region", "AwsRegion", "region"]);
            const accountRaw = lookupByAliases(rawRow, ["aws_account_number", "AwsAccountNumber", "account_id"]);
            const regionKey = await resolveRegionKey(source.cloudProviderId, regionRaw);
            const subAccountKey = await resolveSubAccountKey(source.tenantId, source.cloudProviderId, accountRaw);
            const snapshot = extractStorageLensSnapshotFromRow({
              rawRow,
              normalizedRow: rawRow,
              tenantId: source.tenantId,
              cloudConnectionId: source.cloudConnectionId,
              billingSourceId: source.id,
              providerId: source.cloudProviderId,
              regionKey,
              subAccountKey,
            });
            if (snapshot) {
              snapshot.ingestionSource = "storage_lens_export";
              snapshot.reportObjectKey = objectKey;
              snapshot.reportGeneratedDate = reportGeneratedDate;
              appendSnapshot(snapshotMap, snapshot);
            } else {
              rowsRejected += 1;
              const reason = getStorageLensRowDropReason({ rawRow, normalizedRow: rawRow });
              rejectionReasonCounts.set(reason, (rejectionReasonCounts.get(reason) ?? 0) + 1);
              if (!rejectionSamples.has(reason)) {
                const keys = Object.keys(rawRow ?? {}).slice(0, 20);
                rejectionSamples.set(reason, {
                  keys,
                  bucketLike: String(rawRow?.bucket_name ?? rawRow?.BucketName ?? rawRow?.record_value ?? "").trim() || null,
                  usageLike: String(
                    rawRow?.usage_date ??
                    rawRow?.UsageDate ??
                    rawRow?.report_date ??
                    rawRow?.ReportDate ??
                    rawRow?.report_time ??
                    "",
                  ).trim() || null,
                });
              }
            }
          }
        } else {
          for await (const chunk of readParquetRowChunksFromBuffer(buffer, 1000)) {
            rowsScanned += chunk.length;
            for (const rawRow of chunk) {
              const regionRaw = lookupByAliases(rawRow, ["aws_region", "AwsRegion", "region"]);
              const accountRaw = lookupByAliases(rawRow, ["aws_account_number", "AwsAccountNumber", "account_id"]);
              const regionKey = await resolveRegionKey(source.cloudProviderId, regionRaw);
              const subAccountKey = await resolveSubAccountKey(source.tenantId, source.cloudProviderId, accountRaw);
              const snapshot = extractStorageLensSnapshotFromRow({
                rawRow,
                normalizedRow: rawRow,
                tenantId: source.tenantId,
                cloudConnectionId: source.cloudConnectionId,
                billingSourceId: source.id,
                providerId: source.cloudProviderId,
                regionKey,
                subAccountKey,
              });
              if (snapshot) {
                snapshot.ingestionSource = "storage_lens_export";
                snapshot.reportObjectKey = objectKey;
                snapshot.reportGeneratedDate = reportGeneratedDate;
                appendSnapshot(snapshotMap, snapshot);
              } else {
                rowsRejected += 1;
                const reason = getStorageLensRowDropReason({ rawRow, normalizedRow: rawRow });
                rejectionReasonCounts.set(reason, (rejectionReasonCounts.get(reason) ?? 0) + 1);
                if (!rejectionSamples.has(reason)) {
                  const keys = Object.keys(rawRow ?? {}).slice(0, 20);
                  rejectionSamples.set(reason, {
                    keys,
                    bucketLike: String(rawRow?.bucket_name ?? rawRow?.BucketName ?? rawRow?.record_value ?? "").trim() || null,
                    usageLike: String(
                      rawRow?.usage_date ??
                      rawRow?.UsageDate ??
                      rawRow?.report_date ??
                      rawRow?.ReportDate ??
                      rawRow?.report_time ??
                      "",
                    ).trim() || null,
                  });
                }
              }
            }
          }
        }

        filesProcessed += 1;
        await trackedFile.update({
          status: "processed",
          processedAt: new Date(),
        });
      } catch (error) {
        logger.warn("Storage Lens file processing failed", {
          tenantId: source.tenantId,
          billingSourceId: source.id,
          ingestionRunId: ingestionRun.id,
          storageBucket: resolvedBucket,
          storageKey: objectKey,
          reason: toErrorMessage(error),
          details: buildDetailedErrorMessage(error),
        });
        await trackedFile.update({
          status: "failed",
          errorMessage: buildDetailedErrorMessage(error),
        });
      }
    }

    const snapshots = Array.from(snapshotMap.values());
    const rejectionSummary = [...rejectionReasonCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([reason, count]) => ({ reason, count, sample: rejectionSamples.get(reason) ?? null }));
    logger.info("Storage Lens row parse summary", {
      tenantId: source.tenantId,
      billingSourceId: source.id,
      rowsScanned,
      rowsRejected,
      rowsAccepted: snapshots.length,
      rejectionSummary,
    });
    const upsertedCount = await upsertStorageLensSnapshots(snapshots);
    const configCollectionResult = await collectS3BucketConfigSnapshotsForBillingSource({
      tenantId: source.tenantId,
      billingSourceId: String(source.id),
    });
    const costSummaryResult = await refreshS3BucketCostSummaryForBillingSource({
      tenantId: source.tenantId,
      billingSourceId: String(source.id),
    });
    const today = new Date();
    const endDate = today.toISOString().slice(0, 10);
    const startDateObj = new Date(today);
    startDateObj.setUTCDate(startDateObj.getUTCDate() - 45);
    const startDate = startDateObj.toISOString().slice(0, 10);
    const s3CostDailyResult = await syncS3CostDaily({
      tenantId: source.tenantId,
      startDate,
      endDate,
      cloudConnectionId: String(source.cloudConnectionId),
      billingSourceId: String(source.id),
      providerId: source.cloudProviderId,
      rebuildRange: true,
    });

    const runStatus =
      filesProcessed === 0 && selectedObjects.length > 0
        ? "failed"
        : rowsRejected > 0
          ? "completed_with_warnings"
          : "completed";
    const runStep = runStatus === "failed" ? "failed" : runStatus;
    const runMessage =
      runStatus === "failed"
        ? "Storage Lens ingestion failed (all discovered files failed)"
        : runStatus === "completed_with_warnings"
          ? "Storage Lens ingestion completed with warnings"
          : "Storage Lens ingestion completed";
    const runError =
      runStatus === "failed"
        ? "All discovered Storage Lens files failed during processing. Check storage_lens_raw_files.error_message for per-file details."
        : null;

    await ingestionRun.update({
      status: runStatus,
      currentStep: runStep,
      progressPercent: 100,
      statusMessage: runMessage,
      filesProcessed,
      rowsRead: rowsScanned,
      rowsLoaded: upsertedCount,
      rowsFailed: rowsRejected,
      errorMessage: runError,
      finishedAt: new Date(),
    });

    logger.info("Storage Lens sync completed", {
      tenantId: source.tenantId,
      billingSourceId: source.id,
      storageLensIngestionRunId: ingestionRun.id,
      cloudConnectionId: source.cloudConnectionId,
      bucket: resolvedBucket,
      prefix: resolvedPrefix || null,
      objectsListed: objectList.length,
      objectsProcessed: selectedObjects.length,
      rowsScanned,
      snapshotsUpserted: upsertedCount,
      bucketConfigSnapshotsCreated: configCollectionResult.snapshotsCreated,
      bucketConfigBucketsScanned: configCollectionResult.bucketsScanned,
      costSummaryRowsInserted: costSummaryResult.rowsInserted,
      s3CostDailyRowsDeleted: s3CostDailyResult.rowsDeleted,
      s3CostDailyRowsInserted: s3CostDailyResult.rowsInserted,
    });

    return {
      ingestionRunId: String(ingestionRun.id),
      billingSourceId: String(source.id),
      cloudConnectionId: String(source.cloudConnectionId),
      bucket: resolvedBucket,
      prefix: resolvedPrefix || null,
      objectsListed: objectList.length,
      objectsProcessed: selectedObjects.length,
      rowsScanned,
      snapshotsUpserted: upsertedCount,
      bucketConfigSnapshotsCreated: configCollectionResult.snapshotsCreated,
      bucketConfigBucketsScanned: configCollectionResult.bucketsScanned,
      costSummaryRowsInserted: costSummaryResult.rowsInserted,
      s3CostDailyRowsDeleted: s3CostDailyResult.rowsDeleted,
      s3CostDailyRowsInserted: s3CostDailyResult.rowsInserted,
    };
  } catch (error) {
    await ingestionRun.update({
      status: "failed",
      currentStep: "failed",
      progressPercent: 100,
      statusMessage: "Storage Lens ingestion failed",
      errorMessage: error instanceof Error ? error.message : String(error),
      finishedAt: new Date(),
    });
    throw error;
  }
}
