import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../../constants/http-status.js";
import { sendSuccess } from "../../../utils/api-response.js";
import { buildEc2InstanceHoursQuery } from "./ec2-instance-hours.schema.js";
import { Ec2InstanceHoursService } from "./ec2-instance-hours.service.js";

const ec2InstanceHoursService = new Ec2InstanceHoursService();

export async function handleGetEc2InstanceHours(req: Request, res: Response): Promise<void> {
  const input = buildEc2InstanceHoursQuery(req);
  const data = await ec2InstanceHoursService.getEc2InstanceHours(input);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "EC2 Instance Hours report fetched successfully",
    data,
  });
}

