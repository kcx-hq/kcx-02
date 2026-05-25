import { BillingSource } from "../../../../models/index.js";
import type { ScheduledJob } from "../../../../models/ec2/scheduled_jobs.js";
import { logger } from "../../../../utils/logger.js";
import { collectS3BucketConfigSnapshotsForBillingSource } from "../../../billing/services/s3-bucket-config-snapshot.service.js";
import { syncRdsAuroraInventory } from "../../../database/aws/inventory/rds-aurora/rds-aurora-inventory.sync.js";
import { syncLoadBalancerInventoryForScheduledJob } from "../../../load-balancer/load-balancer-inventory.service.js";
import { syncEc2InventoryForScheduledJob } from "../ec2/ec2-inventory-sync.service.js";

type PipelineServiceName = "ec2" | "load_balancer" | "rds_aurora" | "s3_bucket_config";

type PipelineStepResult = {
  service: PipelineServiceName;
  status: "completed" | "failed" | "skipped";
  durationMs: number;
  counts?: Record<string, unknown>;
  errorMessage?: string;
  errorStack?: string;
};

type PipelineSummary = {
  status: "completed" | "completed_with_warnings" | "failed";
  steps: PipelineStepResult[];
};

type PipelineDependencies = {
  syncEc2Inventory: (job: ScheduledJob) => Promise<void>;
  syncLoadBalancerInventory: (job: ScheduledJob) => Promise<void>;
  syncRdsAuroraInventory: (input: { tenantId: string; cloudConnectionId: string }) => Promise<{
    fetchedInstances: number;
    fetchedClusters: number;
    persisted: {
      instancesPersisted: number;
      clustersPersisted: number;
      totalPersisted: number;
      skippedInvalid: number;
    } | null;
  }>;
  collectS3BucketConfigSnapshots: (input: { tenantId: string; billingSourceId: string }) => Promise<{
    bucketsScanned: number;
    snapshotsCreated: number;
  }>;
  findBillingSourceIdForConnection: (input: {
    tenantId: string;
    cloudConnectionId: string;
    preferredBillingSourceId?: string | null;
  }) => Promise<string | null>;
};

const normalizeTrim = (value: unknown): string => String(value ?? "").trim();

const defaultDependencies: PipelineDependencies = {
  syncEc2Inventory: syncEc2InventoryForScheduledJob,
  syncLoadBalancerInventory: syncLoadBalancerInventoryForScheduledJob,
  syncRdsAuroraInventory,
  collectS3BucketConfigSnapshots: collectS3BucketConfigSnapshotsForBillingSource,
  findBillingSourceIdForConnection: async ({
    tenantId,
    cloudConnectionId,
    preferredBillingSourceId,
  }): Promise<string | null> => {
    const preferredId = normalizeTrim(preferredBillingSourceId);
    if (preferredId) {
      const preferred = await BillingSource.findOne({
        where: {
          id: preferredId,
          tenantId,
          cloudConnectionId,
        },
      });
      if (preferred) return String(preferred.id);
    }

    const source = await BillingSource.findOne({
      where: {
        tenantId,
        cloudConnectionId,
        status: "active",
      },
      order: [["updatedAt", "DESC"]],
    });
    return source ? String(source.id) : null;
  },
};

export class CloudInventorySyncPipelineService {
  constructor(private readonly deps: PipelineDependencies = defaultDependencies) {}

  private resolveCloudConnectionId(job: ScheduledJob): string {
    const fromJob = normalizeTrim(job.cloudConnectionId);
    if (fromJob) return fromJob;

    const config = (job.configJson ?? null) as Record<string, unknown> | null;
    const fromConfig = normalizeTrim(config?.cloud_connection_id);
    if (fromConfig) return fromConfig;

    throw new Error("cloudConnectionId is required for cloud_inventory_sync_pipeline");
  }

  private resolveTenantId(job: ScheduledJob): string {
    const fromJob = normalizeTrim(job.tenantId);
    if (fromJob) return fromJob;

    const config = (job.configJson ?? null) as Record<string, unknown> | null;
    const fromConfig = normalizeTrim(config?.tenant_id);
    if (fromConfig) return fromConfig;

    throw new Error("tenantId is required for cloud_inventory_sync_pipeline");
  }

  private async runStep(input: {
    scheduledJobId: string;
    cloudConnectionId: string;
    tenantId: string;
    service: PipelineServiceName;
    step: () => Promise<Record<string, unknown> | void>;
  }): Promise<PipelineStepResult> {
    const startedAt = Date.now();
    logger.info("inventory_step_started", {
      scheduledJobId: input.scheduledJobId,
      cloudConnectionId: input.cloudConnectionId,
      tenantId: input.tenantId,
      service: input.service,
      status: "started",
    });

    try {
      const counts = await input.step();
      const durationMs = Date.now() - startedAt;
      logger.info("inventory_step_completed", {
        scheduledJobId: input.scheduledJobId,
        cloudConnectionId: input.cloudConnectionId,
        tenantId: input.tenantId,
        service: input.service,
        status: "completed",
        durationMs,
        ...(counts ? { counts } : {}),
      });
      return {
        service: input.service,
        status: "completed",
        durationMs,
        ...(counts ? { counts } : {}),
      };
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.warn("inventory_step_failed", {
        scheduledJobId: input.scheduledJobId,
        cloudConnectionId: input.cloudConnectionId,
        tenantId: input.tenantId,
        service: input.service,
        status: "failed",
        durationMs,
        errorMessage,
        errorStack,
      });
      return {
        service: input.service,
        status: "failed",
        durationMs,
        errorMessage,
        errorStack,
      };
    }
  }

  async run(job: ScheduledJob): Promise<PipelineSummary> {
    const scheduledJobId = String(job.id);
    const tenantId = this.resolveTenantId(job);
    const cloudConnectionId = this.resolveCloudConnectionId(job);
    const config = (job.configJson ?? null) as Record<string, unknown> | null;
    const preferredBillingSourceId =
      normalizeTrim(job.billingSourceId) || normalizeTrim(config?.billing_source_id) || null;

    logger.info("cloud_inventory_pipeline_started", {
      scheduledJobId,
      cloudConnectionId,
      tenantId,
      status: "started",
    });

    const normalizedJob = {
      ...job,
      tenantId,
      cloudConnectionId,
    } as ScheduledJob;

    const steps: PipelineStepResult[] = [];
    steps.push(
      await this.runStep({
        scheduledJobId,
        cloudConnectionId,
        tenantId,
        service: "ec2",
        step: async () => {
          await this.deps.syncEc2Inventory(normalizedJob);
        },
      }),
    );

    steps.push(
      await this.runStep({
        scheduledJobId,
        cloudConnectionId,
        tenantId,
        service: "load_balancer",
        step: async () => {
          await this.deps.syncLoadBalancerInventory(normalizedJob);
        },
      }),
    );

    steps.push(
      await this.runStep({
        scheduledJobId,
        cloudConnectionId,
        tenantId,
        service: "rds_aurora",
        step: async () => {
          const result = await this.deps.syncRdsAuroraInventory({
            tenantId,
            cloudConnectionId,
          });
          return {
            fetchedInstances: result.fetchedInstances,
            fetchedClusters: result.fetchedClusters,
            persistedTotal: result.persisted?.totalPersisted ?? null,
          };
        },
      }),
    );

    steps.push(
      await this.runStep({
        scheduledJobId,
        cloudConnectionId,
        tenantId,
        service: "s3_bucket_config",
        step: async () => {
          const billingSourceId = await this.deps.findBillingSourceIdForConnection({
            tenantId,
            cloudConnectionId,
            preferredBillingSourceId,
          });
          if (!billingSourceId) {
            logger.info("inventory_step_completed", {
              scheduledJobId,
              cloudConnectionId,
              tenantId,
              service: "s3_bucket_config",
              status: "skipped",
              reason: "billing_source_not_found",
            });
            return {
              skipped: true,
              reason: "billing_source_not_found",
            };
          }

          const result = await this.deps.collectS3BucketConfigSnapshots({
            tenantId,
            billingSourceId,
          });
          return {
            billingSourceId,
            bucketsScanned: result.bucketsScanned,
            snapshotsCreated: result.snapshotsCreated,
          };
        },
      }),
    );

    const failedSteps = steps.filter((step) => step.status === "failed");
    const succeededSteps = steps.filter((step) => step.status === "completed");
    const allFailed = failedSteps.length === steps.length;

    if (allFailed) {
      logger.error("cloud_inventory_pipeline_failed", {
        scheduledJobId,
        cloudConnectionId,
        tenantId,
        status: "failed",
        stepCount: steps.length,
        failedStepCount: failedSteps.length,
      });
      const error = new Error("cloud inventory pipeline failed: all steps failed");
      (error as Error & { details?: PipelineStepResult[] }).details = steps;
      throw error;
    }

    const status = failedSteps.length > 0 ? "completed_with_warnings" : "completed";
    logger.info("cloud_inventory_pipeline_completed", {
      scheduledJobId,
      cloudConnectionId,
      tenantId,
      status,
      stepCount: steps.length,
      succeededStepCount: succeededSteps.length,
      failedStepCount: failedSteps.length,
    });

    return { status, steps };
  }
}

