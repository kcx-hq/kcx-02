import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../../constants/http-status.js";
import { sendSuccess } from "../../../utils/api-response.js";
import { DatabaseAssetsService } from "./assets.service.js";
import { parseAssetsQuery } from "./assets.validators.js";

const assetsService = new DatabaseAssetsService();

export async function handleGetDatabaseAssets(req: Request, res: Response): Promise<void> {
  const params = parseAssetsQuery(req);
  const data = await assetsService.getAssetsData(params);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Database assets loaded",
    data,
  });
}
