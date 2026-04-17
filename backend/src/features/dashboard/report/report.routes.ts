import { Router } from "express";
import { requireAuth } from "../../../middlewares/auth.middleware.js";
import { asyncHandler } from "../../../utils/async-handler.js";
import {
  handleGenerateCloudCostAnomalyReport,
  handleGetCloudCostAnomalyReport,
  handleGetCloudCostAnomalyReportPdf,
} from "./report.controller.js";

const router = Router();

function registerReportEndpoints(basePath: "/reports" | "/api/reports"): void {
  router.get(`${basePath}/cloud-cost-anomaly`, requireAuth, asyncHandler(handleGetCloudCostAnomalyReport));
  router.get(
    `${basePath}/cloud-cost-anomaly/pdf`,
    requireAuth,
    asyncHandler(handleGetCloudCostAnomalyReportPdf),
  );
  router.post(
    `${basePath}/cloud-cost-anomaly/generate`,
    requireAuth,
    asyncHandler(handleGenerateCloudCostAnomalyReport),
  );
}

registerReportEndpoints("/reports");
registerReportEndpoints("/api/reports");

export default router;

