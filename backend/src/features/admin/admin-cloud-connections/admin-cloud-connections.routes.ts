import { Router } from "express";

import { requireAdminAuth } from "../../../middlewares/auth.middleware.js";
import { asyncHandler } from "../../../utils/async-handler.js";
import {
  handleAdminGetCloudConnectionByIntegrationId,
  handleAdminGetCloudConnections,
} from "./admin-cloud-connections.controller.js";

const router = Router();

router.use("/admin", requireAdminAuth);

router.get("/admin/cloud-connections", asyncHandler(handleAdminGetCloudConnections));
router.get(
  "/admin/cloud-connections/:integrationId",
  asyncHandler(handleAdminGetCloudConnectionByIntegrationId),
);

export default router;

