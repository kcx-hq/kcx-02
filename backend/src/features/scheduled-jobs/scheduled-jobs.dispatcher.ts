import type { ScheduledJob } from "../../models/ec2/scheduled_jobs.js";

import { getRegisteredScheduledJob, toScheduledJobType } from "./scheduled-jobs.registry.js";

export async function dispatchScheduledJob(job: ScheduledJob): Promise<void> {
  const jobType = toScheduledJobType(String(job.jobType));
  const registered = getRegisteredScheduledJob(jobType);
  await registered.handler(job);
}

