import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../constants/http-status.js";
import { UnauthorizedError } from "../../errors/http-errors.js";
import { sendSuccess } from "../../utils/api-response.js";
import {
  applyClientSupportTicketAction,
  createClientSupportTicket,
  deleteAdminSupportTicket,
  clearAdminSupportTicketMessages,
  getAdminSupportTicketDetail,
  getAdminSupportTicketMessages,
  getAdminSupportTickets,
  getClientSupportTicketDetail,
  getClientSupportTicketMessages,
  getClientSupportTickets,
  sendClientSupportTicketMessage,
  sendAdminSupportTicketMessage,
  updateAdminSupportTicket,
} from "./support-tickets.service.js";

export async function handleGetClientSupportTickets(req: Request, res: Response): Promise<void> {
  const tenantId = req.auth?.user?.tenantId;
  if (!tenantId) throw new UnauthorizedError("Tenant context is required");

  const data = await getClientSupportTickets({ tenantId });
  sendSuccess({ res, req, statusCode: HTTP_STATUS.OK, message: "Support tickets fetched", data });
}

export async function handleCreateClientSupportTicket(req: Request, res: Response): Promise<void> {
  const tenantId = req.auth?.user?.tenantId;
  const userId = req.auth?.user?.id;
  if (!tenantId || !userId) throw new UnauthorizedError("User context is required");

  const data = await createClientSupportTicket({
    tenantId,
    userId: String(userId),
    payload: {
      title: req.body?.title,
      category: req.body?.category,
      priority: req.body?.priority,
      affected: req.body?.affected,
      attachments: req.body?.attachments,
      description: req.body?.description,
      saveAsDraft: req.body?.saveAsDraft,
    },
  });

  sendSuccess({ res, req, statusCode: HTTP_STATUS.CREATED, message: "Support ticket created", data });
}

export async function handleGetClientSupportTicketDetail(req: Request, res: Response): Promise<void> {
  const tenantId = req.auth?.user?.tenantId;
  if (!tenantId) throw new UnauthorizedError("Tenant context is required");
  const ticketId = String(req.params.ticketId ?? "");
  const data = await getClientSupportTicketDetail({ tenantId, ticketId });
  sendSuccess({ res, req, statusCode: HTTP_STATUS.OK, message: "Support ticket detail fetched", data });
}

export async function handleGetClientSupportTicketMessages(req: Request, res: Response): Promise<void> {
  const tenantId = req.auth?.user?.tenantId;
  if (!tenantId) throw new UnauthorizedError("Tenant context is required");
  const ticketId = String(req.params.ticketId ?? "");
  const data = await getClientSupportTicketMessages({ tenantId, ticketId });
  sendSuccess({ res, req, statusCode: HTTP_STATUS.OK, message: "Support ticket messages fetched", data });
}

export async function handlePostClientSupportTicketMessage(req: Request, res: Response): Promise<void> {
  const tenantId = req.auth?.user?.tenantId;
  const senderUserId = String(req.auth?.user?.id ?? "");
  const senderName = String(req.auth?.user?.email ?? "Client");
  if (!tenantId || !senderUserId) throw new UnauthorizedError("User context is required");

  const ticketId = String(req.params.ticketId ?? "");
  const data = await sendClientSupportTicketMessage({
    tenantId,
    ticketId,
    senderUserId,
    senderName,
    message: req.body?.message,
  });
  sendSuccess({ res, req, statusCode: HTTP_STATUS.CREATED, message: "Support ticket message sent", data });
}

export async function handleClientSupportTicketAction(req: Request, res: Response): Promise<void> {
  const tenantId = req.auth?.user?.tenantId;
  if (!tenantId) throw new UnauthorizedError("Tenant context is required");

  const ticketId = String(req.params.ticketId ?? "");
  const data = await applyClientSupportTicketAction({
    tenantId,
    ticketId,
    action: req.body?.action,
  });
  sendSuccess({ res, req, statusCode: HTTP_STATUS.OK, message: "Support ticket updated", data });
}

export async function handleGetAdminSupportTickets(req: Request, res: Response): Promise<void> {
  const data = await getAdminSupportTickets({
    status: req.query.status,
    search: req.query.search,
    tenantId: req.query.tenantId,
  });
  sendSuccess({ res, req, statusCode: HTTP_STATUS.OK, message: "Admin support tickets fetched", data });
}

export async function handleGetAdminSupportTicketDetail(req: Request, res: Response): Promise<void> {
  const ticketId = String(req.params.ticketId ?? "");
  const data = await getAdminSupportTicketDetail(ticketId);
  sendSuccess({ res, req, statusCode: HTTP_STATUS.OK, message: "Admin support ticket detail fetched", data });
}

export async function handlePatchAdminSupportTicket(req: Request, res: Response): Promise<void> {
  const ticketId = String(req.params.ticketId ?? "");
  const data = await updateAdminSupportTicket({
    ticketId,
    payload: {
      status: req.body?.status,
      progress: req.body?.progress,
      assignedTeam: req.body?.assignedTeam,
      slaDeadline: req.body?.slaDeadline,
      workflowStage: req.body?.workflowStage,
      slaDeadlineAt: req.body?.slaDeadlineAt,
    },
  });
  sendSuccess({ res, req, statusCode: HTTP_STATUS.OK, message: "Support ticket updated", data });
}

export async function handleDeleteAdminSupportTicket(req: Request, res: Response): Promise<void> {
  const ticketId = String(req.params.ticketId ?? "");
  await deleteAdminSupportTicket(ticketId);
  sendSuccess({ res, req, statusCode: HTTP_STATUS.OK, message: "Support ticket deleted", data: { id: ticketId } });
}

export async function handleGetAdminSupportTicketMessages(req: Request, res: Response): Promise<void> {
  const ticketId = String(req.params.ticketId ?? "");
  const data = await getAdminSupportTicketMessages(ticketId);
  sendSuccess({ res, req, statusCode: HTTP_STATUS.OK, message: "Support ticket messages fetched", data });
}

export async function handleDeleteAdminSupportTicketMessages(req: Request, res: Response): Promise<void> {
  const ticketId = String(req.params.ticketId ?? "");
  const data = await clearAdminSupportTicketMessages(ticketId);
  sendSuccess({ res, req, statusCode: HTTP_STATUS.OK, message: "Support ticket messages cleared", data });
}

export async function handlePostAdminSupportTicketMessage(req: Request, res: Response): Promise<void> {
  const ticketId = String(req.params.ticketId ?? "");
  const senderName = String(req.auth?.user?.email ?? "KCX Support");
  const data = await sendAdminSupportTicketMessage({
    ticketId,
    message: req.body?.message,
    senderUserId: null,
    senderName,
  });
  sendSuccess({ res, req, statusCode: HTTP_STATUS.CREATED, message: "Support ticket message sent", data });
}
