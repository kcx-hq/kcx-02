import { Router } from "express";

import { requireAdminAuth, requireAuth } from "../../middlewares/auth.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  handleApproveAdminSupportMeeting,
  handleClientSupportMeetingAction,
  handleCreateClientSupportMeeting,
  handleGetAdminSupportMeetings,
  handleGetClientSupportMeetings,
  handleRejectAdminSupportMeeting,
} from "./support-meetings.controller.js";

const router = Router();

router.use("/support/meetings/client", requireAuth);
router.get("/support/meetings/client", asyncHandler(handleGetClientSupportMeetings));
router.post("/support/meetings/client", asyncHandler(handleCreateClientSupportMeeting));
router.patch("/support/meetings/client/:meetingId", asyncHandler(handleClientSupportMeetingAction));

router.use("/admin/support-meetings", requireAdminAuth);
router.get("/admin/support-meetings", asyncHandler(handleGetAdminSupportMeetings));
router.patch("/admin/support-meetings/:meetingId/approve", asyncHandler(handleApproveAdminSupportMeeting));
router.patch("/admin/support-meetings/:meetingId/reject", asyncHandler(handleRejectAdminSupportMeeting));

export default router;
