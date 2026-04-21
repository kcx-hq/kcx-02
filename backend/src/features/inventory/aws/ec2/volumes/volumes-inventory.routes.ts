import { Router } from "express";

import { requireAuth } from "../../../../../middlewares/auth.middleware.js";
import { asyncHandler } from "../../../../../utils/async-handler.js";
import { handleListInventoryAwsEc2Volumes } from "./volumes-inventory.controller.js";

const router = Router();

router.use("/inventory/aws/ec2/volumes", requireAuth);
router.get("/inventory/aws/ec2/volumes", asyncHandler(handleListInventoryAwsEc2Volumes));

export default router;

