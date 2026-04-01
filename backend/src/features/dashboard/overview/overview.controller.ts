import type { Request, Response } from "express";
import { HTTP_STATUS } from "../../../constants/http-status.js";
import { sendSuccess } from "../../../utils/api-response.js";
import { getOverviewDashboardData } from "./overview.service.js";

export async function handleGetOverviewDashboard(req: Request, res: Response): Promise<void> {
  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Overview dashboard data fetched successfully",
    data: getOverviewDashboardData(),
  });
}
