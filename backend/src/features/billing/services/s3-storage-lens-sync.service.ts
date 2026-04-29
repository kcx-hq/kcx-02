/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { BadRequestError, NotFoundError } from "../../../errors/http-errors.js";
import { BillingSource, CloudConnectionV2 } from "../../../models/index.js";
import { logger } from "../../../utils/logger.js";
import { downloadExportFile, listExportFiles } from "../../cloud-connections/aws/infrastructure/aws-export-reader.service.js";
import { detectFileFormatFromKey, parseCsv, readParquetRowChunksFromBuffer } from "./file-reader.service.js";
import {
  extractStorageLensSnapshotFromRow,
  mergeStorageLensSnapshot,
  upsertStorageLensSnapshots,
} from "./s3-storage-lens-ingestion.service.js";

const normalize = (value) => String(value ?? "").trim();

const sortByLastModifiedDesc = (items) =>
  [...items].sort((a, b) => {
    const left = a?.lastModified ? new Date(a.lastModified).getTime() : 0;
    const right = b?.lastModified ? new Date(b.lastModified).getTime() : 0;
    return right - left;
  });

const isProcessableKey = (key) => {
  const normalized = normalize(key).toLowerCase();
  return normalized.endsWith(".csv") || normalized.endsWith(".parquet");
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
  const snapshotMap = new Map();
  let rowsScanned = 0;

  for (const objectItem of selectedObjects) {
    const objectKey = String(objectItem.key);
    const reportGeneratedDate = toDateOnly(objectItem.lastModified);
    const fileFormat = detectFileFormatFromKey(objectKey);
    if (!fileFormat) continue;

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
        const snapshot = extractStorageLensSnapshotFromRow({
          rawRow,
          normalizedRow: rawRow,
          tenantId: source.tenantId,
          cloudConnectionId: source.cloudConnectionId,
          billingSourceId: source.id,
          providerId: source.cloudProviderId,
          regionKey: null,
          subAccountKey: null,
        });
        if (snapshot) {
          snapshot.ingestionSource = "storage_lens_export";
          snapshot.reportObjectKey = objectKey;
          snapshot.reportGeneratedDate = reportGeneratedDate;
          appendSnapshot(snapshotMap, snapshot);
        }
      }
      continue;
    }

    for await (const chunk of readParquetRowChunksFromBuffer(buffer, 1000)) {
      rowsScanned += chunk.length;
      for (const rawRow of chunk) {
        const snapshot = extractStorageLensSnapshotFromRow({
          rawRow,
          normalizedRow: rawRow,
          tenantId: source.tenantId,
          cloudConnectionId: source.cloudConnectionId,
          billingSourceId: source.id,
          providerId: source.cloudProviderId,
          regionKey: null,
          subAccountKey: null,
        });
        if (snapshot) {
          snapshot.ingestionSource = "storage_lens_export";
          snapshot.reportObjectKey = objectKey;
          snapshot.reportGeneratedDate = reportGeneratedDate;
          appendSnapshot(snapshotMap, snapshot);
        }
      }
    }
  }

  const snapshots = Array.from(snapshotMap.values());
  const upsertedCount = await upsertStorageLensSnapshots(snapshots);

  logger.info("Storage Lens sync completed", {
    tenantId: source.tenantId,
    billingSourceId: source.id,
    cloudConnectionId: source.cloudConnectionId,
    bucket: resolvedBucket,
    prefix: resolvedPrefix || null,
    objectsListed: objectList.length,
    objectsProcessed: selectedObjects.length,
    rowsScanned,
    snapshotsUpserted: upsertedCount,
  });

  return {
    billingSourceId: String(source.id),
    cloudConnectionId: String(source.cloudConnectionId),
    bucket: resolvedBucket,
    prefix: resolvedPrefix || null,
    objectsListed: objectList.length,
    objectsProcessed: selectedObjects.length,
    rowsScanned,
    snapshotsUpserted: upsertedCount,
  };
}
