import type { DashboardSectionResponse } from "../overview/overview.service.js";

export function getAllocationDashboardData(): DashboardSectionResponse {
  return {
    section: "allocation",
    title: "Allocation",
    message: "Allocation dashboard data fetched successfully",
    summary: [
      { label: "allocatedCost", value: "89%" },
      { label: "sharedCostPool", value: "$12.7K" },
      { label: "unallocatedCost", value: "$8.9K" },
    ],
  };
}
