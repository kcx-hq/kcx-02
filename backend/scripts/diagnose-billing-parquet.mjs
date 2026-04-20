import fs from "node:fs/promises";
import path from "node:path";

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

async function loadParquetWasmRuntime() {
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

  return { readParquet, readSchema, tableFromIPC };
}

async function readSchemaColumnsWithParquetWasm(buffer) {
  const { readSchema, tableFromIPC } = await loadParquetWasmRuntime();
  const wasmSchema = readSchema(new Uint8Array(buffer));
  const schemaTable = tableFromIPC(wasmSchema.intoIPCStream());
  return schemaTable.schema.fields
    .map((field) => String(field?.name ?? "").trim())
    .filter((fieldName) => fieldName.length > 0)
    .sort((a, b) => a.localeCompare(b));
}

async function readRowsWithParquetWasm(buffer) {
  const { readParquet, tableFromIPC } = await loadParquetWasmRuntime();
  const wasmTable = await Promise.resolve(readParquet(new Uint8Array(buffer)));
  const arrowTable = tableFromIPC(wasmTable.intoIPCStream());
  const rows = [];
  for (let rowIndex = 0; rowIndex < arrowTable.numRows; rowIndex += 1) {
    const row = arrowTable.get(rowIndex);
    rows.push(row && typeof row === "object" ? row : {});
  }
  return rows;
}

function buildSchemaPresenceIndex(columns) {
  const present = new Set(columns.map((col) => String(col ?? "").trim()).filter(Boolean));
  const presentLower = new Set(Array.from(present).map((col) => col.toLowerCase()));
  return {
    hasAny: (candidates) => candidates.some((candidate) => present.has(candidate) || presentLower.has(candidate.toLowerCase())),
    present,
  };
}

function diagnoseSchemaColumns(schemaColumns) {
  const index = buildSchemaPresenceIndex(schemaColumns);

  const expectedGroups = [
    { key: "usage_start_time", label: "Usage start time", candidates: ["usage_start_time", "ChargePeriodStart", "charge_period_start", "lineItem/UsageStartDate"] },
    { key: "usage_end_time", label: "Usage end time", candidates: ["usage_end_time", "ChargePeriodEnd", "charge_period_end", "lineItem/UsageEndDate"] },
    { key: "billed_cost", label: "Billed cost", candidates: ["billed_cost", "BilledCost", "lineItem/UnblendedCost", "lineItem/BlendedCost", "cost", "amount"] },
    { key: "effective_cost", label: "Effective cost", candidates: ["effective_cost", "EffectiveCost", "lineItem/NetUnblendedCost", "net_unblended_cost", "amortized_cost", "net_cost"] },
    { key: "billing_account_id", label: "Billing account id", candidates: ["billing_account_id", "BillingAccountId", "bill/PayerAccountId", "payer_account_id", "account_id"] },
    { key: "service_name", label: "Service name", candidates: ["service_name", "ServiceName", "product/ProductName", "product_name"] },
    { key: "region_id_or_name", label: "Region (id or name)", candidates: ["region_id", "RegionId", "region_name", "RegionName", "product/regionCode", "product/region"] },
  ];

  const missing = [];
  for (const group of expectedGroups) {
    if (!index.hasAny(group.candidates)) {
      missing.push(group.label);
    }
  }

  if (missing.length > 0) {
    return {
      success: false,
      detail: `Missing expected ingestion columns (or known aliases): ${missing.join(", ")}`,
    };
  }

  return {
    success: true,
    detail: "Key ingestion columns (or aliases) are present in parquet schema",
  };
}

function summarizeSampleRow(row) {
  if (!row || typeof row !== "object") return {};
  const pick = (key) => (key in row ? row[key] : undefined);
  return {
    billing_period_start_date: pick("billing_period_start_date"),
    billing_period_end_date: pick("billing_period_end_date"),
    usage_start_time: pick("usage_start_time"),
    usage_end_time: pick("usage_end_time"),
    billed_cost: pick("billed_cost"),
    effective_cost: pick("effective_cost"),
    public_on_demand_cost: pick("public_on_demand_cost"),
    service_name: pick("service_name"),
    region_id: pick("region_id"),
    region_name: pick("region_name"),
    billing_account_id: pick("billing_account_id"),
    sub_account_id: pick("sub_account_id"),
  };
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
  let usedFallback = false;
  let schemaColumnsFallback = null;
  let rowsFallback = null;
  try {
    reader = await readerFactory.openBuffer(buffer);
    printStageResult("parquet-open-buffer", true, "Parquet buffer opened");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    printStageResult("parquet-open-buffer", false, `${reason} (will try parquet-wasm fallback)`);
    try {
      schemaColumnsFallback = await readSchemaColumnsWithParquetWasm(buffer);
      rowsFallback = await readRowsWithParquetWasm(buffer);
      usedFallback = true;
      printStageResult("parquet-wasm-fallback", true, "Read schema + rows via parquet-wasm");
    } catch (fallbackError) {
      printStageResult(
        "parquet-wasm-fallback",
        false,
        fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
      );
      process.exitCode = 1;
      return;
    }
  }

  try {
    const schemaColumns = usedFallback ? schemaColumnsFallback : extractParquetSchemaColumns(reader);
    printStageResult("schema-columns-read", true, `Detected ${schemaColumns.length} schema columns`);
    if (schemaColumns.length > 0) {
      console.log(`Schema columns: ${schemaColumns.join(", ")}`);
    }

    const cursor = usedFallback ? null : reader.getCursor();

    const schemaDiagnosis = diagnoseSchemaColumns(schemaColumns);
    printStageResult("schema-expectations", schemaDiagnosis.success, schemaDiagnosis.detail);
    if (!schemaDiagnosis.success) {
      process.exitCode = 1;
    }

    const sampleLimit = 250;
    let rowCount = 0;
    let sampleCount = 0;
    let usageTimePresent = 0;
    let costPresent = 0;
    let firstSample = null;

    if (usedFallback) {
      const rows = Array.isArray(rowsFallback) ? rowsFallback : [];
      rowCount = rows.length;
      for (const row of rows.slice(0, sampleLimit)) {
        sampleCount += 1;
        if (!firstSample) firstSample = row;

        const usageStart = row.usage_start_time ?? row.ChargePeriodStart ?? row["lineItem/UsageStartDate"];
        const usageEnd = row.usage_end_time ?? row.ChargePeriodEnd ?? row["lineItem/UsageEndDate"];
        if (usageStart != null || usageEnd != null) usageTimePresent += 1;

        const billedCost = row.billed_cost ?? row.BilledCost ?? row["lineItem/UnblendedCost"] ?? row["lineItem/BlendedCost"];
        const effectiveCost = row.effective_cost ?? row.EffectiveCost ?? row["lineItem/NetUnblendedCost"] ?? row.net_unblended_cost;
        if (billedCost != null || effectiveCost != null) costPresent += 1;
      }
    } else {
      let row = await cursor.next();
      while (row) {
        rowCount += 1;
        if (sampleCount < sampleLimit) {
          sampleCount += 1;
          if (!firstSample) firstSample = row;

          const usageStart = row.usage_start_time ?? row.ChargePeriodStart ?? row["lineItem/UsageStartDate"];
          const usageEnd = row.usage_end_time ?? row.ChargePeriodEnd ?? row["lineItem/UsageEndDate"];
          if (usageStart != null || usageEnd != null) {
            usageTimePresent += 1;
          }

          const billedCost = row.billed_cost ?? row.BilledCost ?? row["lineItem/UnblendedCost"] ?? row["lineItem/BlendedCost"];
          const effectiveCost = row.effective_cost ?? row.EffectiveCost ?? row["lineItem/NetUnblendedCost"] ?? row.net_unblended_cost;
          if (billedCost != null || effectiveCost != null) {
            costPresent += 1;
          }
        }

        row = await cursor.next();
      }
    }

    printStageResult("row-read", true, `Read ${rowCount} rows from parquet cursor`);
    if (sampleCount > 0) {
      printStageResult(
        "row-sample",
        true,
        `Sampled first ${sampleCount} row(s): usage_time_present=${usageTimePresent}/${sampleCount}, cost_present=${costPresent}/${sampleCount}`,
      );
      console.log(`First row sample (selected fields): ${JSON.stringify(summarizeSampleRow(firstSample))}`);
    }
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
