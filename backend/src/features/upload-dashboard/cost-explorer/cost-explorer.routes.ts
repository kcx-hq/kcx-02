import { Router } from "express";
import { asyncHandler } from "../../../utils/async-handler.js";
import { handleGetCostExplorerDashboard } from "./cost-explorer.controller.js";

const router = Router();

router.get("/", asyncHandler(handleGetCostExplorerDashboard));

export default router;
