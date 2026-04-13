import { Router } from "express";

import { requireAdminAuth, requireAuth } from "../../middlewares/auth.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  handleClientSupportTicketAction,
  handleCreateClientSupportTicket,
  handleGetClientSupportTicketDetail,
  handleGetClientSupportTicketMessages,
  handleDeleteAdminSupportTicket,
  handleGetAdminSupportTicketDetail,
  handleGetAdminSupportTicketMessages,
  handleGetAdminSupportTickets,
  handleDeleteAdminSupportTicketMessages,
  handleGetClientSupportTickets,
  handlePatchAdminSupportTicket,
  handlePostClientSupportTicketMessage,
  handlePostAdminSupportTicketMessage,
} from "./support-tickets.controller.js";

const router = Router();

router.use("/support/tickets/client", requireAuth);
router.get("/support/tickets/client", asyncHandler(handleGetClientSupportTickets));
router.post("/support/tickets/client", asyncHandler(handleCreateClientSupportTicket));
router.get("/support/tickets/client/:ticketId", asyncHandler(handleGetClientSupportTicketDetail));
router.get("/support/tickets/client/:ticketId/messages", asyncHandler(handleGetClientSupportTicketMessages));
router.post("/support/tickets/client/:ticketId/messages", asyncHandler(handlePostClientSupportTicketMessage));
router.patch("/support/tickets/client/:ticketId", asyncHandler(handleClientSupportTicketAction));

router.use("/admin/support-tickets", requireAdminAuth);
router.get("/admin/support-tickets", asyncHandler(handleGetAdminSupportTickets));
router.get("/admin/support-tickets/:ticketId", asyncHandler(handleGetAdminSupportTicketDetail));
router.patch("/admin/support-tickets/:ticketId", asyncHandler(handlePatchAdminSupportTicket));
router.patch("/admin/support-tickets/:ticketId/status", asyncHandler(handlePatchAdminSupportTicket));
router.delete("/admin/support-tickets/:ticketId", asyncHandler(handleDeleteAdminSupportTicket));
router.get("/admin/support-tickets/:ticketId/messages", asyncHandler(handleGetAdminSupportTicketMessages));
router.delete("/admin/support-tickets/:ticketId/messages", asyncHandler(handleDeleteAdminSupportTicketMessages));
router.post("/admin/support-tickets/:ticketId/messages", asyncHandler(handlePostAdminSupportTicketMessage));

export default router;
