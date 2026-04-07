export type DashboardNavItem = {
  label: string;
  path: string;
  icon: string;
};

export const dashboardNavItems: DashboardNavItem[] = [
  { label: "Overview", path: "/dashboard/overview", icon: "layout-dashboard" },
  { label: "Cost Explorer", path: "/dashboard/cost-explorer", icon: "line-chart" },
  { label: "Optimization", path: "/dashboard/optimization", icon: "gauge" },
  { label: "Anomalies & Alerts", path: "/dashboard/anomalies-alerts", icon: "triangle-alert" },
  { label: "Budget", path: "/dashboard/budget", icon: "wallet" },
  { label: "Report", path: "/dashboard/report", icon: "file-text" },
];
