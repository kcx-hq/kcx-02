import env from "../../../../config/env.js";
import { logger } from "../../../../utils/logger.js";
import { processQueuedRightsizingActions } from "./rightsizing-actions.service.js";

let timer: NodeJS.Timeout | null = null;
let startupTimer: NodeJS.Timeout | null = null;

export function startRightsizingActionProcessor(): () => void {
  if (!env.optimizationRightsizingActionProcessorEnabled) {
    logger.info("Rightsizing action processor disabled via config");
    return () => {};
  }

  startupTimer = setTimeout(() => {
    void processQueuedRightsizingActions();
  }, env.optimizationRightsizingActionProcessorStartupDelayMs);

  timer = setInterval(() => {
    void processQueuedRightsizingActions();
  }, env.optimizationRightsizingActionProcessorIntervalMs);

  logger.info("Rightsizing action processor started", {
    intervalMs: env.optimizationRightsizingActionProcessorIntervalMs,
    startupDelayMs: env.optimizationRightsizingActionProcessorStartupDelayMs,
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
    logger.info("Rightsizing action processor stopped");
  };
}

