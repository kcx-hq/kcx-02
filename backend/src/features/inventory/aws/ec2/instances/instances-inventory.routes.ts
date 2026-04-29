import { Router } from "express";

import { requireAuth } from "../../../../../middlewares/auth.middleware.js";
import { asyncHandler } from "../../../../../utils/async-handler.js";
import {
  handleGetInventoryAwsEc2InstanceDetails,
  handleGetInventoryAwsEc2InstancePerformance,
  handleListInventoryAwsEc2Instances,
} from "./instances-inventory.controller.js";

const router = Router();

router.use("/inventory/aws/ec2/instances", requireAuth);
router.get("/inventory/aws/ec2/instances", asyncHandler(handleListInventoryAwsEc2Instances));
router.get(
  "/inventory/aws/ec2/instances/performance",
  asyncHandler(handleGetInventoryAwsEc2InstancePerformance),
);
router.get(
  "/inventory/aws/ec2/instances/:instanceId/details",
  asyncHandler(handleGetInventoryAwsEc2InstanceDetails),
);

export default router;

