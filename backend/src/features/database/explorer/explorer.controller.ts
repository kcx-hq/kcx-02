import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../../constants/http-status.js";
import { sendSuccess } from "../../../utils/api-response.js";
import { DatabaseExplorerService } from "./explorer.service.js";
import { parseExplorerQuery } from "./explorer.validators.js";

const explorerService = new DatabaseExplorerService();

export async function handleGetDatabaseExplorer(req: Request, res: Response): Promise<void> {
  const params = parseExplorerQuery(req);
  const data = await explorerService.getExplorerData(params);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Database explorer loaded",
    data,
  });
}
