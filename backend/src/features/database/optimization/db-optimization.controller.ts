import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../../constants/http-status.js";
import { sendSuccess } from "../../../utils/api-response.js";
import { DbOptimizationService } from "./db-optimization.service.js";
import { parseDbOptimizationActionsQuery } from "./db-optimization.validators.js";

const service = new DbOptimizationService();

export async function handleGetDatabaseOptimizationActions(
  req: Request,
  res: Response,
): Promise<void> {
  const query = parseDbOptimizationActionsQuery(req);
  const data = await service.getActions(query);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Database optimization actions loaded",
    data,
  });
}

