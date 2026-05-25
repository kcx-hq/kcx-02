import { Router } from "express";

import { requireAuth } from "../../../middlewares/auth.middleware.js";
import { asyncHandler } from "../../../utils/async-handler.js";
import { handleEc2DataTransferExplorer } from "./ec2-data-transfer-explorer.controller.js";

const router = Router();

router.use("/ec2/explorer/data-transfer", requireAuth);
router.get("/ec2/explorer/data-transfer", asyncHandler(handleEc2DataTransferExplorer));
router.post("/ec2/explorer/data-transfer", asyncHandler(handleEc2DataTransferExplorer));

export default router;

