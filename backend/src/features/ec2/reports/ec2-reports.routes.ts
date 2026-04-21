import { Router } from "express";
import { requireAuth } from "../../../middlewares/auth.middleware.js";
import { asyncHandler } from "../../../utils/async-handler.js";
import { handleGetEc2InstanceHours } from "./ec2-instance-hours.controller.js";
import { handleGetEc2InstanceUsage } from "./ec2-instance-usage.controller.js";
import { handleGetEc2Overview } from "./ec2-overview.controller.js";

const router = Router();

router.use("/dashboard/ec2", requireAuth);
router.use("/ec2", requireAuth);
router.get("/dashboard/ec2/overview", asyncHandler(handleGetEc2Overview));
router.get("/dashboard/ec2/instance-usage", asyncHandler(handleGetEc2InstanceUsage));
router.get("/dashboard/ec2/instance-hours", asyncHandler(handleGetEc2InstanceHours));
router.get("/ec2/instance-hours", asyncHandler(handleGetEc2InstanceHours));

export default router;
