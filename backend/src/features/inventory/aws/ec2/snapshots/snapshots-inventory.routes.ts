import { Router } from "express";

import { requireAuth } from "../../../../../middlewares/auth.middleware.js";
import { asyncHandler } from "../../../../../utils/async-handler.js";
import { handleListInventoryAwsEc2Snapshots } from "./snapshots-inventory.controller.js";

const router = Router();

router.use("/inventory/aws/ec2/snapshots", requireAuth);
router.get("/inventory/aws/ec2/snapshots", asyncHandler(handleListInventoryAwsEc2Snapshots));

export default router;
