import fs from "node:fs/promises";
import path from "node:path";

type Stats = {
  totalRows: number;
  dbRows: number;
  services: Set<string>;
  dbServices: Set<string>;
  engines: Set<string>;
  usageTypes: Set<string>;
  accountIds: Set<string>;
  regions: Set<string>;
  resourceIds: Set<string>;
  databaseTypes: Set<string>;
};

const getFirst = (row: Record<string, unknown>, keys: string[]): string => {
  for (const key of keys) {
    const value = row[key];
    if (value === null || typeof value === "undefined") continue;
    const text = String(value).trim();
    if (text.length > 0) return text;
  }
  return "";
};

const lower = (value: string): string => value.trim().toLowerCase();

const classifyDbType = (service: string, engine: string): string => {
  const s = lower(service);
  const e = lower(engine);
  if (s.includes("dynamodb")) return "Key-Value";
  if (s.includes("elasticache") || s.includes("memorydb")) return "In-Memory";
  if (s.includes("docdb") || s.includes("documentdb")) return "Document";
  if (s.includes("neptune")) return "Graph";
  if (s.includes("keyspaces")) return "Wide Column";
  if (s.includes("timestream")) return "Time Series";
  if (s.includes("rds") || s.includes("aurora") || e.includes("aurora") || e.includes("postgres") || e.includes("mysql")) return "Relational";
  return "Unknown database type";
};

const isDbRow = (service: string, usageType: string, resourceId: string, engine: string): boolean => {
  const hay = `${lower(service)} ${lower(usageType)} ${lower(resourceId)} ${lower(engine)}`;
  return (
    hay.includes("rds") ||
    hay.includes("aurora") ||
    hay.includes("dynamodb") ||
    hay.includes("elasticache") ||
    hay.includes("memorydb") ||
    hay.includes("docdb") ||
    hay.includes("documentdb") ||
    hay.includes("neptune") ||
    hay.includes("keyspaces") ||
    hay.includes("timestream") ||
    hay.includes("arn:aws:rds:")
  );
};

async function readRows(filePath: string): Promise<Record<string, unknown>[]> {
  const buffer = await fs.readFile(filePath);
  try {
    const parquetModule = await import("parquetjs-lite");
    const readerFactory = parquetModule?.ParquetReader ?? parquetModule?.default?.ParquetReader;
    const reader = await readerFactory.openBuffer(buffer);
    const cursor = reader.getCursor();
    const rows: Record<string, unknown>[] = [];
    let row = await cursor.next();
    while (row) {
      rows.push((row as Record<string, unknown>) ?? {});
      row = await cursor.next();
    }
    await reader.close();
    return rows;
  } catch {
    const parquetWasm = await import("parquet-wasm");
    const arrow = await import("apache-arrow");
    const wasmTable = await Promise.resolve(parquetWasm.readParquet(new Uint8Array(buffer)));
    const arrowTable = arrow.tableFromIPC(wasmTable.intoIPCStream());
    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < arrowTable.numRows; i += 1) {
      rows.push((arrowTable.get(i) as Record<string, unknown>) ?? {});
    }
    return rows;
  }
}

async function main(): Promise<void> {
  const argPath = String(process.argv[2] ?? "").trim();
  if (!argPath) {
    throw new Error("Usage: tsx scripts/scan-db-parquet-offline.ts <parquet-file-path>");
  }

  const filePath = path.resolve(argPath);
  const rows = await readRows(filePath);
  const stats: Stats = {
    totalRows: 0,
    dbRows: 0,
    services: new Set(),
    dbServices: new Set(),
    engines: new Set(),
    usageTypes: new Set(),
    accountIds: new Set(),
    regions: new Set(),
    resourceIds: new Set(),
    databaseTypes: new Set(),
  };

  for (const row of rows) {
    stats.totalRows += 1;
    const service = getFirst(row, ["service_name", "product_product_name", "product_servicecode", "line_item_product_code"]);
    const engine = getFirst(row, ["db_engine", "database_engine", "product_database_engine", "product_databaseengine", "engine"]);
    const usageType = getFirst(row, ["usage_type", "line_item_usage_type", "lineitem_usagetype"]);
    const accountId = getFirst(row, ["sub_account_id", "line_item_usage_account_id", "bill_payer_account_id", "billing_account_id"]);
    const region = getFirst(row, ["region_id", "product_region_code", "region_name", "product_region"]);
    const resourceId = getFirst(row, ["resource_id", "line_item_resource_id"]);

    if (service) stats.services.add(service);
    if (engine) stats.engines.add(engine);
    if (usageType) stats.usageTypes.add(usageType);
    if (accountId) stats.accountIds.add(accountId);
    if (region) stats.regions.add(region);
    if (resourceId) stats.resourceIds.add(resourceId);

    if (isDbRow(service, usageType, resourceId, engine)) {
      stats.dbRows += 1;
      if (service) stats.dbServices.add(service);
      stats.databaseTypes.add(classifyDbType(service, engine));
    }
  }

  console.log(
    JSON.stringify(
      {
        filePath,
        totalRows: stats.totalRows,
        dbRows: stats.dbRows,
        distinctAllServices: [...stats.services].sort(),
        distinctDbServices: [...stats.dbServices].sort(),
        distinctDbEngines: [...stats.engines].sort(),
        distinctUsageTypes: [...stats.usageTypes].sort(),
        distinctAccountIds: [...stats.accountIds].sort(),
        distinctRegions: [...stats.regions].sort(),
        distinctResourceCount: stats.resourceIds.size,
        detectedDatabaseTypes: [...stats.databaseTypes].sort(),
      },
      null,
      2,
    ),
  );
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
