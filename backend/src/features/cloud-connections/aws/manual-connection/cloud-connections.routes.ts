import { Router } from "express";
import { requireAuth } from "../../../../middlewares/auth.middleware.js";
import { asyncHandler } from "../../../../utils/async-handler.js";
import {
  handleCreateOrUpdateAwsManualStep1,
  handleCreateOrUpdateAwsManualStep2,
  handleCreateOrUpdateAwsManualStep3,
  handleValidateAwsManualConnection,
} from "./cloud-connections.controller.js";

const router = Router();

router.post(
  "/api/cloud-connections/aws/manual/step-1",
  requireAuth,
  asyncHandler(handleCreateOrUpdateAwsManualStep1),
);

router.post(
  "/api/cloud-connections/aws/manual/step-2",
  requireAuth,
  asyncHandler(handleCreateOrUpdateAwsManualStep2),
);

router.post(
  "/api/cloud-connections/aws/manual/step-3",
  requireAuth,
  asyncHandler(handleCreateOrUpdateAwsManualStep3),
);

router.post(
  "/api/cloud-connections/aws/manual/validate",
  requireAuth,
  asyncHandler(handleValidateAwsManualConnection),
);

export default router;
