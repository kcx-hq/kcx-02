import { Router } from "express";

import { requireAuth } from "../../../middlewares/auth.middleware.js";
import { asyncHandler } from "../../../utils/async-handler.js";
import {
  handleGetEc2OptimizationInstances,
  handleGetEc2OptimizationInstancesByType,
  handleGetEc2OptimizationSummary,
} from "./ec2-optimization.controller.js";
import {
  handleGetEc2Recommendations as handleGetEc2RecommendationsV1,
  handlePatchEc2RecommendationStatus as handlePatchEc2RecommendationStatusV1,
  handleRefreshEc2Recommendations as handleRefreshEc2RecommendationsV1,
} from "./ec2-recommendations.controller.js";

const router = Router();

router.use("/ec2/optimization", requireAuth);
router.use("/dashboard/ec2/optimization", requireAuth);
router.use("/ec2/recommendations", requireAuth);
router.use("/dashboard/ec2/recommendations", requireAuth);

router.get("/ec2/optimization/summary", asyncHandler(handleGetEc2OptimizationSummary));
router.get("/ec2/optimization/instances", asyncHandler(handleGetEc2OptimizationInstances));
router.get(
  "/ec2/optimization/instances/:optimizationType",
  asyncHandler(handleGetEc2OptimizationInstancesByType),
);

router.get("/dashboard/ec2/optimization/summary", asyncHandler(handleGetEc2OptimizationSummary));
router.get("/dashboard/ec2/optimization/instances", asyncHandler(handleGetEc2OptimizationInstances));
router.get(
  "/dashboard/ec2/optimization/instances/:optimizationType",
  asyncHandler(handleGetEc2OptimizationInstancesByType),
);

router.get("/ec2/recommendations", asyncHandler(handleGetEc2RecommendationsV1));
router.post("/ec2/recommendations/refresh", asyncHandler(handleRefreshEc2RecommendationsV1));
router.patch("/ec2/recommendations/:id/status", asyncHandler(handlePatchEc2RecommendationStatusV1));

router.get("/dashboard/ec2/recommendations", asyncHandler(handleGetEc2RecommendationsV1));
router.post("/dashboard/ec2/recommendations/refresh", asyncHandler(handleRefreshEc2RecommendationsV1));
router.patch("/dashboard/ec2/recommendations/:id/status", asyncHandler(handlePatchEc2RecommendationStatusV1));

export default router;
