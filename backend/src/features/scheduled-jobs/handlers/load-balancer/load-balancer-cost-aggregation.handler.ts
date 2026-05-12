import type { ScheduledJob } from "../../../../models/ec2/scheduled_jobs.js";
import { logger } from "../../../../utils/logger.js";
import { runLoadBalancerCostAggregationForScheduledJob } from "./load-balancer-cost-aggregation.service.js";

export async function handleLoadBalancerCostAggregation(job: ScheduledJob): Promise<void> {
  logger.info("Load balancer cost aggregation handler invoked", {
    jobId: String(job.id),
    tenantId: job.tenantId ? String(job.tenantId) : null,
    cloudConnectionId: job.cloudConnectionId ? String(job.cloudConnectionId) : null,
  });

  await runLoadBalancerCostAggregationForScheduledJob(job);
}

