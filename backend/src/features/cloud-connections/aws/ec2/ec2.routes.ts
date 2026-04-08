import { Router } from "express";

import { requireAuth } from "../../../../middlewares/auth.middleware.js";
import { asyncHandler } from "../../../../utils/async-handler.js";
import {
  handleListEc2Instances,
  handleRebootEc2Instance,
  handleStartEc2Instance,
  handleStopEc2Instance,
} from "./ec2.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/api/aws/ec2/instances", asyncHandler(handleListEc2Instances));
router.post("/api/aws/ec2/start", asyncHandler(handleStartEc2Instance));
router.post("/api/aws/ec2/stop", asyncHandler(handleStopEc2Instance));
router.post("/api/aws/ec2/reboot", asyncHandler(handleRebootEc2Instance));

export default router;
