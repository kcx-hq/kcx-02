import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../../constants/http-status.js";
import { sendSuccess } from "../../../utils/api-response.js";
import { buildDashboardRequest } from "../../dashboard/shared/dashboard-request-builder.js";
import { DashboardScopeResolver } from "../../dashboard/shared/dashboard-scope-resolver.service.js";
import { validateDashboardRequest } from "../../dashboard/shared/validator.js";
import { buildEc2CostExplorerInput } from "./ec2-cost-explorer.schema.js";
import { Ec2CostExplorerService } from "./ec2-cost-explorer.service.js";

const scopeResolver = new DashboardScopeResolver();
const service = new Ec2CostExplorerService();

export async function handleEc2CostExplorer(req: Request, res: Response): Promise<void> {
  const dashboardRequest = buildDashboardRequest(req);
  validateDashboardRequest(dashboardRequest);
  const scope = await scopeResolver.resolve(dashboardRequest);
  const input = buildEc2CostExplorerInput(req, scope);
  const data = await service.getCostExplorer(input);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "EC2 cost explorer v2 fetched successfully",
    data,
  });
}

