import type { Request, Response } from "express";
import { HTTP_STATUS } from "../../../constants/http-status.js";
import { sendSuccess } from "../../../utils/api-response.js";
import { buildDashboardRequest } from "../shared/dashboard-request-builder.js";
import { DashboardScopeResolver } from "../shared/dashboard-scope-resolver.service.js";
import { validateDashboardRequest } from "../shared/validator.js";
import { buildCostHistoryFilters } from "./cost-history.schema.js";
import { CostHistoryService } from "./cost-history.service.js";

const scopeResolver = new DashboardScopeResolver();
const costHistoryService = new CostHistoryService();

export async function handleGetCostHistoryFilters(req: Request, res: Response): Promise<void> {
  const dashboardRequest = buildDashboardRequest(req);
  validateDashboardRequest(dashboardRequest);
  const scope = await scopeResolver.resolve(dashboardRequest);
  const data = await costHistoryService.getFilterOptions(scope);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Cost History filter options fetched successfully",
    data,
  });
}

export async function handleGetCostHistory(req: Request, res: Response): Promise<void> {
  const dashboardRequest = buildDashboardRequest(req);
  validateDashboardRequest(dashboardRequest);
  const scope = await scopeResolver.resolve(dashboardRequest);
  const filters = buildCostHistoryFilters(req);
  const data = await costHistoryService.getCostHistory(scope, filters);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Cost History data fetched successfully",
    data,
  });
}

