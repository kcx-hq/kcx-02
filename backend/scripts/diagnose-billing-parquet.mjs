import fs from "node:fs/promises";
import path from "node:path";

import { buildSchemaValidationErrorMessage, validateHeaders } from "../src/features/billing/services/schema-validator.service.js";

const REQUIRED_FLAGS = new Set(["--file", "-f"]);

function parseArgs(argv) {
  const args = argv.slice(2);
  let filePath = "";

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (REQUIRED_FLAGS.has(token)) {
      filePath = String(args[index + 1] ?? "").trim();
      index += 1;
    }
  }

  return { filePath };
}

function detectFileFormatFromPath(filePath) {
  const extension = path.extname(String(filePath ?? "")).replace(".", "").toLowerCase();
  if (extension === "csv" || extension === "parquet") {
    return extension;
  }
  return null;
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
      const pathInSchema = entry?.path_in_schema;
      if (Array.isArray(pathInSchema) && pathInSchema.length > 0) {
        append(pathInSchema[0]);
      } else {
        append(pathInSchema);
      }
    }
  }

  return Array.from(schemaColumns).sort((a, b) => a.localeCompare(b));
}

function printStageResult(stage, success, detail) {
  const label = success ? "PASS" : "FAIL";
  console.log(`[${label}] ${stage}: ${detail}`);
}

async function run() {
  const { filePath } = parseArgs(process.argv);

  if (!filePath) {
    console.error("Usage: npm run diagnose:billing:parquet -- --file <absolute-or-relative-path-to-parquet>");
    process.exitCode = 1;
    return;
  }

  const resolvedPath = path.resolve(filePath);
  console.log(`Diagnosing billing ingestion compatibility for: ${resolvedPath}`);

  const detectedFormat = detectFileFormatFromPath(resolvedPath);
  if (detectedFormat !== "parquet") {
    printStageResult("format-detection", false, `Expected .parquet extension but got: ${detectedFormat ?? "unknown"}`);
    process.exitCode = 1;
    return;
  }
  printStageResult("format-detection", true, "File extension resolves to parquet");

  let buffer;
  try {
    buffer = await fs.readFile(resolvedPath);
    printStageResult("local-file-read", true, `Read ${buffer.length} bytes`);
  } catch (error) {
    printStageResult(
      "local-file-read",
      false,
      error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
    return;
  }

  let parquetModule;
  try {
    parquetModule = await import("parquetjs-lite");
    printStageResult("parquet-library", true, "parquetjs-lite is installed");
  } catch (error) {
    printStageResult(
      "parquet-library",
      false,
      `parquetjs-lite is missing/unloadable: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
    return;
  }

  const readerFactory = parquetModule?.ParquetReader ?? parquetModule?.default?.ParquetReader;
  if (!readerFactory || typeof readerFactory.openBuffer !== "function") {
    printStageResult(
      "parquet-reader-init",
      false,
      "parquetjs-lite does not expose ParquetReader.openBuffer",
    );
    process.exitCode = 1;
    return;
  }
  printStageResult("parquet-reader-init", true, "ParquetReader.openBuffer is available");

  let reader;
  try {
    reader = await readerFactory.openBuffer(buffer);
    printStageResult("parquet-open-buffer", true, "Parquet buffer opened");
  } catch (error) {
    printStageResult(
      "parquet-open-buffer",
      false,
      error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
    return;
  }

  try {
    const schemaColumns = extractParquetSchemaColumns(reader);
    printStageResult("schema-columns-read", true, `Detected ${schemaColumns.length} schema columns`);
    if (schemaColumns.length > 0) {
      console.log(`Schema columns: ${schemaColumns.join(", ")}`);
    }

    const validation = validateHeaders(schemaColumns);
    if (!validation.success) {
      const message = buildSchemaValidationErrorMessage(validation);
      printStageResult("schema-validation", false, message);
      process.exitCode = 1;
      return;
    }

    printStageResult("schema-validation", true, "Required billing columns and aliases are valid");

    const cursor = reader.getCursor();
    let rowCount = 0;
    let row = await cursor.next();
    while (row) {
      rowCount += 1;
      row = await cursor.next();
    }
    printStageResult("row-read", true, `Read ${rowCount} rows from parquet cursor`);
  } finally {
    if (reader?.close) {
      await reader.close();
    }
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
