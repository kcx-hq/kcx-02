import { Router } from "express";

import { requireAuth } from "../../../middlewares/auth.middleware.js";
import { asyncHandler } from "../../../utils/async-handler.js";
import {
  handleGetAnomalies,
  handleCreateAnomalyDetectionJob,
  handleGetAnomalyDetectionJobStatus,
  handleGetAnomalyTimelineById,
} from "./anomaly.controller.js";

const router = Router();

router.use("/anomaly-detection", requireAuth);
router.use("/anomalies", requireAuth);

router.post("/anomaly-detection/jobs", asyncHandler(handleCreateAnomalyDetectionJob));
router.get("/anomaly-detection/jobs/:jobId", asyncHandler(handleGetAnomalyDetectionJobStatus));
router.get("/anomalies", asyncHandler(handleGetAnomalies));
router.get("/anomalies/:anomalyId/timeline", asyncHandler(handleGetAnomalyTimelineById));

export default router;
