export type DashboardNavLink = {
  kind: "link";
  label: string;
  path: string;
  icon: string;
  children?: DashboardNavGroup[];
};

export type DashboardNavGroup = {
  kind: "group";
  label: string;
  icon: string;
  path?: string;
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
    kind: "link",
    label: "Services",
    path: "/dashboard/inventory",
    icon: "server",
    children: [
      {
        kind: "group",
        label: "EC2",
        icon: "boxes",
        path: "/dashboard/ec2",
        items: [
          {
            kind: "link",
            label: "Instances",
            path: "/dashboard/inventory/aws/ec2/instances",
            icon: "server",
          },
          {
            kind: "link",
            label: "Volumes",
            path: "/dashboard/inventory/aws/ec2/volumes",
            icon: "boxes",
          },
          {
            kind: "link",
            label: "Snapshots",
            path: "/dashboard/inventory/aws/ec2/snapshots",
            icon: "boxes",
          },
          {
            kind: "link",
            label: "Cost",
            path: "/dashboard/ec2/cost",
            icon: "line-chart",
          },
          {
            kind: "link",
            label: "Usage",
            path: "/dashboard/ec2/usage",
            icon: "activity",
          },
          {
            kind: "link",
            label: "EC2 Instance Hours",
            path: "/dashboard/ec2/instance-hours",
            icon: "activity",
          },
          {
            kind: "link",
            label: "Performance",
            path: "/dashboard/ec2/performance",
            icon: "line-chart",
          },
        ],
      },
      {
        kind: "group",
        label: "S3",
        icon: "boxes",
        path: "/dashboard/s3",
        items: [
          {
            kind: "link",
            label: "Cost",
            path: "/dashboard/s3/cost",
            icon: "line-chart",
          },
          {
            kind: "link",
            label: "Usage",
            path: "/dashboard/s3/usage",
            icon: "activity",
          },
        ],
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

const flattenDashboardLink = (link: DashboardNavLink): DashboardNavLink[] => [
  {
    kind: "link",
    label: link.label,
    path: link.path,
    icon: link.icon,
  },
  ...((link.children ?? []).flatMap((group) =>
    group.items.flatMap((item) => flattenDashboardLink(item)),
  )),
];

const flattenDashboardNode = (node: DashboardNavNode): DashboardNavLink[] =>
  node.kind === "group"
    ? [
        ...(node.path
          ? ([
              {
                kind: "link",
                label: node.label,
                path: node.path,
                icon: node.icon,
              },
            ] as DashboardNavLink[])
          : []),
        ...node.items.flatMap((item) => flattenDashboardLink(item)),
      ]
    : flattenDashboardLink(node);

export const dashboardNavLinks: DashboardNavLink[] = dashboardNav.flatMap((node) =>
  flattenDashboardNode(node),
);
