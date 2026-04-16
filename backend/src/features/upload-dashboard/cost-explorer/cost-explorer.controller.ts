import type { Request, Response } from "express";
import { HTTP_STATUS } from "../../../constants/http-status.js";
import { sendSuccess } from "../../../utils/api-response.js";
import { buildDashboardRequest } from "../shared/dashboard-request-builder.js";
import { DashboardScopeResolver } from "../shared/dashboard-scope-resolver.service.js";
import { validateDashboardRequest } from "../shared/validator.js";
import { buildCostExplorerFilters, buildCostExplorerGroupOptionsFilters } from "./cost-explorer.schema.js";
import { CostExplorerService } from "./cost-explorer.service.js";

const scopeResolver = new DashboardScopeResolver();
const costExplorerService = new CostExplorerService();

export async function handleGetCostExplorerDashboard(req: Request, res: Response): Promise<void> {
  const dashboardRequest = buildDashboardRequest(req);
  validateDashboardRequest(dashboardRequest);
  const scope = await scopeResolver.resolve(dashboardRequest);
  const filters = buildCostExplorerFilters(req);
  const data = await costExplorerService.getCostExplorer(scope, filters);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Cost Explorer dashboard data fetched successfully",
    data,
  });
}

export async function handleGetCostExplorerGroupOptions(req: Request, res: Response): Promise<void> {
  const dashboardRequest = buildDashboardRequest(req);
  validateDashboardRequest(dashboardRequest);
  const scope = await scopeResolver.resolve(dashboardRequest);
  const filters = buildCostExplorerGroupOptionsFilters(req);
  const data = await costExplorerService.getGroupOptions(scope, filters.tagKey);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Cost Explorer group options fetched successfully",
    data,
  });
}
