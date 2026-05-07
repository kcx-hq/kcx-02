import { Router } from "express";

import { requireAuth } from "../../../middlewares/auth.middleware.js";
import { asyncHandler } from "../../../utils/async-handler.js";
import { handleListInventoryAwsLoadBalancers } from "./load-balancer-inventory.controller.js";

const router = Router();

router.use("/inventory/aws/load-balancers", requireAuth);
router.get("/inventory/aws/load-balancers", asyncHandler(handleListInventoryAwsLoadBalancers));

export default router;
