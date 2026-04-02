import type { DashboardSectionResponse } from "../overview/overview.service.js";

export function getOptimizationDashboardData(): DashboardSectionResponse {
  return {
    section: "optimization",
    title: "Optimization",
    message: "Optimization dashboard data fetched successfully",
    summary: [
      { label: "openRecommendations", value: "41" },
      { label: "potentialSavings", value: "$21.6K" },
      { label: "implementedThisMonth", value: "12" },
    ],
  };
}
