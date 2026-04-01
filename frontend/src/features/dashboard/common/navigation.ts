export type DashboardNavItem = {
  label: string;
  path: string;
  icon: string;
};

export const dashboardNavItems: DashboardNavItem[] = [
  { label: "Overview", path: "/dashboard/overview", icon: "layout-dashboard" },
  { label: "Cost Analysis", path: "/dashboard/cost-analysis", icon: "line-chart" },
  { label: "Cost Driver", path: "/dashboard/cost-driver", icon: "activity" },
  { label: "Data Quality", path: "/dashboard/data-quality", icon: "shield-check" },
  { label: "Report", path: "/dashboard/report", icon: "file-text" },
];
