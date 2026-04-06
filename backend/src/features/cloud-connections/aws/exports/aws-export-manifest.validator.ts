import { z } from "zod";

import type { ParsedManifest, ParsedManifestFile } from "./aws-export-ingestion.types.js";

const manifestFileEntrySchema = z.object({
  key: z.string().trim().min(1),
  sizeBytes: z.number().int().nonnegative().nullable(),
  checksum: z.string().trim().min(1).nullable(),
});

const parsedManifestSchema = z.object({
  manifestKey: z.string().trim().min(1),
  manifestVersion: z.string().trim().min(1).nullable(),
  exportArn: z.string().trim().min(1).nullable(),
  createdAt: z.string().trim().min(1).nullable(),
  files: z.array(manifestFileEntrySchema).min(1),
  rawManifest: z.record(z.string(), z.unknown()),
});

type UnknownObject = Record<string, unknown>;

const pickFirstString = (values: unknown[]): string | null => {
  for (const value of values) {
    const normalized = String(value ?? "").trim();
    if (normalized) {
      return normalized;
    }
  }

  return null;
};

const parseSize = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.floor(parsed);
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => String(entry ?? "").trim())
    .filter((entry) => entry.length > 0);
};

const parseS3ObjectLocation = ({
  input,
  expectedBucketName,
}: {
  input: string;
  expectedBucketName?: string;
}): { bucketName: string | null; key: string } => {
  const normalizedInput = String(input ?? "").trim();
  if (!normalizedInput) {
    throw new Error("Manifest file path is empty");
  }

  if (!normalizedInput.toLowerCase().startsWith("s3://")) {
    return {
      bucketName: null,
      key: normalizedInput.replace(/^\/+/, ""),
    };
  }

  const withoutPrefix = normalizedInput.slice("s3://".length);
  const firstSlashIndex = withoutPrefix.indexOf("/");
  if (firstSlashIndex <= 0 || firstSlashIndex === withoutPrefix.length - 1) {
    throw new Error(`Invalid S3 URI in manifest: ${normalizedInput}`);
  }

  const bucketName = withoutPrefix.slice(0, firstSlashIndex).trim();
  const key = withoutPrefix.slice(firstSlashIndex + 1).replace(/^\/+/, "").trim();
  if (!bucketName || !key) {
    throw new Error(`Invalid S3 URI in manifest: ${normalizedInput}`);
  }

  if (expectedBucketName && bucketName !== expectedBucketName) {
    throw new Error(
      `Manifest file bucket mismatch. expected=${expectedBucketName}, found=${bucketName}, uri=${normalizedInput}`,
    );
  }

  return {
    bucketName,
    key,
  };
};

const normalizeManifestFile = ({
  entry,
  expectedBucketName,
}: {
  entry: unknown;
  expectedBucketName?: string;
}): ParsedManifestFile | null => {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const objectEntry = entry as UnknownObject;
  const rawPath = pickFirstString([
    objectEntry.key,
    objectEntry.filePath,
    objectEntry.file_path,
    objectEntry.objectKey,
    objectEntry.object_key,
    objectEntry.s3Key,
    objectEntry.s3_key,
    objectEntry.url,
  ]);

  if (!rawPath) {
    return null;
  }

  const { key } = parseS3ObjectLocation({
    input: rawPath,
    expectedBucketName,
  });

  if (!key.toLowerCase().endsWith(".parquet")) {
    return null;
  }

  const checksum = pickFirstString([objectEntry.checksum, objectEntry.etag, objectEntry.eTag, objectEntry.md5]);

  return {
    key,
    sizeBytes: parseSize(objectEntry.size ?? objectEntry.fileSize ?? objectEntry.file_size),
    checksum,
  };
};

export function parseAndValidateAwsManifest({
  manifestKey,
  manifestBody,
  expectedBucketName,
}: {
  manifestKey: string;
  manifestBody: string;
  expectedBucketName?: string;
}): ParsedManifest {
  let manifestJson: unknown;
  try {
    manifestJson = JSON.parse(manifestBody);
  } catch (error) {
    throw new Error(`Manifest JSON parsing failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!manifestJson || typeof manifestJson !== "object" || Array.isArray(manifestJson)) {
    throw new Error("Manifest must be a JSON object");
  }

  const payload = manifestJson as UnknownObject;

  const candidateFileArrays: unknown[] = [
    payload.files,
    payload.file_list,
    payload.dataFiles,
    payload.data_files,
    payload.data,
  ];

  let parsedFiles: ParsedManifestFile[] = [];

  for (const candidateArray of candidateFileArrays) {
    if (!Array.isArray(candidateArray)) {
      continue;
    }

    const fromObjectEntries = candidateArray
      .map((entry) => normalizeManifestFile({ entry, expectedBucketName }))
      .filter((entry): entry is ParsedManifestFile => !!entry);
    if (fromObjectEntries.length > 0) {
      parsedFiles = fromObjectEntries;
      break;
    }

    const asPathList = toStringArray(candidateArray)
      .map((entry) => parseS3ObjectLocation({ input: entry, expectedBucketName }))
      .filter((entry) => entry.key.toLowerCase().endsWith(".parquet"))
      .map((entry) => ({
        key: entry.key,
        sizeBytes: null,
        checksum: null,
      }));

    if (asPathList.length > 0) {
      parsedFiles = asPathList;
      break;
    }
  }

  if (parsedFiles.length === 0) {
    throw new Error("Manifest does not contain any parquet files");
  }

  const dedupedByKey = new Map<string, ParsedManifestFile>();
  for (const file of parsedFiles) {
    if (!dedupedByKey.has(file.key)) {
      dedupedByKey.set(file.key, file);
    }
  }

  const parsedManifestResult = parsedManifestSchema.safeParse({
    manifestKey,
    manifestVersion: pickFirstString([payload.manifestVersion, payload.version, payload.manifest_version]),
    exportArn: pickFirstString([payload.exportArn, payload.export_arn]),
    createdAt: pickFirstString([payload.createdAt, payload.created_at, payload.creationTimestamp]),
    files: Array.from(dedupedByKey.values()),
    rawManifest: payload,
  });

  if (!parsedManifestResult.success) {
    const issue = parsedManifestResult.error.issues[0];
    throw new Error(`Manifest schema validation failed: ${issue?.message ?? "Invalid manifest payload"}`);
  }

  return parsedManifestResult.data;
}
