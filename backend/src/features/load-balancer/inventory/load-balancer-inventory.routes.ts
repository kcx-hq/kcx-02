import { Router } from "express";

import { requireAuth } from "../../../middlewares/auth.middleware.js";
import { asyncHandler } from "../../../utils/async-handler.js";
import {
  handleGetInventoryAwsLoadBalancerDetail,
  handleListInventoryAwsLoadBalancers,
} from "./load-balancer-inventory.controller.js";

const router = Router();

router.use("/inventory/aws/load-balancers", requireAuth);
router.get("/inventory/aws/load-balancers", asyncHandler(handleListInventoryAwsLoadBalancers));
router.get("/inventory/aws/load-balancers/:loadBalancerId", asyncHandler(handleGetInventoryAwsLoadBalancerDetail));

export default router;
