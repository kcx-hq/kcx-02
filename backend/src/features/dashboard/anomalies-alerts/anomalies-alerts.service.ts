import type { DashboardSectionResponse } from "../overview/overview.service.js";

export function getAnomaliesAlertsDashboardData(): DashboardSectionResponse {
  return {
    section: "anomalies-alerts",
    title: "Anomalies & Alerts",
    message: "Anomalies & Alerts dashboard data fetched successfully",
    summary: [
      { label: "criticalAlerts", value: "2" },
      { label: "warningAlerts", value: "6" },
      { label: "lastIncident", value: "Compute burst in us-east-1" },
    ],
  };
}
