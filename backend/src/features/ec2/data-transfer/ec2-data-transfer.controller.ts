import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../../constants/http-status.js";
import { sendSuccess } from "../../../utils/api-response.js";
import { buildDashboardRequest } from "../../dashboard/shared/dashboard-request-builder.js";
import { DashboardScopeResolver } from "../../dashboard/shared/dashboard-scope-resolver.service.js";
import { validateDashboardRequest } from "../../dashboard/shared/validator.js";
import { buildEc2DataTransferInput } from "./ec2-data-transfer.schema.js";
import { Ec2DataTransferService } from "./ec2-data-transfer.service.js";

const scopeResolver = new DashboardScopeResolver();
const dataTransferService = new Ec2DataTransferService();

export async function handleGetEc2DataTransfer(req: Request, res: Response): Promise<void> {
  const dashboardRequest = buildDashboardRequest(req);
  validateDashboardRequest(dashboardRequest);
  const scope = await scopeResolver.resolve(dashboardRequest);
  const input = buildEc2DataTransferInput(req, scope);
  const data = await dataTransferService.getDataTransfer(input);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "EC2 data transfer fetched successfully",
    data,
  });
}
