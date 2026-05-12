import { Router } from "express";
import multer from "multer";

import { requireAuth } from "../../middlewares/auth.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  getBillingIngestionStatus,
  handleGetBillingCloudProviders,
  handleGetBillingUploadHistory,
  handleGetLatestActiveBillingIngestion,
  handleGetLatestBillingIngestionForSource,
  handleManualUploadBillingFile,
  handleSyncStorageLensFromClientAccount,
} from "./billing.controller.js";
import {
  handleCreatePersistentS3UploadConnection,
  handleCreateS3UploadSessionFromConnection,
  handleCreateS3UploadSession,
  handleImportFromS3UploadSession,
  handleListPersistentS3UploadConnections,
  handleListS3UploadSessionScope,
} from "./s3-upload/s3-upload.controller.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    // Assumption: 50MB max file size is a safe default for manual upload endpoint.
    fileSize: 75 * 1024 * 1024,
  },
});

router.use("/billing", requireAuth);

router.get("/billing/cloud-providers", asyncHandler(handleGetBillingCloudProviders));
router.get("/billing/uploads/history", asyncHandler(handleGetBillingUploadHistory));
router.post("/billing/uploads/s3/session", asyncHandler(handleCreateS3UploadSession));
router.get("/billing/uploads/s3/session/:sessionId/list", asyncHandler(handleListS3UploadSessionScope));
router.post("/billing/uploads/s3/session/:sessionId/import", asyncHandler(handleImportFromS3UploadSession));
router.post("/billing/uploads/s3/connections", asyncHandler(handleCreatePersistentS3UploadConnection));
router.get("/billing/uploads/s3/connections", asyncHandler(handleListPersistentS3UploadConnections));
router.post(
  "/billing/uploads/s3/connections/:connectionId/session",
  asyncHandler(handleCreateS3UploadSessionFromConnection),
);
router.post("/billing/ingestion/upload", upload.single("file"), asyncHandler(handleManualUploadBillingFile));
router.get("/billing/ingestions/latest-active", asyncHandler(handleGetLatestActiveBillingIngestion));
router.get("/billing/ingestions/:id/status", asyncHandler(getBillingIngestionStatus));
router.get("/billing/sources/:sourceId/latest-ingestion", asyncHandler(handleGetLatestBillingIngestionForSource));
router.post("/billing/storage-lens/sync", asyncHandler(handleSyncStorageLensFromClientAccount));


export default router;
