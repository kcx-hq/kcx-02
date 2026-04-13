/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
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
const PARQUET_PARSE_TIMEOUT_MS = 120000;

function withTimeout(promise, timeoutMs, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs),
    ),
  ]);
}

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

let parquetWasmRuntimePromise;

async function loadParquetWasmRuntime() {
  if (!parquetWasmRuntimePromise) {
    parquetWasmRuntimePromise = (async () => {
      const parquetWasm = await import("parquet-wasm");
      const arrow = await import("apache-arrow");

      const readParquet = parquetWasm?.readParquet;
      const readSchema = parquetWasm?.readSchema;
      const tableFromIPC = arrow?.tableFromIPC;

      if (typeof readParquet !== "function" || typeof readSchema !== "function") {
        throw new Error("parquet-wasm does not expose readParquet/readSchema");
      }

      if (typeof tableFromIPC !== "function") {
        throw new Error("apache-arrow does not expose tableFromIPC");
      }

      return {
        readParquet,
        readSchema,
        tableFromIPC,
      };
    })();
  }

  return parquetWasmRuntimePromise;
}

async function openParquetReader(buffer) {
  try {
    const parquet = await import("parquetjs-lite");
    const readerFactory = parquet?.ParquetReader ?? parquet?.default?.ParquetReader;

    if (!readerFactory || typeof readerFactory.openBuffer !== "function") {
      throw new Error("parquetjs-lite does not expose ParquetReader.openBuffer");
    }

    return readerFactory.openBuffer(buffer);
  } catch (error) {
    throw new Error(
      `Parquet reader initialization failed: ${
        error instanceof Error ? error.message : String(error)
      }. Reader=parquetjs-lite.`,
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
  try {
    const reader = await openParquetReader(buffer);
    try {
      return extractParquetSchemaColumns(reader);
    } finally {
      if (reader?.close) {
        await reader.close();
      }
    }
  } catch (primaryError) {
    console.warn("Primary parquet schema reader failed; trying parquet-wasm fallback", {
      reason: primaryError instanceof Error ? primaryError.message : String(primaryError),
    });

    try {
      const { readSchema, tableFromIPC } = await loadParquetWasmRuntime();
      const wasmSchema = readSchema(new Uint8Array(buffer));
      const schemaTable = tableFromIPC(wasmSchema.intoIPCStream());
      return schemaTable.schema.fields
        .map((field) => String(field?.name ?? "").trim())
        .filter((fieldName) => fieldName.length > 0)
        .sort((a, b) => a.localeCompare(b));
    } catch (fallbackError) {
      throw new Error(
        `Parquet schema parsing failed with all readers. primary=${
          primaryError instanceof Error ? primaryError.message : String(primaryError)
        }; fallback=${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`,
      );
    }
  }
}

async function parseParquetRowsFromBuffer(buffer) {
  const readWithParquetWasm = async () => {
    const { readParquet, tableFromIPC } = await loadParquetWasmRuntime();
    const wasmTable = await withTimeout(
      Promise.resolve(readParquet(new Uint8Array(buffer))),
      PARQUET_PARSE_TIMEOUT_MS,
      "parquet-wasm readParquet",
    );
    const arrowTable = tableFromIPC(wasmTable.intoIPCStream());
    const rows = [];

    for (let rowIndex = 0; rowIndex < arrowTable.numRows; rowIndex += 1) {
      const row = arrowTable.get(rowIndex);
      rows.push(row && typeof row === "object" ? row : {});
    }

    return rows;
  };

  try {
    const reader = await openParquetReader(buffer);
    try {
      const schemaFields = Object.values(reader?.schema?.fields ?? {});
      const hasInt96Columns = schemaFields.some(
        (field) => String(field?.primitiveType ?? "").toUpperCase() === "INT96",
      );

      // parquetjs-lite mis-decodes INT96 timestamp values (common in AWS exports).
      // Route those files through parquet-wasm, which returns correct epoch timestamps.
      if (hasInt96Columns) {
        return await readWithParquetWasm();
      }

      const cursor = reader.getCursor();
      const rows = [];

      let row = await withTimeout(
        cursor.next(),
        PARQUET_PARSE_TIMEOUT_MS,
        "parquetjs-lite cursor.next initial read",
      );
      while (row) {
        rows.push(row);
        row = await withTimeout(
          cursor.next(),
          PARQUET_PARSE_TIMEOUT_MS,
          "parquetjs-lite cursor.next incremental read",
        );
      }

      return rows;
    } finally {
      if (reader?.close) {
        await reader.close();
      }
    }
  } catch (primaryError) {
    console.warn("Primary parquet row reader failed; trying parquet-wasm fallback", {
      reason: primaryError instanceof Error ? primaryError.message : String(primaryError),
    });

    try {
      return await readWithParquetWasm();
    } catch (fallbackError) {
      throw new Error(
        `Parquet parsing failed with all readers. primary=${
          primaryError instanceof Error ? primaryError.message : String(primaryError)
        }; fallback=${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`,
      );
    }
  }
}

async function* readParquetRowChunksFromBuffer(buffer, chunkSize = 1000) {
  const resolvedChunkSize = Number.isInteger(chunkSize) && chunkSize > 0 ? chunkSize : 1000;

  try {
    const reader = await openParquetReader(buffer);
    try {
      const schemaFields = Object.values(reader?.schema?.fields ?? {});
      const hasInt96Columns = schemaFields.some(
        (field) => String(field?.primitiveType ?? "").toUpperCase() === "INT96",
      );

      // Keep timestamp decoding consistent with parseParquetRowsFromBuffer().
      // parquetjs-lite can mis-decode INT96 timestamps (common in AWS exports),
      // so route chunked reads through parquet-wasm-backed parsing when INT96 exists.
      if (hasInt96Columns) {
        const rows = await parseParquetRowsFromBuffer(buffer);
        for (let index = 0; index < rows.length; index += resolvedChunkSize) {
          yield rows.slice(index, index + resolvedChunkSize);
        }
        return;
      }

      const cursor = reader.getCursor();
      let chunk = [];

      let row = await withTimeout(
        cursor.next(),
        PARQUET_PARSE_TIMEOUT_MS,
        "parquetjs-lite chunk cursor.next initial read",
      );
      while (row) {
        chunk.push(row);
        if (chunk.length >= resolvedChunkSize) {
          yield chunk;
          chunk = [];
        }
        row = await withTimeout(
          cursor.next(),
          PARQUET_PARSE_TIMEOUT_MS,
          "parquetjs-lite chunk cursor.next incremental read",
        );
      }

      if (chunk.length > 0) {
        yield chunk;
      }
      return;
    } finally {
      if (reader?.close) {
        await reader.close();
      }
    }
  } catch (primaryError) {
    console.warn("Primary parquet chunk reader failed; trying parquet-wasm fallback", {
      reason: primaryError instanceof Error ? primaryError.message : String(primaryError),
    });

    try {
      const rows = await parseParquetRowsFromBuffer(buffer);
      for (let index = 0; index < rows.length; index += resolvedChunkSize) {
        yield rows.slice(index, index + resolvedChunkSize);
      }
    } catch (fallbackError) {
      throw new Error(
        `Parquet chunked parsing failed with all readers. primary=${
          primaryError instanceof Error ? primaryError.message : String(primaryError)
        }; fallback=${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`,
      );
    }
  }
}

async function readObjectBuffer({ bucket, key, fileFormat }) {
  assertS3Location({ bucket, key });
  console.log("[S3-UPLOAD-DEBUG][INGESTION][S3_READ_START]", {
    tenantId: null,
    userId: null,
    sessionId: null,
    ingestionRunId: null,
    bucket,
    key,
    fileFormat,
    mode: "buffer",
  });
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
    console.error("[S3-UPLOAD-DEBUG][INGESTION][S3_READ_FAILED]", {
      tenantId: null,
      userId: null,
      sessionId: null,
      ingestionRunId: null,
      bucket,
      key,
      fileFormat,
      error: error instanceof Error ? error.message : String(error),
      mode: "buffer",
    });
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

async function getObjectBodyStream({ bucket, key, fileFormat }) {
  assertS3Location({ bucket, key });
  console.log("[S3-UPLOAD-DEBUG][INGESTION][S3_READ_START]", {
    tenantId: null,
    userId: null,
    sessionId: null,
    ingestionRunId: null,
    bucket,
    key,
    fileFormat,
    mode: "stream",
  });
  console.info("Opening billing file stream", { bucket, key, fileFormat });

  try {
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );

    if (!response?.Body) {
      throw new Error("S3 response body is empty");
    }

    if (response.Body instanceof Readable) {
      return response.Body;
    }

    if (typeof response.Body.transformToWebStream === "function") {
      return Readable.fromWeb(response.Body.transformToWebStream());
    }

    const bodyBuffer = await streamToBuffer(response.Body);
    return Readable.from(bodyBuffer);
  } catch (error) {
    console.error("[S3-UPLOAD-DEBUG][INGESTION][S3_READ_FAILED]", {
      tenantId: null,
      userId: null,
      sessionId: null,
      ingestionRunId: null,
      bucket,
      key,
      fileFormat,
      error: error instanceof Error ? error.message : String(error),
      mode: "stream",
    });
    const reason = error instanceof Error ? error.message : String(error);

    if (reason.includes("NoSuchKey") || reason.includes("NotFound")) {
      throw new Error(`Billing file not found in S3: s3://${bucket}/${key}`);
    }

    if (reason.includes("AccessDenied")) {
      throw new Error(`Access denied while reading S3 file: s3://${bucket}/${key}`);
    }

    throw new Error(`Failed to open billing file stream from S3: ${reason}`);
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

async function* readCsvRowChunks({ bucket, key, chunkSize = 1000 }) {
  const resolvedChunkSize = Number.isInteger(chunkSize) && chunkSize > 0 ? chunkSize : 1000;
  const stream = await getObjectBodyStream({ bucket, key, fileFormat: "csv" });
  const parser = csvParser();

  let chunk = [];
  stream.pipe(parser);

  try {
    for await (const row of parser) {
      chunk.push(row);
      if (chunk.length >= resolvedChunkSize) {
        yield chunk;
        chunk = [];
      }
    }

    if (chunk.length > 0) {
      yield chunk;
    }
  } catch (error) {
    throw new Error(`CSV chunked parsing failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    parser.destroy();
    stream.destroy();
  }
}

async function* readParquetRowChunks({ bucket, key, chunkSize = 1000 }) {
  const resolvedChunkSize = Number.isInteger(chunkSize) && chunkSize > 0 ? chunkSize : 1000;
  const rows = await readParquetRows({ bucket, key });

  for (let index = 0; index < rows.length; index += resolvedChunkSize) {
    yield rows.slice(index, index + resolvedChunkSize);
  }
}

async function* readBillingRowChunks({ bucket, key, fileFormat, chunkSize = 1000 }) {
  const normalizedFileFormat = resolveFileFormat({ fileFormat, key });

  if (normalizedFileFormat === "csv") {
    yield* readCsvRowChunks({ bucket, key, chunkSize });
    return;
  }

  yield* readParquetRowChunks({ bucket, key, chunkSize });
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
  parseParquetSchemaColumnsFromBuffer,
  readCsvRows,
  readParquetRows,
  readCsvRowChunks,
  readParquetRowChunks,
  readParquetRowChunksFromBuffer,
  readBillingRowChunks,
  streamToBuffer,
  parseCsv,
  parseParquet,
  detectFileFormatFromKey,
};




