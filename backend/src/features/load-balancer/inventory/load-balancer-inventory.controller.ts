import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../../constants/http-status.js";
import { NotFoundError, UnauthorizedError } from "../../../errors/http-errors.js";
import { sendSuccess } from "../../../utils/api-response.js";
import { parseLoadBalancerInventoryListQuery } from "./load-balancer-inventory.schema.js";
import { LoadBalancerInventoryListService } from "./load-balancer-inventory.service.js";

const service = new LoadBalancerInventoryListService();

const requireTenantContext = (req: Request): { tenantId: string } => {
  const tenantId = req.auth?.user?.tenantId?.trim();
  if (!tenantId) {
    throw new UnauthorizedError("Tenant context required");
  }
  return { tenantId };
};

export async function handleListInventoryAwsLoadBalancers(req: Request, res: Response): Promise<void> {
  const { tenantId } = requireTenantContext(req);
  const query = parseLoadBalancerInventoryListQuery(req);
  const data = await service.listLoadBalancers({ tenantId, query });

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Inventory AWS load balancers fetched successfully",
    data,
  });
}

export async function handleGetInventoryAwsLoadBalancerDetail(req: Request, res: Response): Promise<void> {
  const { tenantId } = requireTenantContext(req);
  const loadBalancerId = String(req.params.loadBalancerId ?? "").trim();
  if (!loadBalancerId) {
    throw new NotFoundError("Load balancer identifier is required");
  }

  const data = await service.getLoadBalancerDetail({ tenantId, loadBalancerId });
  if (!data) {
    throw new NotFoundError("Load balancer not found");
  }

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Inventory AWS load balancer detail fetched successfully",
    data,
  });
}
