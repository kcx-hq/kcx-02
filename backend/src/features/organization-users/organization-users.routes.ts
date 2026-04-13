import { Router } from "express";

import { requireAuth } from "../../middlewares/auth.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  handleApproveOrganizationUser,
  handleGetOrganizationUsers,
  handleInviteOrganizationUser,
  handleUpdateOrganizationUserStatus,
} from "./organization-users.controller.js";

const router = Router();

router.use("/organization/users", requireAuth);
router.get("/organization/users", asyncHandler(handleGetOrganizationUsers));
router.post("/organization/users/invite", asyncHandler(handleInviteOrganizationUser));
router.patch("/organization/users/:userId/approve", asyncHandler(handleApproveOrganizationUser));
router.patch("/organization/users/:userId/status", asyncHandler(handleUpdateOrganizationUserStatus));

export default router;

