import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import csvParser from "csv-parser";
import { Readable } from "node:stream";

import env from "../../../config/env.js";

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

const normalizeFormat = (value) => String(value ?? "").trim().toLowerCase();

function detectFileFormatFromKey(key) {
  const normalizedKey = String(key ?? "").trim().toLowerCase();
  if (normalizedKey.endsWith(".csv")) return "csv";
  if (normalizedKey.endsWith(".parquet")) return "parquet";
  return null;
}

async function streamToBuffer(stream) {
  if (!stream) {
    throw new Error("S3 response body is empty");
  }

  if (Buffer.isBuffer(stream)) {
    return stream;
  }

  if (stream instanceof Uint8Array) {
    return Buffer.from(stream);
  }

  if (typeof stream === "string") {
    return Buffer.from(stream);
  }

  if (typeof stream.transformToByteArray === "function") {
    const bytes = await stream.transformToByteArray();
    return Buffer.from(bytes);
  }

  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function parseCsvHeadersFromBuffer(buffer) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const input = Readable.from(buffer);

    const settleResolve = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const settleReject = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    const parser = csvParser();

    parser.on("headers", (headers) => {
      settleResolve((headers ?? []).map((header) => String(header ?? "")));
      // Header-only read: stop parsing after header row for schema-first validation.
      input.unpipe(parser);
      parser.destroy();
    });

    parser.on("end", () => {
      // Empty file: no header row found.
      settleResolve([]);
    });

    parser.on("error", (error) => {
      settleReject(
        new Error(`CSV header parsing failed: ${error instanceof Error ? error.message : String(error)}`),
      );
    });

    input.pipe(parser);
  });
}

function parseCsvRowsFromBuffer(buffer) {
  return new Promise((resolve, reject) => {
    const rows = [];

    Readable.from(buffer)
      .pipe(csvParser())
      .on("data", (row) => {
        rows.push(row);
      })
      .on("end", () => {
        resolve(rows);
      })
      .on("error", (error) => {
        reject(new Error(`CSV parsing failed: ${error instanceof Error ? error.message : String(error)}`));
      });
  });
}

async function openParquetReader(buffer) {
  try {
    const parquet = await import("parquetjs-lite");
    const readerFactory = parquet?.ParquetReader;

    if (!readerFactory || typeof readerFactory.openBuffer !== "function") {
      throw new Error("parquetjs-lite does not expose ParquetReader.openBuffer");
    }

    return readerFactory.openBuffer(buffer);
  } catch (error) {
    throw new Error(
      `Parquet reader initialization failed: ${
        error instanceof Error ? error.message : String(error)
      }. Ensure parquetjs-lite is installed and supports openBuffer.`,
    );
  }
}

function assertS3Location({ bucket, key }) {
  if (!bucket || !key) {
    throw new Error("bucket and key are required to read billing file");
  }
}

function resolveFileFormat({ fileFormat, key }) {
  const normalizedFileFormat = normalizeFormat(fileFormat) || detectFileFormatFromKey(key);
  if (!normalizedFileFormat) {
    throw new Error(`Unable to detect file format for key: ${key}`);
  }

  if (normalizedFileFormat !== "csv" && normalizedFileFormat !== "parquet") {
    throw new Error(`Unsupported file format: ${fileFormat}`);
  }

  return normalizedFileFormat;
}

function extractParquetSchemaColumns(reader) {
  const schemaColumns = new Set();
  const append = (value) => {
    const normalizedValue = String(value ?? "").trim();
    if (normalizedValue) {
      schemaColumns.add(normalizedValue);
    }
  };

  const schema = reader?.schema;
  if (schema?.fieldList) {
    if (Array.isArray(schema.fieldList)) {
      for (const field of schema.fieldList) {
        append(field?.name ?? field);
      }
    } else {
      for (const fieldName of Object.keys(schema.fieldList)) {
        append(fieldName);
      }
    }
  }

  if (Array.isArray(schema?.fields)) {
    for (const field of schema.fields) {
      append(field?.name ?? field);
    }
  } else if (schema?.fields && typeof schema.fields === "object") {
    for (const fieldName of Object.keys(schema.fields)) {
      append(fieldName);
    }
  }

  if (schemaColumns.size === 0 && Array.isArray(reader?.metadata?.schema)) {
    for (const entry of reader.metadata.schema) {
      append(entry?.name);
      const path = entry?.path_in_schema;
      if (Array.isArray(path) && path.length > 0) {
        append(path[0]);
      } else {
        append(path);
      }
    }
  }

  return Array.from(schemaColumns).sort((a, b) => a.localeCompare(b));
}

async function parseParquetSchemaColumnsFromBuffer(buffer) {
  const reader = await openParquetReader(buffer);
  try {
    return extractParquetSchemaColumns(reader);
  } finally {
    if (reader?.close) {
      await reader.close();
    }
  }
}

async function parseParquetRowsFromBuffer(buffer) {
  const reader = await openParquetReader(buffer);
  try {
    const cursor = reader.getCursor();
    const rows = [];

    let row = await cursor.next();
    while (row) {
      rows.push(row);
      row = await cursor.next();
    }

    return rows;
  } catch (error) {
    throw new Error(
      `Parquet parsing failed: ${
        error instanceof Error ? error.message : String(error)
      }. Ensure parquetjs-lite is installed and supports openBuffer.`,
    );
  } finally {
    if (reader?.close) {
      await reader.close();
    }
  }
}

async function readObjectBuffer({ bucket, key, fileFormat }) {
  assertS3Location({ bucket, key });
  console.info("Reading billing file", { bucket, key, fileFormat });

  try {
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );

    // NOTE:
    // This loads entire file into memory (MVP).
    // For large files, switch to streaming ingestion later.
    return await streamToBuffer(response.Body);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    if (reason.includes("NoSuchKey") || reason.includes("NotFound")) {
      throw new Error(`Billing file not found in S3: s3://${bucket}/${key}`);
    }

    if (reason.includes("AccessDenied")) {
      throw new Error(`Access denied while reading S3 file: s3://${bucket}/${key}`);
    }

    throw new Error(`Failed to read billing file from S3: ${reason}`);
  }
}

async function readCsvHeaders({ bucket, key }) {
  // Phase 1: read only CSV headers for schema validation.
  const buffer = await readObjectBuffer({ bucket, key, fileFormat: "csv" });
  return parseCsvHeadersFromBuffer(buffer);
}

async function readParquetSchemaColumns({ bucket, key }) {
  // Phase 1: read only parquet schema columns for schema validation.
  const buffer = await readObjectBuffer({ bucket, key, fileFormat: "parquet" });
  return parseParquetSchemaColumnsFromBuffer(buffer);
}

async function readCsvRows({ bucket, key }) {
  // Phase 2: read full CSV rows after schema validation succeeds.
  const buffer = await readObjectBuffer({ bucket, key, fileFormat: "csv" });
  return parseCsvRowsFromBuffer(buffer);
}

async function readParquetRows({ bucket, key }) {
  // Phase 2: read full parquet rows after schema validation succeeds.
  const buffer = await readObjectBuffer({ bucket, key, fileFormat: "parquet" });
  return parseParquetRowsFromBuffer(buffer);
}

async function parseCsv(buffer) {
  return parseCsvRowsFromBuffer(buffer);
}

async function parseParquet(buffer) {
  return parseParquetRowsFromBuffer(buffer);
}

async function readBillingFile({ bucket, key, fileFormat }) {
  const normalizedFileFormat = resolveFileFormat({ fileFormat, key });
  const rows =
    normalizedFileFormat === "csv"
      ? await readCsvRows({ bucket, key })
      : await readParquetRows({ bucket, key });

  console.info("Rows parsed", { rowCount: rows.length });
  return {
    rows,
    rowCount: rows.length,
  };
}

export {
  readBillingFile,
  readCsvHeaders,
  readParquetSchemaColumns,
  readCsvRows,
  readParquetRows,
  streamToBuffer,
  parseCsv,
  parseParquet,
  detectFileFormatFromKey,
};
