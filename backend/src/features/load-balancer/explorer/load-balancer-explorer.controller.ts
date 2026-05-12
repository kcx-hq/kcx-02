import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../../constants/http-status.js";
import { sendSuccess } from "../../../utils/api-response.js";
import { buildDashboardRequest } from "../../dashboard/shared/dashboard-request-builder.js";
import { DashboardScopeResolver } from "../../dashboard/shared/dashboard-scope-resolver.service.js";
import { validateDashboardRequest } from "../../dashboard/shared/validator.js";
import { buildLoadBalancerExplorerInput } from "./load-balancer-explorer.schema.js";
import { LoadBalancerExplorerService } from "./load-balancer-explorer.service.js";

const scopeResolver = new DashboardScopeResolver();
const explorerService = new LoadBalancerExplorerService();

export async function handleGetLoadBalancerExplorerSummary(req: Request, res: Response): Promise<void> {
  const dashboardRequest = buildDashboardRequest(req);
  validateDashboardRequest(dashboardRequest);
  const scope = await scopeResolver.resolve(dashboardRequest);
  const input = buildLoadBalancerExplorerInput(req, scope);
  const summary = await explorerService.getExplorerSummary(input);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Load balancer explorer summary fetched successfully",
    data: { summary },
  });
}

export async function handleGetLoadBalancerExplorerTrend(req: Request, res: Response): Promise<void> {
  const dashboardRequest = buildDashboardRequest(req);
  validateDashboardRequest(dashboardRequest);
  const scope = await scopeResolver.resolve(dashboardRequest);
  const input = buildLoadBalancerExplorerInput(req, scope);
  const graph = await explorerService.getExplorerTrend(input);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Load balancer explorer trend fetched successfully",
    data: { graph },
  });
}

export async function handleGetLoadBalancerExplorerGroupBy(req: Request, res: Response): Promise<void> {
  const dashboardRequest = buildDashboardRequest(req);
  validateDashboardRequest(dashboardRequest);
  const scope = await scopeResolver.resolve(dashboardRequest);
  const input = buildLoadBalancerExplorerInput(req, scope);
  const rows = await explorerService.getExplorerGroupBy(input);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Load balancer explorer group-by fetched successfully",
    data: {
      table: {
        columns: [
          { key: "group", label: "Group" },
          { key: "loadBalancerCount", label: "Load Balancer Count" },
          { key: "totalCost", label: "Total Cost" },
          { key: "avgCost", label: "Avg Cost" },
          { key: "fixedCost", label: "Fixed Cost" },
          { key: "lcuCost", label: "LCU Cost" },
          { key: "dataProcessingCost", label: "Data Processing Cost" },
        ],
        rows: rows.map((row) => ({
          id: `${input.groupBy}-${row.group}`,
          ...row,
        })),
      },
    },
  });
}
