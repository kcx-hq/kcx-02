import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../../constants/http-status.js";
import { sendSuccess } from "../../../utils/api-response.js";
import { buildDashboardRequest } from "../../dashboard/shared/dashboard-request-builder.js";
import { DashboardScopeResolver } from "../../dashboard/shared/dashboard-scope-resolver.service.js";
import { validateDashboardRequest } from "../../dashboard/shared/validator.js";
import { buildEc2ElasticIpInput } from "./ec2-eip.schema.js";
import { Ec2ElasticIpService } from "./ec2-eip.service.js";

const scopeResolver = new DashboardScopeResolver();
const elasticIpService = new Ec2ElasticIpService();

export async function handleGetEc2ElasticIps(req: Request, res: Response): Promise<void> {
  const dashboardRequest = buildDashboardRequest(req);
  validateDashboardRequest(dashboardRequest);
  const scope = await scopeResolver.resolve(dashboardRequest);
  const input = buildEc2ElasticIpInput(req, scope);
  const data = await elasticIpService.getElasticIps(input);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "EC2 elastic IPs fetched successfully",
    data,
  });
}
