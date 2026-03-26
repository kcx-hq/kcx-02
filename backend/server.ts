import { createServer, type Server } from "node:http";
import app from "./app.js";
import env from "./src/config/env.js";
import { logger } from "./src/utils/logger.js";

const PORT = env.port;
const SHUTDOWN_TIMEOUT_MS = 10_000;

let server: Server | null = null;
let isShuttingDown = false;

const shutdown = (signal: string): void => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  logger.info("Shutdown initiated", { signal });

  if (!server) {
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

const startServer = (): void => {
  server = createServer(app);

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

startServer();
