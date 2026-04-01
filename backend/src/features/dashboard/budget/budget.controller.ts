import type { Request, Response } from "express";
import { HTTP_STATUS } from "../../../constants/http-status.js";
import { sendSuccess } from "../../../utils/api-response.js";
import { getBudgetDashboardData } from "./budget.service.js";

export async function handleGetBudgetDashboard(req: Request, res: Response): Promise<void> {
  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Budget dashboard data fetched successfully",
    data: getBudgetDashboardData(),
  });
}
