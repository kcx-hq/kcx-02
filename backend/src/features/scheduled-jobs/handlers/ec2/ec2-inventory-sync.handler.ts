import type { ScheduledJob } from "../../../../models/ec2/scheduled_jobs.js";
import { logger } from "../../../../utils/logger.js";
import { syncEc2InventoryForScheduledJob } from "./ec2-inventory-sync.service.js";

export async function handleEc2InventorySync(job: ScheduledJob): Promise<void> {
  logger.info("EC2 inventory sync handler invoked", {
    jobId: String(job.id),
    tenantId: job.tenantId ? String(job.tenantId) : null,
    cloudConnectionId: job.cloudConnectionId ? String(job.cloudConnectionId) : null,
  });

  await syncEc2InventoryForScheduledJob(job);
}
