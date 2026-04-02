import type { Request, Response } from "express";
import { HTTP_STATUS } from "../../../constants/http-status.js";
import { sendSuccess } from "../../../utils/api-response.js";
import { getAllocationDashboardData } from "./allocation.service.js";

export async function handleGetAllocationDashboard(req: Request, res: Response): Promise<void> {
  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Allocation dashboard data fetched successfully",
    data: getAllocationDashboardData(),
  });
}
