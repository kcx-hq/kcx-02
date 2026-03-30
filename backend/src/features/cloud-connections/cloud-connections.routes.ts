import { Router } from "express";

import { requireAuth } from "../../middlewares/auth.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  handleCreateCloudConnection,
  handleGetAwsCloudFormationSetupUrl,
  handleGetCloudConnection,
} from "./cloud-connections.controller.js";

const router = Router();

router.use(requireAuth);

router.post("/cloud-connections", asyncHandler(handleCreateCloudConnection));
router.get("/cloud-connections/:id", asyncHandler(handleGetCloudConnection));
router.get("/cloud-connections/:id/aws-cloudformation-url", asyncHandler(handleGetAwsCloudFormationSetupUrl));

export default router;
