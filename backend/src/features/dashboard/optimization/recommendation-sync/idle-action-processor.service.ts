import env from "../../../../config/env.js";
import { logger } from "../../../../utils/logger.js";
import { processQueuedIdleActions } from "./idle-actions.service.js";

let timer: NodeJS.Timeout | null = null;
let startupTimer: NodeJS.Timeout | null = null;

export function startIdleActionProcessor(): () => void {
  if (!env.optimizationIdleActionProcessorEnabled) {
    logger.info("Idle action processor disabled via config");
    return () => {};
  }

  startupTimer = setTimeout(() => {
    void processQueuedIdleActions();
  }, env.optimizationIdleActionProcessorStartupDelayMs);

  timer = setInterval(() => {
    void processQueuedIdleActions();
  }, env.optimizationIdleActionProcessorIntervalMs);

  logger.info("Idle action processor started", {
    intervalMs: env.optimizationIdleActionProcessorIntervalMs,
    startupDelayMs: env.optimizationIdleActionProcessorStartupDelayMs,
  });

  return () => {
    if (startupTimer) {
      clearTimeout(startupTimer);
      startupTimer = null;
    }
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    logger.info("Idle action processor stopped");
  };
}

