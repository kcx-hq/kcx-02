import type { ScheduledJob } from "../../../../models/ec2/scheduled_jobs.js";
import { logger } from "../../../../utils/logger.js";
import { rollupEc2DailyUtilizationForScheduledJob } from "./ec2-daily-rollup.service.js";

export async function handleEc2DailyRollup(job: ScheduledJob): Promise<void> {
  logger.info("EC2 daily rollup handler invoked", {
    jobId: String(job.id),
    tenantId: job.tenantId ? String(job.tenantId) : null,
    cloudConnectionId: job.cloudConnectionId ? String(job.cloudConnectionId) : null,
  });

  await rollupEc2DailyUtilizationForScheduledJob(job);
}
