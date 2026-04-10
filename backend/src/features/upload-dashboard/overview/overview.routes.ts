import { Router } from "express";
import { asyncHandler } from "../../../utils/async-handler.js";
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
} from "./overview.controller.js";

const router = Router();

router.get("/", asyncHandler(handleGetOverviewDashboard));
router.get("/kpis", asyncHandler(handleGetOverviewKpis));
router.get(
  "/budget-vs-actual-forecast",
  asyncHandler(handleGetOverviewBudgetVsActualForecast),
);
router.get("/top-services", asyncHandler(handleGetOverviewTopServices));
router.get("/top-accounts", asyncHandler(handleGetOverviewTopAccounts));
router.get("/top-regions", asyncHandler(handleGetOverviewTopRegions));
router.get("/savings-insights", asyncHandler(handleGetOverviewSavingsInsights));
router.get("/anomalies", asyncHandler(handleGetOverviewAnomalies));
router.get("/recommendations", asyncHandler(handleGetOverviewRecommendations));
router.get("/filters", asyncHandler(handleGetDashboardFilters));

export default router;
