import type { Request, Response } from "express";
import { HTTP_STATUS } from "../../../constants/http-status.js";
import { sendSuccess } from "../../../utils/api-response.js";
import { getCostExplorerDashboardData } from "./cost-explorer.service.js";

export async function handleGetCostExplorerDashboard(req: Request, res: Response): Promise<void> {
  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Cost Explorer dashboard data fetched successfully",
    data: getCostExplorerDashboardData(),
  });
}
