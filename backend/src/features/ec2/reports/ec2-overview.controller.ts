import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../../constants/http-status.js";
import { sendSuccess } from "../../../utils/api-response.js";
import { buildEc2OverviewQuery } from "./ec2-overview.schema.js";
import { Ec2OverviewService } from "./ec2-overview.service.js";

const ec2OverviewService = new Ec2OverviewService();

export async function handleGetEc2Overview(req: Request, res: Response): Promise<void> {
  const input = buildEc2OverviewQuery(req);
  const data = await ec2OverviewService.getEc2Overview(input);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "EC2 overview fetched successfully",
    data,
  });
}

