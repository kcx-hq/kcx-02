import type { ScheduledJob } from "../../../../models/ec2/scheduled_jobs.js";
import { logger } from "../../../../utils/logger.js";
import { syncEc2InstanceMetrics } from "./ec2-metrics-sync.service.js";
import { syncEbsVolumeMetrics } from "./ebs-volume-metrics-sync.service.js";

const DEFAULT_LOOKBACK_HOURS = 24;

export async function handleEc2MetricsSync(job: ScheduledJob): Promise<void> {
  const lookbackHours =
    typeof job.lookbackHours === "number" && Number.isFinite(job.lookbackHours) && job.lookbackHours > 0
      ? job.lookbackHours
      : DEFAULT_LOOKBACK_HOURS;

  logger.info("EC2 metrics sync handler invoked", {
    jobId: String(job.id),
    tenantId: job.tenantId ? String(job.tenantId) : null,
    cloudConnectionId: job.cloudConnectionId ? String(job.cloudConnectionId) : null,
    lookbackHours,
  });

  await syncEc2InstanceMetrics(job);
  await syncEbsVolumeMetrics(job);
}
