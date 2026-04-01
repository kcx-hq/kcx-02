import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { handleGetAllocationDashboard } from "./allocation/allocation.controller.js";
import { handleGetAnomaliesAlertsDashboard } from "./anomalies-alerts/anomalies-alerts.controller.js";
import { handleGetBudgetDashboard } from "./budget/budget.controller.js";
import { handleGetCostExplorerDashboard } from "./cost-explorer/cost-explorer.controller.js";
import { handleGetOptimizationDashboard } from "./optimization/optimization.controller.js";
import { handleGetOverviewDashboard } from "./overview/overview.controller.js";
import { handleGetReportDashboard } from "./report/report.controller.js";
import { handleGetResourcesDashboard } from "./resources/resources.controller.js";

const router = Router();

router.get("/dashboard/overview", asyncHandler(handleGetOverviewDashboard));
router.get("/dashboard/cost-explorer", asyncHandler(handleGetCostExplorerDashboard));
router.get("/dashboard/resources", asyncHandler(handleGetResourcesDashboard));
router.get("/dashboard/allocation", asyncHandler(handleGetAllocationDashboard));
router.get("/dashboard/optimization", asyncHandler(handleGetOptimizationDashboard));
router.get("/dashboard/anomalies-alerts", asyncHandler(handleGetAnomaliesAlertsDashboard));
router.get("/dashboard/budget", asyncHandler(handleGetBudgetDashboard));
router.get("/dashboard/report", asyncHandler(handleGetReportDashboard));

export default router;
