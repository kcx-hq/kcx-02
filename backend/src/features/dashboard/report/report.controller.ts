import type { Request, Response } from "express";
import { HTTP_STATUS } from "../../../constants/http-status.js";
import { sendSuccess } from "../../../utils/api-response.js";
import { getReportDashboardData } from "./report.service.js";

export async function handleGetReportDashboard(req: Request, res: Response): Promise<void> {
  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Report dashboard data fetched successfully",
    data: getReportDashboardData(),
  });
}
