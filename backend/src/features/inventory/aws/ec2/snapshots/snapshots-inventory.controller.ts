import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../../../../constants/http-status.js";
import { UnauthorizedError } from "../../../../../errors/http-errors.js";
import { sendSuccess } from "../../../../../utils/api-response.js";
import { parseSnapshotsInventoryListQuery } from "./snapshots-inventory.schema.js";
import { SnapshotsInventoryService } from "./snapshots-inventory.service.js";

const snapshotsInventoryService = new SnapshotsInventoryService();

const requireTenantContext = (req: Request): { tenantId: string } => {
  const tenantId = req.auth?.user?.tenantId?.trim();
  if (!tenantId) {
    throw new UnauthorizedError("Tenant context required");
  }
  return { tenantId };
};

export async function handleListInventoryAwsEc2Snapshots(
  req: Request,
  res: Response,
): Promise<void> {
  const { tenantId } = requireTenantContext(req);
  const query = parseSnapshotsInventoryListQuery(req);
  const data = await snapshotsInventoryService.listSnapshots({ tenantId, query });

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Inventory EC2 snapshots fetched successfully",
    data,
  });
}
