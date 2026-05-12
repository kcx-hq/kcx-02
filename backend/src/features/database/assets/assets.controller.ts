import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../../constants/http-status.js";
import { NotFoundError } from "../../../errors/http-errors.js";
import { sendSuccess } from "../../../utils/api-response.js";
import { DatabaseAssetsService } from "./assets.service.js";
import { parseAssetDetailQuery, parseAssetsQuery } from "./assets.validators.js";

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

export async function handleGetDatabaseAssetDetail(req: Request, res: Response): Promise<void> {
  const params = parseAssetDetailQuery(req);
  const data = await assetsService.getAssetDetail(params);

  if (!data) {
    throw new NotFoundError("Database asset detail not found for selected resource and date range");
  }

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Database asset detail loaded",
    data,
  });
}
