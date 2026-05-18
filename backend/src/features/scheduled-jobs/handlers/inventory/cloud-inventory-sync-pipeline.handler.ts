import type { ScheduledJob } from "../../../../models/ec2/scheduled_jobs.js";
import { logger } from "../../../../utils/logger.js";
import { CloudInventorySyncPipelineService } from "./cloud-inventory-sync-pipeline.service.js";

const pipelineService = new CloudInventorySyncPipelineService();

export async function handleCloudInventorySyncPipeline(job: ScheduledJob): Promise<void> {
  logger.info("Cloud inventory sync pipeline handler invoked", {
    jobId: String(job.id),
    tenantId: job.tenantId ? String(job.tenantId) : null,
    cloudConnectionId: job.cloudConnectionId ? String(job.cloudConnectionId) : null,
  });

  await pipelineService.run(job);
}

