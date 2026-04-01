import type { Request, Response } from "express";
import { HTTP_STATUS } from "../../../constants/http-status.js";
import { sendSuccess } from "../../../utils/api-response.js";
import { getAnomaliesAlertsDashboardData } from "./anomalies-alerts.service.js";

export async function handleGetAnomaliesAlertsDashboard(req: Request, res: Response): Promise<void> {
  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Anomalies & Alerts dashboard data fetched successfully",
    data: getAnomaliesAlertsDashboardData(),
  });
}
