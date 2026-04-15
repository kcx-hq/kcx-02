import type { ScheduledJob } from "../../../models/ec2/scheduled_jobs.js";

import { toScheduledJobType } from "./scheduled-jobs.types.js";
import { handleEc2DailyRollup } from "./handlers/ec2-daily-rollup.handler.js";
import { handleEc2InventorySync } from "./handlers/ec2-inventory-sync.handler.js";
import { handleEc2MetricsSync } from "./handlers/ec2-metrics-sync.handler.js";

export async function dispatchScheduledJob(job: ScheduledJob): Promise<void> {
  const jobType = toScheduledJobType(String(job.jobType));

  switch (jobType) {
    case "ec2_inventory_sync":
      await handleEc2InventorySync(job);
      return;
    case "ec2_metrics_sync":
      await handleEc2MetricsSync(job);
      return;
    case "ec2_daily_rollup":
      await handleEc2DailyRollup(job);
      return;
  }
}

