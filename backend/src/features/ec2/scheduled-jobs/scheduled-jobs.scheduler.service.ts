import env from "../../../config/env.js";
import { logger } from "../../../utils/logger.js";

import { computeNextRunAt } from "./scheduled-jobs.next-run.js";
import { dispatchScheduledJob } from "./scheduled-jobs.dispatcher.js";
import { ScheduledJobsRepository } from "./scheduled-jobs.repository.js";
import type { ScheduledJob } from "./scheduled-jobs.types.js";

let timer: NodeJS.Timeout | null = null;
let isPolling = false;

const MAX_ERROR_MESSAGE_LENGTH = 2000;

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    const message = error.message?.trim() ? error.message.trim() : "Unknown error";
    return message.length > MAX_ERROR_MESSAGE_LENGTH ? message.slice(0, MAX_ERROR_MESSAGE_LENGTH) : message;
  }

  const message = String(error ?? "Unknown error").trim();
  return message.length > MAX_ERROR_MESSAGE_LENGTH ? message.slice(0, MAX_ERROR_MESSAGE_LENGTH) : message;
};

async function runScheduledJob(job: ScheduledJob, repository: ScheduledJobsRepository): Promise<"completed" | "failed"> {
  const jobId = String(job.id);
  const jobType = String(job.jobType);

  logger.info("Scheduled job started", {
    jobId,
    jobType,
    scheduleType: job.scheduleType,
    tenantId: job.tenantId ? String(job.tenantId) : null,
    cloudConnectionId: job.cloudConnectionId ? String(job.cloudConnectionId) : null,
  });

  try {
    await dispatchScheduledJob(job);

    const { nextRunAt, reason } = computeNextRunAt(job, new Date());
    if (reason !== "interval") {
      logger.warn("Scheduled job next run computed via stub", { jobId, jobType, scheduleType: job.scheduleType, reason });
    }

    await repository.markScheduledJobSuccess({ jobId, nextRunAt });
    logger.info("Scheduled job completed", { jobId, jobType, nextRunAt: nextRunAt.toISOString() });
    return "completed";
  } catch (error) {
    const errorMessage = toErrorMessage(error);

    let nextRunAt: Date;
    let nextRunReason: string | null = null;
    try {
      const computed = computeNextRunAt(job, new Date());
      nextRunAt = computed.nextRunAt;
      nextRunReason = computed.reason;
    } catch (nextRunError) {
      nextRunAt = new Date(Date.now() + 60_000);
      nextRunReason = `fallback:${toErrorMessage(nextRunError)}`;
    }

    await repository.markScheduledJobFailure({ jobId, errorMessage, nextRunAt });
    logger.warn("Scheduled job failed", {
      jobId,
      jobType,
      errorMessage,
      nextRunAt: nextRunAt.toISOString(),
      nextRunReason,
    });
    return "failed";
  }
}

export async function pollScheduledJobs({
  repository = new ScheduledJobsRepository(),
}: {
  repository?: ScheduledJobsRepository;
} = {}): Promise<void> {
  if (isPolling) {
    logger.info("Scheduled jobs poll skipped: previous poll still in progress");
    return;
  }

  isPolling = true;
  const startedAt = Date.now();

  const batchSize = env.ec2ScheduledJobsBatchSize;
  const maxBatches = env.ec2ScheduledJobsMaxBatchesPerPoll;

  let claimedCount = 0;
  let completedCount = 0;
  let failedCount = 0;
  let batchCount = 0;

  try {
    for (let batchIndex = 0; batchIndex < maxBatches; batchIndex += 1) {
      batchCount += 1;
      const claimedJobs = await repository.claimDueScheduledJobs({ limit: batchSize });
      if (claimedJobs.length === 0) {
        break;
      }

      claimedCount += claimedJobs.length;
      logger.info("Scheduled jobs claimed", { claimed: claimedJobs.length, batchIndex, batchSize });

      const results = await Promise.allSettled(claimedJobs.map((job) => runScheduledJob(job, repository)));
      for (const result of results) {
        if (result.status === "fulfilled") {
          if (result.value === "completed") completedCount += 1;
          if (result.value === "failed") failedCount += 1;
        } else {
          failedCount += 1;
        }
      }
    }
  } catch (error) {
    logger.error("Scheduled jobs poll failed", { error: toErrorMessage(error) });
  } finally {
    isPolling = false;
    logger.info("Scheduled jobs poll finished", {
      claimedCount,
      completedCount,
      failedCount,
      batchCount,
      batchSize,
      maxBatches,
      durationMs: Date.now() - startedAt,
    });
  }
}

export function startEc2ScheduledJobsScheduler({
  repository = new ScheduledJobsRepository(),
}: {
  repository?: ScheduledJobsRepository;
} = {}): () => void {
  if (!env.ec2ScheduledJobsSchedulerEnabled) {
    logger.info("EC2 scheduled jobs scheduler disabled via config");
    return () => {};
  }

  const intervalMs = env.ec2ScheduledJobsPollIntervalMs;

  void pollScheduledJobs({ repository });

  timer = setInterval(() => {
    void pollScheduledJobs({ repository });
  }, intervalMs);

  logger.info("EC2 scheduled jobs scheduler started", {
    pollIntervalMs: intervalMs,
    batchSize: env.ec2ScheduledJobsBatchSize,
    maxBatchesPerPoll: env.ec2ScheduledJobsMaxBatchesPerPoll,
  });

  return () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    logger.info("EC2 scheduled jobs scheduler stopped");
  };
}

