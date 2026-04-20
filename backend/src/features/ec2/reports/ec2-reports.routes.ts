import { Router } from "express";
import { requireAuth } from "../../../middlewares/auth.middleware.js";
import { asyncHandler } from "../../../utils/async-handler.js";
import { handleGetEc2InstanceUsage } from "./ec2-instance-usage.controller.js";

const router = Router();

router.use("/dashboard/ec2", requireAuth);
router.get("/dashboard/ec2/instance-usage", asyncHandler(handleGetEc2InstanceUsage));

export default router;

