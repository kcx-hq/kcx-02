import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

const REQUEST_ID_HEADER = "x-request-id";

export const requestIdMiddleware: RequestHandler = (req, res, next) => {
  const incomingRequestId = req.header(REQUEST_ID_HEADER);
  const requestId = incomingRequestId?.trim() || randomUUID();

  req.requestId = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);

  next();
};
