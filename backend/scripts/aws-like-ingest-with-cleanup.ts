// @ts-nocheck
import { Op } from "sequelize";
import { sequelize } from "../src/models/index.js";
import {
  manuallyIngestFile,
  manuallyIngestLatestFile,
  queueExportManifestFromEvent,
} from "../src/features/cloud-connections/aws/exports/aws-export-ingestion.service.js";
import { ingestionOrchestrator } from "../src/features/billing/services/ingestion-orchestrator.service.js";
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
} from "../src/models/index.js";

type CliArgs = {
  connectionId: string;
  fileKey: string | null;
};

const parseArgs = (argv: string[]): CliArgs => {
  const args = argv.slice(2);
  const connectionId = String(args[0] ?? "").trim();
  const fileKey = String(args[1] ?? "").trim() || null;
  return { connectionId, fileKey };
};

const printUsage = (): void => {
  console.error(
    "Usage: node dist/scripts/aws-like-ingest-with-cleanup.js <connectionId> [fileKey|Manifest.json key]",
  );
};

const isManifestKey = (value: string | null): boolean => {
  if (!value) return false;
  return value.toLowerCase().endsWith("manifest.json");
};

async function cleanupIngestionDataForConnection(connectionId: string): Promise<void> {
  const connection = await CloudConnectionV2.findByPk(connectionId);
  if (!connection) {
    throw new Error("Cloud connection not found");
  }

  const billingSource = await BillingSource.findOne({
    where: { cloudConnectionId: connection.id },
    order: [["updatedAt", "DESC"]],
  });
  if (!billingSource) {
    throw new Error("Billing source not found for connection");
  }

  const tenantId = connection.tenantId;
  const cloudConnectionId = String(connection.id);
  const billingSourceId = String(billingSource.id);

  // Keep core records (user/tenant/cloud connection/billing source) intact.
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

  console.info("Cleanup completed before AWS-like ingestion", {
    tenantId,
    cloudConnectionId,
    billingSourceId,
    keptTables: ["users", "tenants", "cloud_connection_v2", "billing_sources"],
  });
}

async function main(): Promise<void> {
  const { connectionId, fileKey } = parseArgs(process.argv);
  if (!connectionId) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  await cleanupIngestionDataForConnection(connectionId);

  if (isManifestKey(fileKey)) {
    const connection = await CloudConnectionV2.findByPk(connectionId);
    if (!connection) {
      throw new Error("Cloud connection not found");
    }
    const billingSource = await BillingSource.findOne({
      where: { cloudConnectionId: connection.id },
      order: [["updatedAt", "DESC"]],
    });
    if (!billingSource) {
      throw new Error("Billing source not found for connection");
    }

    const manifestResult = await queueExportManifestFromEvent({
      callbackToken: String(connection.callbackToken ?? "").trim(),
      accountId: String(connection.cloudAccountId ?? "").trim(),
      region: String(connection.exportRegion ?? connection.region ?? "").trim(),
      roleArn: String(connection.billingRoleArn ?? "").trim(),
      bucketName: String(billingSource.bucketName ?? connection.exportBucket ?? "").trim(),
      manifestKey: fileKey!,
    });

    if (manifestResult.queued && manifestResult.ingestionRunId) {
      await ingestionOrchestrator.processIngestionRun(manifestResult.ingestionRunId);
    }

    console.info("AWS-like manifest ingestion completed", {
      connectionId,
      manifestKey: fileKey,
      queued: manifestResult.queued,
      skipped: manifestResult.skipped,
      reason: manifestResult.reason ?? null,
      ingestionRunId: manifestResult.ingestionRunId ?? null,
      parquetFileCount: manifestResult.parquetFileCount ?? null,
    });
    return;
  }

  const result = fileKey
    ? await manuallyIngestFile(connectionId, fileKey)
    : await manuallyIngestLatestFile(connectionId);

  console.info("AWS-like ingestion completed", {
    connectionId,
    fileKey: result.fileKey,
    recordsProcessed: result.recordsProcessed,
    message: result.message,
  });
}

main()
  .catch((error) => {
    console.error(
      "AWS-like ingestion with cleanup failed:",
      error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
