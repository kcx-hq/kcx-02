import { Router } from "express";

import { requireAuth } from "../../../middlewares/auth.middleware.js";
import { asyncHandler } from "../../../utils/async-handler.js";
import {
  handleGetEc2OptimizationInstances,
  handleGetEc2OptimizationInstancesByType,
  handleGetEc2OptimizationSummary,
} from "./ec2-optimization.controller.js";

const router = Router();

router.use("/ec2/optimization", requireAuth);
router.use("/dashboard/ec2/optimization", requireAuth);

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

export default router;
