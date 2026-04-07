import { Router } from "express";

import { requireAdminAuth } from "../../../middlewares/auth.middleware.js";
import { asyncHandler } from "../../../utils/async-handler.js";
import {
  handleAdminGetBillingUploadByRunId,
  handleAdminGetBillingUploads,
} from "./admin-billing-uploads.controller.js";

const router = Router();

router.use("/admin", requireAdminAuth);

router.get("/admin/billing-uploads", asyncHandler(handleAdminGetBillingUploads));
router.get("/admin/billing-uploads/:runId", asyncHandler(handleAdminGetBillingUploadByRunId));

export default router;
