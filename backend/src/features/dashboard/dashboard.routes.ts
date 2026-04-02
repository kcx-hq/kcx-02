import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { handleGetAllocationDashboard } from "./allocation/allocation.controller.js";
import { handleGetAnomaliesAlertsDashboard } from "./anomalies-alerts/anomalies-alerts.controller.js";
import { handleGetBudgetDashboard } from "./budget/budget.controller.js";
import { handleGetDashboardScope, handleGetDashboardTestTotalSpend } from "./dashboard.controller.js";
import { handleGetCostExplorerDashboard } from "./cost-explorer/cost-explorer.controller.js";
import { handleGetOptimizationDashboard } from "./optimization/optimization.controller.js";
import {
  handleGetDashboardFilters,
  handleGetOverviewAnomalies,
  handleGetOverviewBudgetVsActualForecast,
  handleGetOverviewDashboard,
  handleGetOverviewKpis,
  handleGetOverviewRecommendations,
  handleGetOverviewSavingsInsights,
  handleGetOverviewTopAccounts,
  handleGetOverviewTopRegions,
  handleGetOverviewTopServices,
} from "./overview/overview.controller.js";
import { handleGetReportDashboard } from "./report/report.controller.js";
import { handleGetResourcesDashboard } from "./resources/resources.controller.js";

const router = Router();

router.get("/dashboard/scope", asyncHandler(handleGetDashboardScope));
router.get("/dashboard/overview", asyncHandler(handleGetOverviewDashboard));
router.get("/dashboard/overview/kpis", asyncHandler(handleGetOverviewKpis));
router.get(
  "/dashboard/overview/budget-vs-actual-forecast",
  asyncHandler(handleGetOverviewBudgetVsActualForecast),
);
router.get("/dashboard/overview/top-services", asyncHandler(handleGetOverviewTopServices));
router.get("/dashboard/overview/top-accounts", asyncHandler(handleGetOverviewTopAccounts));
router.get("/dashboard/overview/top-regions", asyncHandler(handleGetOverviewTopRegions));
router.get("/dashboard/overview/savings-insights", asyncHandler(handleGetOverviewSavingsInsights));
router.get("/dashboard/overview/anomalies", asyncHandler(handleGetOverviewAnomalies));
router.get("/dashboard/overview/recommendations", asyncHandler(handleGetOverviewRecommendations));
router.get("/dashboard/filters", asyncHandler(handleGetDashboardFilters));
router.get("/dashboard/cost-explorer", asyncHandler(handleGetCostExplorerDashboard));
router.get("/dashboard/resources", asyncHandler(handleGetResourcesDashboard));
router.get("/dashboard/allocation", asyncHandler(handleGetAllocationDashboard));
router.get("/dashboard/optimization", asyncHandler(handleGetOptimizationDashboard));
router.get("/dashboard/anomalies-alerts", asyncHandler(handleGetAnomaliesAlertsDashboard));
router.get("/dashboard/budget", asyncHandler(handleGetBudgetDashboard));
router.get("/dashboard/report", asyncHandler(handleGetReportDashboard));
router.get("/dashboard/test-total-spend", asyncHandler(handleGetDashboardTestTotalSpend));

export default router;
