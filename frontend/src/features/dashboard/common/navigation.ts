export type DashboardNavLink = {
  kind: "link";
  label: string;
  path: string;
  icon: string;
};

export type DashboardNavGroup = {
  kind: "group";
  label: string;
  icon: string;
  items: DashboardNavLink[];
};

export type DashboardNavNode = DashboardNavLink | DashboardNavGroup;

export const dashboardNav: DashboardNavNode[] = [
  {
    kind: "group",
    label: "Dashboards",
    icon: "pie-chart",
    items: [
      {
        kind: "link",
        label: "Overview Dashboard",
        path: "/dashboard/overview",
        icon: "layout-dashboard",
      },
    ],
  },
  {
    kind: "group",
    label: "Cost",
    icon: "boxes",
    items: [
      {
        kind: "link",
        label: "Explorer",
        path: "/dashboard/cost/explorer",
        icon: "line-chart",
      },
      {
        kind: "link",
        label: "History",
        path: "/dashboard/cost/history",
        icon: "activity",
      },
    ],
  },
  {
    kind: "group",
    label: "Inventory",
    icon: "server",
    items: [
      {
        kind: "link",
        label: "AWS",
        path: "/dashboard/inventory/aws",
        icon: "boxes",
      },
    ],
  },
  { kind: "link", label: "Optimization", path: "/dashboard/optimization", icon: "gauge" },
  {
    kind: "link",
    label: "Anomalies",
    path: "/dashboard/anomalies-alerts",
    icon: "triangle-alert",
  },
  { kind: "link", label: "Budget", path: "/dashboard/budget", icon: "wallet" },
  { kind: "link", label: "Report", path: "/dashboard/report", icon: "file-text" },
];

export const dashboardNavLinks: DashboardNavLink[] = dashboardNav.flatMap((node) =>
  node.kind === "group" ? node.items : [node],
);
