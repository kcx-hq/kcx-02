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
  console.info("[COST-EXPLORER][GROUP-OPTIONS][REQUEST]", {
    path: req.path,
    scopeType: scope.scopeType,
    tenantId: scope.tenantId,
    from: scope.from,
    to: scope.to,
    tagKey: filters.tagKey,
    rawBillingFileIds:
      scope.scopeType === "upload" ? scope.rawBillingFileIds?.slice(0, 10) ?? [] : [],
  });
  const data = await costExplorerService.getGroupOptions(scope, filters.tagKey);
  console.info("[COST-EXPLORER][GROUP-OPTIONS][RESPONSE]", {
    scopeType: scope.scopeType,
    tenantId: scope.tenantId,
    tagKey: filters.tagKey,
    tagKeyCount: data.tagKeyOptions.length,
    tagValueCount: data.tagValueOptions.length,
    sampleTagKeys: data.tagKeyOptions.slice(0, 5).map((item) => item.normalizedKey),
    sampleTagValues: data.tagValueOptions.slice(0, 5).map((item) => item.key),
  });

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Cost Explorer group options fetched successfully",
    data,
  });
}
