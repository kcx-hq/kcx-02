import { Router } from "express";

import { requireAuth } from "../../../middlewares/auth.middleware.js";
import { asyncHandler } from "../../../utils/async-handler.js";
import { handleGetEc2Explorer } from "./ec2-explorer.controller.js";

const router = Router();

router.use("/ec2/explorer", requireAuth);
router.use("/dashboard/ec2/explorer", requireAuth);

router.get("/ec2/explorer", asyncHandler(handleGetEc2Explorer));
router.get("/dashboard/ec2/explorer", asyncHandler(handleGetEc2Explorer));

export default router;
