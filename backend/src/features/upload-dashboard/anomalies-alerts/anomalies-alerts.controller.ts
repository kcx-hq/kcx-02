import type { Request, Response } from "express";
import { HTTP_STATUS } from "../../../constants/http-status.js";
import { sendSuccess } from "../../../utils/api-response.js";

export async function handleGetUploadDashboardAnomaliesAlerts(req: Request, res: Response): Promise<void> {
  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Upload dashboard anomalies and alerts loaded",
    data: {
      section: "anomalies-alerts",
      placeholder: true,
      items: [],
    },
  });
}
