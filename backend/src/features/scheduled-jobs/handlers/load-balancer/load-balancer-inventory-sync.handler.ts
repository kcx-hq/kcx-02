import type { ScheduledJob } from "../../../../models/ec2/scheduled_jobs.js";
import { logger } from "../../../../utils/logger.js";
import { syncLoadBalancerInventoryForScheduledJob } from "../../../load-balancer/load-balancer-inventory.service.js";

export async function handleLoadBalancerInventorySync(job: ScheduledJob): Promise<void> {
  logger.info("Load balancer inventory sync handler invoked", {
    jobId: String(job.id),
    tenantId: job.tenantId ? String(job.tenantId) : null,
    cloudConnectionId: job.cloudConnectionId ? String(job.cloudConnectionId) : null,
  });

  await syncLoadBalancerInventoryForScheduledJob(job);
}
