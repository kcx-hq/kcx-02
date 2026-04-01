import { Router } from "express";

import { requireAuth } from "../../../../middlewares/auth.middleware.js";
import { asyncHandler } from "../../../../utils/async-handler.js";
import {
  handleAwsConnectionCallback,
  handleCreateCloudConnection,
  handleGetAwsCloudFormationSetupUrl,
  handleGetCloudConnection,
  handleValidateCloudConnection,
} from "./cloud-connections.controller.js";

const router = Router();

router.post("/api/aws/callback", asyncHandler(handleAwsConnectionCallback));

router.use(requireAuth);

router.post("/cloud-connections", asyncHandler(handleCreateCloudConnection));
router.get("/cloud-connections/:id", asyncHandler(handleGetCloudConnection));
router.get("/cloud-connections/:id/aws-cloudformation-url", asyncHandler(handleGetAwsCloudFormationSetupUrl));
router.post("/cloud-connections/:id/validate", asyncHandler(handleValidateCloudConnection));

export default router;
