import { Router } from "express";

import { asyncHandler } from "../../../../utils/async-handler.js";
import { handleAwsExportFileArrived } from "./aws-export-file-event.controller.js";

const router = Router();

router.post("/api/aws/export-file-arrived", asyncHandler(handleAwsExportFileArrived));

export default router;
