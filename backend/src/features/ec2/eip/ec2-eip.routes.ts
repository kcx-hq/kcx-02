import { Router } from "express";

import { requireAuth } from "../../../middlewares/auth.middleware.js";
import { asyncHandler } from "../../../utils/async-handler.js";
import { handleGetEc2ElasticIps } from "./ec2-eip.controller.js";

const router = Router();

router.use("/ec2/elastic-ips", requireAuth);
router.use("/dashboard/ec2/elastic-ips", requireAuth);

router.get("/ec2/elastic-ips", asyncHandler(handleGetEc2ElasticIps));
router.get("/dashboard/ec2/elastic-ips", asyncHandler(handleGetEc2ElasticIps));

export default router;
