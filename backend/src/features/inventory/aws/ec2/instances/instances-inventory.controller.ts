import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../../../../constants/http-status.js";
import { UnauthorizedError } from "../../../../../errors/http-errors.js";
import { sendSuccess } from "../../../../../utils/api-response.js";
import {
  parseInstancesInventoryDetailQuery,
  parseInstancesInventoryListQuery,
  parseInstancesInventoryPerformanceQuery,
} from "./instances-inventory.schema.js";
import { InstancesInventoryService } from "./instances-inventory.service.js";

const instancesInventoryService = new InstancesInventoryService();

const requireTenantContext = (req: Request): { tenantId: string } => {
  const tenantId = req.auth?.user?.tenantId?.trim();
  if (!tenantId) {
    throw new UnauthorizedError("Tenant context required");
  }
  return { tenantId };
};

export async function handleListInventoryAwsEc2Instances(
  req: Request,
  res: Response,
): Promise<void> {
  const { tenantId } = requireTenantContext(req);
  const query = parseInstancesInventoryListQuery(req);
  const data = await instancesInventoryService.listInstances({ tenantId, query });

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Inventory EC2 instances fetched successfully",
    data,
  });
}

export async function handleGetInventoryAwsEc2InstancePerformance(
  req: Request,
  res: Response,
): Promise<void> {
  const { tenantId } = requireTenantContext(req);
  const query = parseInstancesInventoryPerformanceQuery(req);
  const data = await instancesInventoryService.getInstancePerformance({
    tenantId,
    query,
  });

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Inventory EC2 instance performance fetched successfully",
    data,
  });
}

export async function handleGetInventoryAwsEc2InstanceDetails(
  req: Request,
  res: Response,
): Promise<void> {
  const { tenantId } = requireTenantContext(req);
  const query = parseInstancesInventoryDetailQuery(req);
  const data = await instancesInventoryService.getInstanceDetails({
    tenantId,
    query,
  });

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Inventory EC2 instance details fetched successfully",
    data,
  });
}

