import { Router } from "express";

import { requireAuth } from "../../../middlewares/auth.middleware.js";
import { asyncHandler } from "../../../utils/async-handler.js";
import { handleGetEc2DataTransfer } from "./ec2-data-transfer.controller.js";

const router = Router();

router.use("/ec2/data-transfer", requireAuth);
router.use("/dashboard/ec2/data-transfer", requireAuth);

router.get("/ec2/data-transfer", asyncHandler(handleGetEc2DataTransfer));
router.get("/dashboard/ec2/data-transfer", asyncHandler(handleGetEc2DataTransfer));

export default router;
