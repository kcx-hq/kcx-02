import type { DashboardSectionResponse } from "../overview/overview.service.js";

export function getResourcesDashboardData(): DashboardSectionResponse {
  return {
    section: "resources",
    title: "Resources",
    message: "Resources dashboard data fetched successfully",
    summary: [
      { label: "runningInstances", value: "284" },
      { label: "idleCandidates", value: "27" },
      { label: "coverage", value: "93%" },
    ],
  };
}
