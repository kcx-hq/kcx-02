import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../../../../constants/http-status.js";
import { UnauthorizedError } from "../../../../../errors/http-errors.js";
import { sendSuccess } from "../../../../../utils/api-response.js";
import {
  parseVolumesInventoryDetailQuery,
  parseVolumesInventoryListQuery,
  parseVolumesInventoryPerformanceQuery,
} from "./volumes-inventory.schema.js";
import { VolumesInventoryService } from "./volumes-inventory.service.js";

const volumesInventoryService = new VolumesInventoryService();

const requireTenantContext = (req: Request): { tenantId: string } => {
  const tenantId = req.auth?.user?.tenantId?.trim();
  if (!tenantId) {
    throw new UnauthorizedError("Tenant context required");
  }
  return { tenantId };
};

export async function handleListInventoryAwsEc2Volumes(
  req: Request,
  res: Response,
): Promise<void> {
  const { tenantId } = requireTenantContext(req);
  const query = parseVolumesInventoryListQuery(req);
  const data = await volumesInventoryService.listVolumes({ tenantId, query });

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Inventory EC2 volumes fetched successfully",
    data,
  });
}

export async function handleGetInventoryAwsEc2VolumePerformance(
  req: Request,
  res: Response,
): Promise<void> {
  const { tenantId } = requireTenantContext(req);
  const query = parseVolumesInventoryPerformanceQuery(req);
  const data = await volumesInventoryService.getVolumePerformance({
    tenantId,
    query,
  });

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Inventory EC2 volume performance fetched successfully",
    data,
  });
}

export async function handleGetInventoryAwsEc2VolumeDetails(
  req: Request,
  res: Response,
): Promise<void> {
  const { tenantId } = requireTenantContext(req);
  const query = parseVolumesInventoryDetailQuery(req);
  const data = await volumesInventoryService.getVolumeDetails({
    tenantId,
    query,
  });

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Inventory EC2 volume details fetched successfully",
    data,
  });
}

