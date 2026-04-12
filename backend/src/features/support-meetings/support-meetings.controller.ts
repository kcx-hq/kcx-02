import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../constants/http-status.js";
import { UnauthorizedError } from "../../errors/http-errors.js";
import { sendSuccess } from "../../utils/api-response.js";
import {
  applyClientSupportMeetingAction,
  approveAdminSupportMeeting,
  createClientSupportMeeting,
  getAdminSupportMeetings,
  getClientSupportMeetings,
  rejectAdminSupportMeeting,
} from "./support-meetings.service.js";

export async function handleGetClientSupportMeetings(req: Request, res: Response): Promise<void> {
  const tenantId = req.auth?.user?.tenantId;
  if (!tenantId) throw new UnauthorizedError("Tenant context is required");

  const data = await getClientSupportMeetings({ tenantId });
  sendSuccess({ res, req, statusCode: HTTP_STATUS.OK, message: "Support meetings fetched", data });
}

export async function handleCreateClientSupportMeeting(req: Request, res: Response): Promise<void> {
  const tenantId = req.auth?.user?.tenantId;
  const userId = req.auth?.user?.id;
  if (!tenantId || !userId) throw new UnauthorizedError("User context is required");

  const data = await createClientSupportMeeting({
    tenantId,
    userId: String(userId),
    payload: {
      meetingType: req.body?.meetingType,
      agenda: req.body?.agenda,
      mode: req.body?.mode,
      slotStart: req.body?.slotStart,
      slotEnd: req.body?.slotEnd,
      timeZone: req.body?.timeZone,
    },
  });

  sendSuccess({ res, req, statusCode: HTTP_STATUS.CREATED, message: "Support meeting created", data });
}

export async function handleClientSupportMeetingAction(req: Request, res: Response): Promise<void> {
  const tenantId = req.auth?.user?.tenantId;
  if (!tenantId) throw new UnauthorizedError("Tenant context is required");

  const meetingId = String(req.params.meetingId ?? "");
  const data = await applyClientSupportMeetingAction({
    tenantId,
    meetingId,
    action: req.body?.action,
  });
  sendSuccess({ res, req, statusCode: HTTP_STATUS.OK, message: "Support meeting updated", data });
}

export async function handleGetAdminSupportMeetings(req: Request, res: Response): Promise<void> {
  const data = await getAdminSupportMeetings();
  sendSuccess({ res, req, statusCode: HTTP_STATUS.OK, message: "Admin support meetings fetched", data });
}

export async function handleApproveAdminSupportMeeting(req: Request, res: Response): Promise<void> {
  const adminId = Number(req.auth?.user?.id ?? 0);
  if (!Number.isFinite(adminId) || adminId <= 0) throw new UnauthorizedError("Admin context is required");

  const meetingId = String(req.params.meetingId ?? "");
  const data = await approveAdminSupportMeeting({
    meetingId,
    adminId,
    meetingUrl: req.body?.meetingUrl,
  });
  sendSuccess({ res, req, statusCode: HTTP_STATUS.OK, message: "Support meeting approved", data });
}

export async function handleRejectAdminSupportMeeting(req: Request, res: Response): Promise<void> {
  const meetingId = String(req.params.meetingId ?? "");
  const data = await rejectAdminSupportMeeting({ meetingId });
  sendSuccess({ res, req, statusCode: HTTP_STATUS.OK, message: "Support meeting rejected", data });
}
