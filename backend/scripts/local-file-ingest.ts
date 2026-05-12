// @ts-nocheck
import fs from "node:fs/promises";
import path from "node:path";
import env from "../src/config/env.js";
import { ingestionOrchestrator } from "../src/features/billing/services/ingestion-orchestrator.service.js";
import { createIngestionRun } from "../src/features/billing/services/ingestion.service.js";
import {
  createRawFileRecord,
  detectFileFormat,
  uploadToS3,
} from "../src/features/billing/services/raw-file.service.js";
import { BillingSource, CloudConnectionV2, sequelize } from "../src/models/index.js";

type CliArgs = {
  connectionId: string;
  localFilePath: string;
};

const originalSetImmediate = global.setImmediate;

function enableScriptLevelStorageLensSkip(): void {
  global.setImmediate = ((callback: (...args: unknown[]) => unknown, ...args: unknown[]) => {
    const callbackSource =
      typeof callback === "function" ? Function.prototype.toString.call(callback) : "";

    if (callbackSource.includes("syncStorageLensFromClientAccount")) {
      console.info("Skipping Storage Lens auto-sync (script-level override)");
      return {
        hasRef: () => false,
        ref: () => undefined,
        unref: () => undefined,
      } as unknown as NodeJS.Immediate;
    }

    return originalSetImmediate(callback as (...args: any[]) => void, ...(args as any[]));
  }) as typeof setImmediate;
}

function restoreSetImmediate(): void {
  global.setImmediate = originalSetImmediate;
}

const parseArgs = (argv: string[]): CliArgs => {
  const args = argv.slice(2);
  return {
    connectionId: String(args[0] ?? "").trim(),
    localFilePath: String(args[1] ?? "").trim(),
  };
};

const printUsage = (): void => {
  console.error(
    "Usage: node dist/scripts/local-file-ingest.js <connectionId> <localFilePath(.csv|.parquet)>",
  );
};

async function main(): Promise<void> {
  const { connectionId, localFilePath } = parseArgs(process.argv);
  if (!connectionId || !localFilePath) {
    printUsage();
    process.exitCode = 1;
    return;
  }
  if (!env.rawBillingFilesBucket) {
    throw new Error("RAW_BILLING_FILES_BUCKET is not configured");
  }

  enableScriptLevelStorageLensSkip();

  const connection = await CloudConnectionV2.findByPk(connectionId);
  if (!connection) throw new Error("Cloud connection not found");

  const billingSource = await BillingSource.findOne({
    where: { cloudConnectionId: connection.id },
    order: [["updatedAt", "DESC"]],
  });
  if (!billingSource) throw new Error("Billing source not found for connection");

  const absolutePath = path.resolve(localFilePath);
  const fileName = path.basename(absolutePath);
  const fileFormat = detectFileFormat(fileName);
  const fileBuffer = await fs.readFile(absolutePath);
  const rawStorageKey = [
    String(connection.tenantId).toLowerCase(),
    "aws-like-local",
    String(Date.now()),
    fileName.toLowerCase().replace(/[^a-z0-9._-]+/g, "-"),
  ].join("/");

  await uploadToS3({
    buffer: fileBuffer,
    mimeType: fileFormat === "csv" ? "text/csv" : "application/octet-stream",
    bucket: env.rawBillingFilesBucket,
    key: rawStorageKey,
  });

  const rawFile = await createRawFileRecord({
    billingSourceId: String(billingSource.id),
    tenantId: connection.tenantId,
    cloudProviderId: String(connection.providerId),
    sourceType: billingSource.sourceType,
    setupMode: billingSource.setupMode,
    uploadedBy: connection.createdBy ?? null,
    originalFileName: fileName,
    originalFilePath: absolutePath,
    rawStorageBucket: env.rawBillingFilesBucket,
    rawStorageKey,
    fileFormat,
    fileSizeBytes: String(fileBuffer.length),
    status: "stored",
  });

  const ingestionRun = await createIngestionRun({
    billingSourceId: String(billingSource.id),
    rawBillingFileId: String(rawFile.id),
  });

  await ingestionOrchestrator.processIngestionRun(ingestionRun.id);

  console.info("Local file ingestion completed (no cleanup)", {
    connectionId,
    localFilePath: absolutePath,
    fileFormat,
    rawBillingFileId: String(rawFile.id),
    ingestionRunId: String(ingestionRun.id),
  });
}

main()
  .catch((error) => {
    console.error(
      "Local file ingestion failed:",
      error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await ingestionOrchestrator.waitForPendingPostIngestionTasks();
    restoreSetImmediate();
    await sequelize.close();
  });
