import type { DashboardSectionResponse } from "../overview/overview.service.js";

export function getCostExplorerDashboardData(): DashboardSectionResponse {
  return {
    section: "cost-explorer",
    title: "Cost Explorer",
    message: "Cost Explorer dashboard data fetched successfully",
    summary: [
      { label: "topService", value: "Compute" },
      { label: "monthToDate", value: "$96.4K" },
      { label: "trend", value: "+3.2%" },
    ],
  };
}
