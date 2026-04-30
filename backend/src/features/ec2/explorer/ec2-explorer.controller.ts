import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../../constants/http-status.js";
import { sendSuccess } from "../../../utils/api-response.js";
import { buildDashboardRequest } from "../../dashboard/shared/dashboard-request-builder.js";
import { DashboardScopeResolver } from "../../dashboard/shared/dashboard-scope-resolver.service.js";
import { validateDashboardRequest } from "../../dashboard/shared/validator.js";
import { mapEc2ExplorerResponse } from "./ec2-explorer.mapper.js";
import { buildEc2ExplorerInput } from "./ec2-explorer.schema.js";
import { Ec2ExplorerService } from "./ec2-explorer.service.js";

const scopeResolver = new DashboardScopeResolver();
const explorerService = new Ec2ExplorerService();

export async function handleGetEc2Explorer(req: Request, res: Response): Promise<void> {
  const dashboardRequest = buildDashboardRequest(req);
  validateDashboardRequest(dashboardRequest);
  const scope = await scopeResolver.resolve(dashboardRequest);
  const input = buildEc2ExplorerInput(req, scope);
  const data = await explorerService.getExplorer(input);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "EC2 explorer data fetched successfully",
    data: mapEc2ExplorerResponse(data),
  });
}

export async function handleGetEc2ExplorerNetworkBreakdown(req: Request, res: Response): Promise<void> {
  const dashboardRequest = buildDashboardRequest(req);
  validateDashboardRequest(dashboardRequest);
  const scope = await scopeResolver.resolve(dashboardRequest);
  const input = buildEc2ExplorerInput(req, scope);
  const data = await explorerService.getNetworkBreakdown(input);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "EC2 explorer network breakdown fetched successfully",
    data,
  });
}
