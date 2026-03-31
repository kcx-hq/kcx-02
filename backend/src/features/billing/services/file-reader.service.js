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

async function parseCsv(buffer) {
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

async function parseParquet(buffer) {
  // TODO:
  // Validate parquetjs-lite buffer APIs in target runtime and optimize row iteration.
  // This placeholder structure is included so parquet support can be enabled without
  // changing readBillingFile call flow.
  try {
    const parquet = await import("parquetjs-lite");
    const readerFactory = parquet?.ParquetReader;

    if (!readerFactory || typeof readerFactory.openBuffer !== "function") {
      throw new Error("parquetjs-lite does not expose ParquetReader.openBuffer");
    }

    const reader = await readerFactory.openBuffer(buffer);
    const cursor = reader.getCursor();
    const rows = [];

    let row = await cursor.next();
    while (row) {
      rows.push(row);
      row = await cursor.next();
    }

    await reader.close();
    return rows;
  } catch (error) {
    throw new Error(
      `Parquet parsing failed: ${
        error instanceof Error ? error.message : String(error)
      }. Ensure parquetjs-lite is installed and supports openBuffer.`,
    );
  }
}

async function readBillingFile({ bucket, key, fileFormat }) {
  const normalizedFileFormat = normalizeFormat(fileFormat) || detectFileFormatFromKey(key);

  if (!bucket || !key) {
    throw new Error("bucket and key are required to read billing file");
  }

  if (!normalizedFileFormat) {
    throw new Error(`Unable to detect file format for key: ${key}`);
  }

  if (normalizedFileFormat !== "csv" && normalizedFileFormat !== "parquet") {
    throw new Error(`Unsupported file format: ${fileFormat}`);
  }

  console.info("Reading billing file", { bucket, key, fileFormat: normalizedFileFormat });

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
    const buffer = await streamToBuffer(response.Body);

    const rows =
      normalizedFileFormat === "csv" ? await parseCsv(buffer) : await parseParquet(buffer);

    console.info("Rows parsed", { rowCount: rows.length });
    return {
      rows,
      rowCount: rows.length,
    };
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

export { readBillingFile, streamToBuffer, parseCsv, parseParquet, detectFileFormatFromKey };
