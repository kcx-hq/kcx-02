import { Router } from "express";

import { asyncHandler } from "../../../../utils/async-handler.js";
import { handleAwsFileEventArrived } from "./aws-export-file-event.controller.js";

const router = Router();

router.post("/api/aws/export-file-arrived", asyncHandler(handleAwsFileEventArrived));

export default router;
