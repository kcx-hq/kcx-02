import type { DashboardSectionResponse } from "../overview/overview.service.js";

export function getBudgetDashboardData(): DashboardSectionResponse {
  return {
    section: "budget",
    title: "Budget",
    message: "Budget dashboard data fetched successfully",
    summary: [
      { label: "monthlyBudget", value: "$160K" },
      { label: "consumed", value: "73%" },
      { label: "forecast", value: "$158.9K" },
    ],
  };
}
