import { createServer, type Server } from "node:http";
import app from "./app.js";
import env from "./src/config/env.js";
import { startIdleRecommendationScheduler } from "./src/features/dashboard/optimization/recommendation-sync/idle-scheduler.service.js";
import { startRightsizingRecommendationScheduler } from "./src/features/dashboard/optimization/recommendation-sync/rightsizing-scheduler.service.js";
import { sequelize } from "./src/models/index.js";
import { logger } from "./src/utils/logger.js";

const PORT = env.port;
const SHUTDOWN_TIMEOUT_MS = 10_000;

let server: Server | null = null;
let isShuttingDown = false;
let stopIdleScheduler: (() => void) | null = null;
let stopRightsizingScheduler: (() => void) | null = null;

const shutdown = (signal: string): void => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  logger.info("Shutdown initiated", { signal });

  if (!server) {
    if (stopIdleScheduler) {
      stopIdleScheduler();
      stopIdleScheduler = null;
    }
    if (stopRightsizingScheduler) {
      stopRightsizingScheduler();
      stopRightsizingScheduler = null;
    }
    process.exit(0);
    return;
  }

  const forceExitTimer = setTimeout(() => {
    logger.error("Forced shutdown after timeout", {
      timeoutMs: SHUTDOWN_TIMEOUT_MS,
    });
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  server.close((error) => {
    clearTimeout(forceExitTimer);
    if (stopIdleScheduler) {
      stopIdleScheduler();
      stopIdleScheduler = null;
    }
    if (stopRightsizingScheduler) {
      stopRightsizingScheduler();
      stopRightsizingScheduler = null;
    }

    if (error) {
      logger.error("Error while shutting down server", {
        error: error.message,
      });
      process.exit(1);
      return;
    }

    logger.info("Server shutdown completed");
    process.exit(0);
  });
};

const startServer = async (): Promise<void> => {
  try {
    await sequelize.authenticate();
    logger.info("Database connected");
  } catch (error) {
    logger.error("Database connection failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }

  server = createServer(app);
  stopIdleScheduler = startIdleRecommendationScheduler();
  stopRightsizingScheduler = startRightsizingRecommendationScheduler();

  server.listen(PORT, () => {
    logger.info("Server running", {
      url: `http://localhost:${PORT}`,
      port: PORT,
    });
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("uncaughtException", (error: Error) => {
  logger.error("Uncaught exception", {
    error: error.message,
    stack: error.stack,
  });
  shutdown("uncaughtException");
});

process.on("unhandledRejection", (reason: unknown) => {
  logger.error("Unhandled rejection", {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
  shutdown("unhandledRejection");
});

void startServer();
