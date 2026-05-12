// @ts-nocheck
import fs from "node:fs/promises";
import path from "node:path";
import { Op } from "sequelize";
import env from "../src/config/env.js";
import { ingestionOrchestrator } from "../src/features/billing/services/ingestion-orchestrator.service.js";
import { createIngestionRun } from "../src/features/billing/services/ingestion.service.js";
import {
  createRawFileRecord,
  detectFileFormat,
  uploadToS3,
} from "../src/features/billing/services/raw-file.service.js";
import {
  AggCostDaily,
  AggCostHourly,
  AggCostMonthly,
  AnomalyContributor,
  AnomalyDetectionRun,
  BillingIngestionRowError,
  BillingIngestionRun,
  BillingIngestionRunFile,
  BillingSource,
  Budgets,
  BudgetAlerts,
  BudgetEvaluations,
  CloudConnectionV2,
  CloudEvent,
  CloudtrailSource,
  CostPeriodStatus,
  DbCostHistoryDaily,
  DbResourceInventorySnapshot,
  DbUtilizationDaily,
  Ec2AmiInventorySnapshot,
  Ec2CostHistoryDaily,
  Ec2CostHistoryMonthly,
  Ec2EipInventorySnapshot,
  Ec2InstanceInventorySnapshot,
  Ec2InstanceUtilizationDaily,
  Ec2InstanceUtilizationHourly,
  Ec2LoadBalancerInventorySnapshot,
  Ec2SnapshotInventorySnapshot,
  Ec2TargetGroupInventorySnapshot,
  Ec2VolumeInventorySnapshot,
  EbsVolumeUtilizationDaily,
  EbsVolumeUtilizationHourly,
  FactAnomalies,
  FactCommitmentCoverage,
  FactCostAllocations,
  FactCostLineItems,
  FactCostLineItemTags,
  FactDbResourceDaily,
  FactEbsVolumeDaily,
  FactEc2InstanceCostDaily,
  FactEc2InstanceCoverageDaily,
  FactEc2InstanceDaily,
  FactRecommendations,
  RawBillingFile,
  ResourceInventorySnapshot,
  ResourceUtilizationDaily,
  S3BucketConfigSnapshot,
  S3BucketCostSummaryDaily,
  S3StorageLensDaily,
  ScheduledJob,
  sequelize,
} from "../src/models/index.js";

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
    "Usage: node dist/scripts/local-file-ingest-with-cleanup.js <connectionId> <localFilePath(.csv|.parquet)>",
  );
};

async function cleanupIngestionDataForConnection(connectionId: string): Promise<void> {
  const connection = await CloudConnectionV2.findByPk(connectionId);
  if (!connection) throw new Error("Cloud connection not found");

  const billingSource = await BillingSource.findOne({
    where: { cloudConnectionId: connection.id },
    order: [["updatedAt", "DESC"]],
  });
  if (!billingSource) throw new Error("Billing source not found for connection");

  const tenantId = connection.tenantId;
  const billingSourceId = String(billingSource.id);

  await sequelize.transaction(async () => {
    await FactCostLineItemTags.destroy({ where: { tenantId } });
    await BillingIngestionRowError.destroy({
      where: {
        ingestionRunId: {
          [Op.in]: sequelize.literal(
            `(select id from billing_ingestion_runs where billing_source_id = ${sequelize.escape(billingSourceId)})`,
          ),
        },
      } as never,
    });
    await AnomalyContributor.destroy({
      where: {
        anomalyId: {
          [Op.in]: sequelize.literal(
            `(select id from fact_anomalies where tenant_id = ${sequelize.escape(tenantId)})`,
          ),
        },
      } as never,
    });
    await BudgetAlerts.destroy({
      where: {
        budgetId: {
          [Op.in]: sequelize.literal(
            `(select id from budgets where tenant_id = ${sequelize.escape(tenantId)})`,
          ),
        },
      } as never,
    });
    await BudgetEvaluations.destroy({
      where: {
        budgetId: {
          [Op.in]: sequelize.literal(
            `(select id from budgets where tenant_id = ${sequelize.escape(tenantId)})`,
          ),
        },
      } as never,
    });

    await BillingIngestionRunFile.destroy({
      where: {
        ingestionRunId: {
          [Op.in]: sequelize.literal(
            `(select id from billing_ingestion_runs where billing_source_id = ${sequelize.escape(billingSourceId)})`,
          ),
        },
      } as never,
    });

    await Promise.all([
      AggCostHourly.destroy({ where: { tenantId } }),
      AggCostDaily.destroy({ where: { tenantId } }),
      AggCostMonthly.destroy({ where: { tenantId } }),
      CostPeriodStatus.destroy({ where: { tenantId } }),
      FactCostAllocations.destroy({
        where: {
          factId: {
            [Op.in]: sequelize.literal(
              `(select id from fact_cost_line_items where tenant_id = ${sequelize.escape(tenantId)})`,
            ),
          },
        } as never,
      }),
      FactCommitmentCoverage.destroy({ where: { tenantId } }),
      FactRecommendations.destroy({ where: { tenantId } }),
      FactAnomalies.destroy({ where: { tenantId } }),
      FactCostLineItems.destroy({ where: { tenantId } }),
      FactDbResourceDaily.destroy({ where: { tenantId } }),
      DbUtilizationDaily.destroy({ where: { tenantId } }),
      DbCostHistoryDaily.destroy({ where: { tenantId } }),
      DbResourceInventorySnapshot.destroy({ where: { tenantId } }),
      FactEc2InstanceCoverageDaily.destroy({ where: { tenantId } }),
      FactEc2InstanceCostDaily.destroy({ where: { tenantId } }),
      FactEc2InstanceDaily.destroy({ where: { tenantId } }),
      Ec2InstanceUtilizationHourly.destroy({ where: { tenantId } }),
      Ec2InstanceUtilizationDaily.destroy({ where: { tenantId } }),
      FactEbsVolumeDaily.destroy({ where: { tenantId } }),
      EbsVolumeUtilizationHourly.destroy({ where: { tenantId } }),
      EbsVolumeUtilizationDaily.destroy({ where: { tenantId } }),
      Ec2InstanceInventorySnapshot.destroy({ where: { tenantId } }),
      Ec2VolumeInventorySnapshot.destroy({ where: { tenantId } }),
      Ec2SnapshotInventorySnapshot.destroy({ where: { tenantId } }),
      Ec2EipInventorySnapshot.destroy({ where: { tenantId } }),
      Ec2AmiInventorySnapshot.destroy({ where: { tenantId } }),
      Ec2LoadBalancerInventorySnapshot.destroy({ where: { tenantId } }),
      Ec2TargetGroupInventorySnapshot.destroy({ where: { tenantId } }),
      Ec2CostHistoryDaily.destroy({ where: { tenantId } }),
      Ec2CostHistoryMonthly.destroy({ where: { tenantId } }),
      ResourceInventorySnapshot.destroy({ where: { tenantId } }),
      ResourceUtilizationDaily.destroy({ where: { tenantId } }),
      S3BucketConfigSnapshot.destroy({ where: { tenantId } }),
      S3BucketCostSummaryDaily.destroy({ where: { tenantId } }),
      S3StorageLensDaily.destroy({ where: { tenantId } }),
      ScheduledJob.destroy({ where: { tenantId } }),
      CloudEvent.destroy({ where: { tenantId } }),
      CloudtrailSource.destroy({ where: { tenantId } }),
      Budgets.destroy({ where: { tenantId } }),
      AnomalyDetectionRun.destroy({ where: { tenantId } }),
    ]);

    await BillingIngestionRun.destroy({ where: { billingSourceId } });
    await RawBillingFile.destroy({ where: { billingSourceId } });
  });
}

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

  await cleanupIngestionDataForConnection(connectionId);

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

  console.info("Local file ingestion completed", {
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
      "Local file ingestion with cleanup failed:",
      error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await ingestionOrchestrator.waitForPendingPostIngestionTasks();
    restoreSetImmediate();
    await sequelize.close();
  });
