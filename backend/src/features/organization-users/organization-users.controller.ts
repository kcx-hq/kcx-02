import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../constants/http-status.js";
import { UnauthorizedError } from "../../errors/http-errors.js";
import { sendSuccess } from "../../utils/api-response.js";
import {
  approveOrganizationUser,
  getOrganizationUsers,
  inviteOrganizationUser,
  updateOrganizationUserStatus,
} from "./organization-users.service.js";
import {
  parseInviteOrganizationUserBody,
  parseOrganizationUserIdParam,
  parseUpdateOrganizationUserStatusBody,
} from "./organization-users.validator.js";

const requireTenantContext = (req: Request): { tenantId: string; actorUserId: string } => {
  const tenantId = req.auth?.user?.tenantId;
  const actorUserId = String(req.auth?.user?.id ?? "");
  if (!tenantId || !actorUserId) {
    throw new UnauthorizedError("User context is required");
  }
  return { tenantId, actorUserId };
};

export async function handleGetOrganizationUsers(req: Request, res: Response): Promise<void> {
  const { tenantId, actorUserId } = requireTenantContext(req);
  const data = await getOrganizationUsers({ tenantId, actorUserId });
  sendSuccess({ res, req, statusCode: HTTP_STATUS.OK, message: "Organization users fetched", data });
}

export async function handleInviteOrganizationUser(req: Request, res: Response): Promise<void> {
  const { tenantId, actorUserId } = requireTenantContext(req);
  const payload = parseInviteOrganizationUserBody(req.body);
  const data = await inviteOrganizationUser({ tenantId, actorUserId, payload });
  sendSuccess({ res, req, statusCode: HTTP_STATUS.CREATED, message: "User invited", data });
}

export async function handleApproveOrganizationUser(req: Request, res: Response): Promise<void> {
  const { tenantId, actorUserId } = requireTenantContext(req);
  const { userId } = parseOrganizationUserIdParam(req.params);
  const data = await approveOrganizationUser({
    tenantId,
    actorUserId,
    targetUserId: userId,
  });
  sendSuccess({ res, req, statusCode: HTTP_STATUS.OK, message: "User approved", data });
}

export async function handleUpdateOrganizationUserStatus(req: Request, res: Response): Promise<void> {
  const { tenantId, actorUserId } = requireTenantContext(req);
  const { userId } = parseOrganizationUserIdParam(req.params);
  const { status } = parseUpdateOrganizationUserStatusBody(req.body);
  const data = await updateOrganizationUserStatus({
    tenantId,
    actorUserId,
    targetUserId: userId,
    status,
  });
  sendSuccess({ res, req, statusCode: HTTP_STATUS.OK, message: "User status updated", data });
}

