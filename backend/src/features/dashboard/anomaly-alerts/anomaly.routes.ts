import { Router } from "express";

import { requireAuth } from "../../../middlewares/auth.middleware.js";
import { asyncHandler } from "../../../utils/async-handler.js";
import {
  handleGetAnomalies,
  handleGetAnomalyById,
  handleGetAnomalyDetectors,
  handleRunAnomalyDetectors,
} from "./anomaly.controller.js";

const router = Router();

router.use("/dashboard/anomalies-alerts", requireAuth);
router.get("/dashboard/anomalies-alerts", asyncHandler(handleGetAnomalies));
router.get("/dashboard/anomalies-alerts/detectors", asyncHandler(handleGetAnomalyDetectors));
router.post("/dashboard/anomalies-alerts/run", asyncHandler(handleRunAnomalyDetectors));
router.get("/dashboard/anomalies-alerts/:id", asyncHandler(handleGetAnomalyById));

export default router;
