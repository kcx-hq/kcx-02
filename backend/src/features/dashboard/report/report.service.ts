import type { DashboardSectionResponse } from "../overview/overview.service.js";

export function getReportDashboardData(): DashboardSectionResponse {
  return {
    section: "report",
    title: "Report",
    message: "Report dashboard data fetched successfully",
    summary: [
      { label: "lastGenerated", value: "Today" },
      { label: "availableReports", value: "9" },
      { label: "deliveryTargets", value: "Finance, Engineering" },
    ],
  };
}
