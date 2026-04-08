import { Router } from "express";

import { requireAuth } from "../../../../middlewares/auth.middleware.js";
import { asyncHandler } from "../../../../utils/async-handler.js";
import awsExportFileEventRoutes from "../exports/aws-export-file-event.routes.js";
import {
  handleAwsConnectionCallback,
  handleCreateCloudConnection,
  handleGetCloudIntegrationDashboardScope,
  handleGetCloudIntegrations,
  handleGetAwsCloudFormationSetupUrl,
  handleGetCloudConnection,
  handleValidateCloudConnection,
} from "./cloud-connections.controller.js";

const router = Router();

router.post("/api/aws/callback", asyncHandler(handleAwsConnectionCallback));
router.use(awsExportFileEventRoutes);

router.use("/cloud-connections", requireAuth);
router.use("/cloud-integrations", requireAuth);

router.post("/cloud-connections", asyncHandler(handleCreateCloudConnection));
router.get("/cloud-integrations", asyncHandler(handleGetCloudIntegrations));
router.get("/cloud-integrations/:id/dashboard-scope", asyncHandler(handleGetCloudIntegrationDashboardScope));
router.get("/cloud-connections/:id", asyncHandler(handleGetCloudConnection));
router.get("/cloud-connections/:id/aws-cloudformation-url", asyncHandler(handleGetAwsCloudFormationSetupUrl));
router.post("/cloud-connections/:id/aws-cloudformation-url", asyncHandler(handleGetAwsCloudFormationSetupUrl));
router.post("/cloud-connections/:id/validate", asyncHandler(handleValidateCloudConnection));

export default router;
