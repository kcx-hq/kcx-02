import { Router } from "express";

import { asyncHandler } from "../../../utils/async-handler.js";
import { handleGetDatabaseOptimizationActions } from "./db-optimization.controller.js";

const router = Router();

router.get("/services/database/optimization/actions", asyncHandler(handleGetDatabaseOptimizationActions));

export default router;

