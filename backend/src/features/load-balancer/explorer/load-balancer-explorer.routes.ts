import { Router } from "express";

import { requireAuth } from "../../../middlewares/auth.middleware.js";
import { asyncHandler } from "../../../utils/async-handler.js";
import {
  handleGetLoadBalancerExplorerGroupBy,
  handleGetLoadBalancerExplorerSummary,
  handleGetLoadBalancerExplorerTrend,
} from "./load-balancer-explorer.controller.js";

const router = Router();

router.use("/load-balancer/explorer", requireAuth);
router.use("/dashboard/load-balancer/explorer", requireAuth);

router.get("/load-balancer/explorer/summary", asyncHandler(handleGetLoadBalancerExplorerSummary));
router.get("/dashboard/load-balancer/explorer/summary", asyncHandler(handleGetLoadBalancerExplorerSummary));

router.get("/load-balancer/explorer/trend", asyncHandler(handleGetLoadBalancerExplorerTrend));
router.get("/dashboard/load-balancer/explorer/trend", asyncHandler(handleGetLoadBalancerExplorerTrend));

router.get("/load-balancer/explorer/group-by", asyncHandler(handleGetLoadBalancerExplorerGroupBy));
router.get("/dashboard/load-balancer/explorer/group-by", asyncHandler(handleGetLoadBalancerExplorerGroupBy));

export default router;
