import { Router } from "express";
import multer from "multer";

import { requireAuth } from "../../middlewares/auth.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  handleGetBillingCloudProviders,
  handleGetBillingIngestionStatus,
  handleGetBillingIngestionRun,
  handleGetBillingUploadHistory,
  handleGetLatestActiveBillingIngestion,
  handleGetLatestBillingIngestionForSource,
  handleManualUploadBillingFile,
  handleStartBillingIngestion,
} from "./billing.controller.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    // Assumption: 50MB max file size is a safe default for manual upload endpoint.
    fileSize: 75 * 1024 * 1024,
  },
});

router.use(requireAuth);

router.get("/billing/cloud-providers", asyncHandler(handleGetBillingCloudProviders));
router.get("/billing/uploads/history", asyncHandler(handleGetBillingUploadHistory));
router.post("/billing/ingestions", upload.single("file"), asyncHandler(handleStartBillingIngestion));
router.get("/billing/ingestions/latest-active", asyncHandler(handleGetLatestActiveBillingIngestion));
router.get("/billing/ingestions/:id/status", asyncHandler(handleGetBillingIngestionStatus));
router.get("/billing/sources/:sourceId/latest-ingestion", asyncHandler(handleGetLatestBillingIngestionForSource));

// Legacy compatibility endpoints.
router.post("/billing/manual-upload", upload.single("file"), asyncHandler(handleManualUploadBillingFile));
router.get("/billing-ingestion-runs/:id", asyncHandler(handleGetBillingIngestionRun));

export default router;
