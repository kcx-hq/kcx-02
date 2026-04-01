import { apiGet } from "@/lib/api";

export type DashboardSummaryItem = {
  label: string;
  value: string;
};

export type DashboardSectionData = {
  section: string;
  title: string;
  message: string;
  summary: DashboardSummaryItem[];
};

export function getOverview() {
  return apiGet<DashboardSectionData>("/dashboard/overview");
}

export function getCostExplorer() {
  return apiGet<DashboardSectionData>("/dashboard/cost-explorer");
}

export function getResources() {
  return apiGet<DashboardSectionData>("/dashboard/resources");
}

export function getAllocation() {
  return apiGet<DashboardSectionData>("/dashboard/allocation");
}

export function getOptimization() {
  return apiGet<DashboardSectionData>("/dashboard/optimization");
}

export function getAnomaliesAlerts() {
  return apiGet<DashboardSectionData>("/dashboard/anomalies-alerts");
}

export function getBudget() {
  return apiGet<DashboardSectionData>("/dashboard/budget");
}

export function getReport() {
  return apiGet<DashboardSectionData>("/dashboard/report");
}
