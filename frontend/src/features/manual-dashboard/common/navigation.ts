export type ManualDashboardNavItem = {
  label: string;
  path: string;
  icon: string;
};

export const manualDashboardNavItems: ManualDashboardNavItem[] = [
  { label: "Overview", path: "/uploads-dashboard/overview", icon: "layout-dashboard" },
  { label: "Cost Explorer", path: "/uploads-dashboard/cost-explorer", icon: "line-chart" },
  { label: "Anomalies & Alerts", path: "/uploads-dashboard/anomalies-alerts", icon: "triangle-alert" },
];
