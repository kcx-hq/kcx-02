import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { handleCreateOrUpdateAwsManualStep1 } from "./cloud-connections.controller.js";

const router = Router();

router.post(
  "/api/cloud-connections/aws/manual/step-1",
  requireAuth,
  asyncHandler(handleCreateOrUpdateAwsManualStep1),
);

export default router;
