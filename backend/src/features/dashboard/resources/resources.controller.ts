import type { Request, Response } from "express";
import { HTTP_STATUS } from "../../../constants/http-status.js";
import { sendSuccess } from "../../../utils/api-response.js";
import { getResourcesDashboardData } from "./resources.service.js";

export async function handleGetResourcesDashboard(req: Request, res: Response): Promise<void> {
  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Resources dashboard data fetched successfully",
    data: getResourcesDashboardData(),
  });
}
