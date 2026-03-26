import type { RequestHandler } from "express";
import { logger } from "../utils/logger.js";

export const requestLoggerMiddleware: RequestHandler = (req, res, next) => {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const durationInMs = Number(process.hrtime.bigint() - start) / 1_000_000;

    logger.info("HTTP request completed", {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Number(durationInMs.toFixed(2)),
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });
  });

  next();
};
