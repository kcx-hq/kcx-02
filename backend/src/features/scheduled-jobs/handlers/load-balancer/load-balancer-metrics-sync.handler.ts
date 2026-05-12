import type { ScheduledJob } from "../../../../models/ec2/scheduled_jobs.js";
import { runLoadBalancerMetricsSyncForScheduledJob } from "./load-balancer-metrics-sync.service.js";

export async function handleLoadBalancerMetricsSync(job: ScheduledJob): Promise<void> {
  await runLoadBalancerMetricsSyncForScheduledJob(job);
}

