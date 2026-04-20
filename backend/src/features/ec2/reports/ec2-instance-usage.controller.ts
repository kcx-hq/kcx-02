import type { Request, Response } from "express";
import { HTTP_STATUS } from "../../../constants/http-status.js";
import { sendSuccess } from "../../../utils/api-response.js";
import { buildEc2InstanceUsageQuery } from "./ec2-instance-usage.schema.js";
import { Ec2InstanceUsageService } from "./ec2-instance-usage.service.js";

const ec2InstanceUsageService = new Ec2InstanceUsageService();

export async function handleGetEc2InstanceUsage(req: Request, res: Response): Promise<void> {
  const input = buildEc2InstanceUsageQuery(req);
  const data = await ec2InstanceUsageService.getEc2InstanceUsage(input);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "EC2 Instance Usage report fetched successfully",
    data,
  });
}

