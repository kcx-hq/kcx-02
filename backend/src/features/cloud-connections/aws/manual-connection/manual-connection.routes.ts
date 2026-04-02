import { Router } from "express";

import { requireAuth } from "../../../../middlewares/auth.middleware.js";
import { asyncHandler } from "../../../../utils/async-handler.js";
import {
  handleBrowseManualBucket,
  handleCreateManualConnection,
} from "./manual-connection.controller.js";

const router = Router();

router.post(
  "/api/aws/manual/create-connection",
  requireAuth,
  asyncHandler(handleCreateManualConnection),
);
router.post(
  "/api/aws/manual/browse-bucket",
  requireAuth,
  asyncHandler(handleBrowseManualBucket),
);

export default router;
