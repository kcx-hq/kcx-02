import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { handleGetAllocationDashboard } from "./allocation/allocation.controller.js";
import {
  handleCreateBudget,
  handleGetBudgetDashboard,
  handleUpdateBudget,
  handleUpdateBudgetStatus,
} from "./budget/budget.controller.js";
import { handleGetDashboardScope, handleGetDashboardTestTotalSpend } from "./dashboard.controller.js";
import { handleGetCostExplorerDashboard } from "./cost-explorer/cost-explorer.controller.js";
import {
  handleDebugSyncOptimizationRecommendations,
  handleGetCommitmentOverview,
  handleGetCommitmentRecommendationDetail,
  handleGetCommitmentRecommendations,
  handleGetIdleOverview,
  handleGetIdleRecommendationDetail,
  handleGetIdleRecommendations,
  handleGetOptimizationDashboard,
  handleGetRightsizingOverview,
  handleGetRightsizingRecommendationDetail,
  handleGetRightsizingRecommendations,
  handleSyncCommitmentRecommendations,
  handleSyncIdleRecommendations,
  handleSyncOptimizationRecommendations,
} from "./optimization/optimization.controller.js";
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
import { handleGetAnomalies as handleGetAnomaliesAlertsDashboard } from "./anomaly-alerts/anomaly.controller.js";
import { handleGetReportDashboard } from "./report/report.controller.js";
import { handleGetResourcesDashboard } from "./resources/resources.controller.js";

const router = Router();

router.use("/dashboard", requireAuth);

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
router.get(
  "/dashboard/optimization/rightsizing/overview",
  asyncHandler(handleGetRightsizingOverview),
);
router.get(
  "/dashboard/optimization/rightsizing/recommendations",
  asyncHandler(handleGetRightsizingRecommendations),
);
router.get(
  "/dashboard/optimization/rightsizing/recommendations/:recommendationId",
  asyncHandler(handleGetRightsizingRecommendationDetail),
);
router.get(
  "/dashboard/optimization/idle/overview",
  asyncHandler(handleGetIdleOverview),
);
router.get(
  "/dashboard/optimization/idle/recommendations",
  asyncHandler(handleGetIdleRecommendations),
);
router.get(
  "/dashboard/optimization/idle/recommendations/:recommendationId",
  asyncHandler(handleGetIdleRecommendationDetail),
);
router.get(
  "/dashboard/optimization/commitment/overview",
  asyncHandler(handleGetCommitmentOverview),
);
router.get(
  "/dashboard/optimization/commitment/recommendations",
  asyncHandler(handleGetCommitmentRecommendations),
);
router.get(
  "/dashboard/optimization/commitment/recommendations/:recommendationId",
  asyncHandler(handleGetCommitmentRecommendationDetail),
);
router.post(
  "/dashboard/optimization/recommendations/sync",
  asyncHandler(handleSyncOptimizationRecommendations),
);
router.post(
  "/dashboard/optimization/idle/sync",
  asyncHandler(handleSyncIdleRecommendations),
);
router.post(
  "/dashboard/optimization/commitment/sync",
  asyncHandler(handleSyncCommitmentRecommendations),
);
router.get(
  "/dashboard/optimization/recommendations/debug-sync",
  asyncHandler(handleDebugSyncOptimizationRecommendations),
);
router.get("/dashboard/anomalies-alerts", asyncHandler(handleGetAnomaliesAlertsDashboard));
router.get("/dashboard/budget", asyncHandler(handleGetBudgetDashboard));
router.post("/dashboard/budget", asyncHandler(handleCreateBudget));
router.patch("/dashboard/budget/:budgetId", asyncHandler(handleUpdateBudget));
router.patch("/dashboard/budget/:budgetId/status", asyncHandler(handleUpdateBudgetStatus));
router.get("/dashboard/report", asyncHandler(handleGetReportDashboard));
router.get("/dashboard/test-total-spend", asyncHandler(handleGetDashboardTestTotalSpend));

export default router;
