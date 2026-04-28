/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { S3StorageLensDaily } from "../../../models/index.js";

const normalizeKey = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");

const parseNumeric = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = String(value).trim().replace(/,/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseDateOnly = (value) => {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const parseBucketNameFromArn = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower.startsWith("arn:aws:s3:::")) {
    const bucketPart = raw.slice("arn:aws:s3:::".length);
    return bucketPart.split("/")[0] || null;
  }
  if (lower.startsWith("s3://")) {
    return raw.slice(5).split("/")[0] || null;
  }
  return raw;
};

const lookupByAliases = (rawRow, aliases) => {
  const entries = Object.entries(rawRow ?? {});
  const aliasSet = new Set((aliases ?? []).map((alias) => normalizeKey(alias)));
  for (const [key, value] of entries) {
    if (aliasSet.has(normalizeKey(key))) {
      return value;
    }
  }
  return undefined;
};

const STORAGE_CLASS_KEY_MAP = {
  standard: "bytesStandard",
  standardia: "bytesStandardIa",
  onezoneia: "bytesOnezoneIa",
  intelligenttiering: "bytesIntelligentTiering",
  glacier: "bytesGlacier",
  deeparchive: "bytesDeepArchive",
};

const METRIC_NAME_KEY_MAP = {
  currentversionobjectcount: "objectCount",
  objectcount: "objectCount",
  currentversionbytes: "currentVersionBytes",
  currentversiontotalstoragebytes: "currentVersionBytes",
  avgobjectsize: "avgObjectSizeBytes",
  averageobjectsize: "avgObjectSizeBytes",
  allrequestcount: "accessCount",
  requestcount: "accessCount",
  totalrequestcount: "accessCount",
  standardstoragebytes: "bytesStandard",
  standardiastoragebytes: "bytesStandardIa",
  onezoneiastoragebytes: "bytesOnezoneIa",
  intelligenttieringstoragebytes: "bytesIntelligentTiering",
  glacierstoragebytes: "bytesGlacier",
  deeparchivestoragebytes: "bytesDeepArchive",
};

const STORAGE_LENS_METRIC_FIELDS = [
  "objectCount",
  "currentVersionBytes",
  "avgObjectSizeBytes",
  "bytesStandard",
  "bytesStandardIa",
  "bytesOnezoneIa",
  "bytesIntelligentTiering",
  "bytesGlacier",
  "bytesDeepArchive",
  "accessCount",
];

function createEmptySnapshot({ tenantId, cloudConnectionId, billingSourceId, providerId, regionKey, subAccountKey, usageDate, bucketName }) {
  return {
    tenantId,
    cloudConnectionId: cloudConnectionId ?? null,
    billingSourceId: billingSourceId ?? null,
    providerId: providerId ?? null,
    regionKey: regionKey ?? null,
    subAccountKey: subAccountKey ?? null,
    usageDate,
    bucketName,
    objectCount: null,
    currentVersionBytes: null,
    avgObjectSizeBytes: null,
    bytesStandard: null,
    bytesStandardIa: null,
    bytesOnezoneIa: null,
    bytesIntelligentTiering: null,
    bytesGlacier: null,
    bytesDeepArchive: null,
    accessCount: null,
  };
}

const pickMaxNumber = (a, b) => {
  const left = parseNumeric(a);
  const right = parseNumeric(b);
  if (left === null) return right;
  if (right === null) return left;
  return Math.max(left, right);
};

export function extractStorageLensSnapshotFromRow({
  rawRow,
  normalizedRow,
  tenantId,
  cloudConnectionId,
  billingSourceId,
  providerId,
  regionKey,
  subAccountKey,
}) {
  const recordTypeRaw = lookupByAliases(rawRow, ["record_type", "RecordType"]);
  const recordType = String(recordTypeRaw ?? "").trim().toUpperCase();
  if (recordType && recordType !== "BUCKET") {
    return null;
  }

  const bucketValue =
    lookupByAliases(rawRow, ["bucket_name", "BucketName", "bucket", "bucketName"]) ??
    lookupByAliases(rawRow, ["record_value", "RecordValue"]) ??
    normalizedRow?.ResourceId ??
    normalizedRow?.ResourceName;
  const bucketName = parseBucketNameFromArn(bucketValue);
  if (!bucketName) return null;

  const usageDate =
    parseDateOnly(lookupByAliases(rawRow, ["usage_date", "UsageDate", "report_time", "RecordValueDate", "record_value_date"])) ??
    parseDateOnly(normalizedRow?.usage_start_time) ??
    parseDateOnly(normalizedRow?.ChargePeriodStart);
  if (!usageDate) return null;

  const snapshot = createEmptySnapshot({
    tenantId,
    cloudConnectionId,
    billingSourceId,
    providerId,
    regionKey,
    subAccountKey,
    usageDate,
    bucketName,
  });

  const metricNameRaw = lookupByAliases(rawRow, ["metric_name", "MetricName"]);
  const metricValueRaw = lookupByAliases(rawRow, ["metric_value", "MetricValue"]);
  if (metricNameRaw !== undefined && metricValueRaw !== undefined) {
    const metricKey = METRIC_NAME_KEY_MAP[normalizeKey(metricNameRaw)];
    if (metricKey) {
      snapshot[metricKey] = parseNumeric(metricValueRaw);
    }
  } else {
    snapshot.objectCount = parseNumeric(
      lookupByAliases(rawRow, ["object_count", "ObjectCount", "current_version_object_count"]),
    );
    snapshot.currentVersionBytes = parseNumeric(
      lookupByAliases(rawRow, ["current_version_bytes", "CurrentVersionBytes", "current_version_total_storage_bytes"]),
    );
    snapshot.avgObjectSizeBytes = parseNumeric(
      lookupByAliases(rawRow, ["avg_object_size_bytes", "AvgObjectSizeBytes", "avg_object_size"]),
    );
    snapshot.accessCount = parseNumeric(
      lookupByAliases(rawRow, ["access_count", "AccessCount", "all_request_count"]),
    );
    snapshot.bytesStandard = parseNumeric(
      lookupByAliases(rawRow, ["bytes_standard", "BytesStandard", "standard_storage_bytes"]),
    );
    snapshot.bytesStandardIa = parseNumeric(
      lookupByAliases(rawRow, ["bytes_standard_ia", "BytesStandardIa", "standard_ia_storage_bytes"]),
    );
    snapshot.bytesOnezoneIa = parseNumeric(
      lookupByAliases(rawRow, ["bytes_onezone_ia", "BytesOnezoneIa", "onezone_ia_storage_bytes"]),
    );
    snapshot.bytesIntelligentTiering = parseNumeric(
      lookupByAliases(rawRow, [
        "bytes_intelligent_tiering",
        "BytesIntelligentTiering",
        "intelligent_tiering_storage_bytes",
      ]),
    );
    snapshot.bytesGlacier = parseNumeric(
      lookupByAliases(rawRow, ["bytes_glacier", "BytesGlacier", "glacier_storage_bytes"]),
    );
    snapshot.bytesDeepArchive = parseNumeric(
      lookupByAliases(rawRow, ["bytes_deep_archive", "BytesDeepArchive", "deep_archive_storage_bytes"]),
    );
  }

  const storageClassValue = lookupByAliases(rawRow, ["storage_class", "StorageClass"]);
  const storageClassKey = normalizeKey(storageClassValue);
  if (storageClassKey) {
    const storageField = STORAGE_CLASS_KEY_MAP[storageClassKey];
    const classBytesValue =
      parseNumeric(
        lookupByAliases(rawRow, [
          "current_version_total_storage_bytes",
          "current_version_bytes",
          "CurrentVersionBytes",
          "metric_value",
          "MetricValue",
        ]),
      ) ?? snapshot.currentVersionBytes;
    if (storageField && classBytesValue !== null) {
      snapshot[storageField] = classBytesValue;
    }
  }

  const hasAnyMetric = STORAGE_LENS_METRIC_FIELDS.some((field) => snapshot[field] !== null);
  if (!hasAnyMetric) return null;

  return snapshot;
}

export function mergeStorageLensSnapshot(existingSnapshot, incomingSnapshot) {
  const merged = { ...existingSnapshot };
  for (const metricField of STORAGE_LENS_METRIC_FIELDS) {
    merged[metricField] = pickMaxNumber(existingSnapshot[metricField], incomingSnapshot[metricField]);
  }
  return merged;
}

export async function upsertStorageLensSnapshots(snapshots) {
  if (!Array.isArray(snapshots) || snapshots.length === 0) {
    return 0;
  }

  await S3StorageLensDaily.bulkCreate(snapshots, {
    updateOnDuplicate: [
      "cloudConnectionId",
      "billingSourceId",
      "providerId",
      "regionKey",
      "subAccountKey",
      "objectCount",
      "currentVersionBytes",
      "avgObjectSizeBytes",
      "bytesStandard",
      "bytesStandardIa",
      "bytesOnezoneIa",
      "bytesIntelligentTiering",
      "bytesGlacier",
      "bytesDeepArchive",
      "accessCount",
      "updatedAt",
    ],
  });

  return snapshots.length;
}
