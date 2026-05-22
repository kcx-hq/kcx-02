import { Router } from "express";

import { requireAuth } from "../../../middlewares/auth.middleware.js";
import { asyncHandler } from "../../../utils/async-handler.js";
import { handleEc2UsageExplorer } from "./ec2-usage-explorer.controller.js";

const router = Router();

router.use("/ec2/explorer/usage", requireAuth);
router.get("/ec2/explorer/usage", asyncHandler(handleEc2UsageExplorer));
router.post("/ec2/explorer/usage", asyncHandler(handleEc2UsageExplorer));

export default router;

