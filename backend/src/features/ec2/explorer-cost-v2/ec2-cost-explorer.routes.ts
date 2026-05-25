import { Router } from "express";

import { requireAuth } from "../../../middlewares/auth.middleware.js";
import { asyncHandler } from "../../../utils/async-handler.js";
import { handleEc2CostExplorer } from "./ec2-cost-explorer.controller.js";

const router = Router();

router.use("/ec2/explorer/cost", requireAuth);
router.get("/ec2/explorer/cost", asyncHandler(handleEc2CostExplorer));
router.post("/ec2/explorer/cost", asyncHandler(handleEc2CostExplorer));

export default router;

