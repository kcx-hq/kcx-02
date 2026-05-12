import { Router } from "express";
import { asyncHandler } from "../../../utils/async-handler.js";
import {
  handleGetCostExplorerDashboard,
  handleGetCostExplorerGroupOptions,
} from "./cost-explorer.controller.js";

const router = Router();

router.get("/", asyncHandler(handleGetCostExplorerDashboard));
router.get("/group-options", asyncHandler(handleGetCostExplorerGroupOptions));

export default router;
