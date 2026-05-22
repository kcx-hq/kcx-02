import type { SidebarIconKey } from "./sidebarIconMap";

export type DashboardNavLink = {
  kind: "link";
  label: string;
  path: string;
  icon: SidebarIconKey;
  children?: DashboardNavGroup[];
};

export type DashboardNavGroup = {
  kind: "group";
  label: string;
  icon: SidebarIconKey;
  path?: string;
  items: DashboardNavLink[];
};

export type DashboardNavNode = DashboardNavLink | DashboardNavGroup;

export const dashboardNav: DashboardNavNode[] = [
  {
    kind: "group",
    label: "Dashboards",
    icon: "dashboards",
    items: [
      {
        kind: "link",
        label: "Overview Dashboard",
        path: "/dashboard/overview",
        icon: "overview",
      },
    ],
  },
  {
    kind: "group",
    label: "Cost",
    icon: "cost",
    items: [
      {
        kind: "link",
        label: "Explorer",
        path: "/dashboard/cost/explorer",
        icon: "costExplorer",
      },
      {
        kind: "link",
        label: "History",
        path: "/dashboard/cost/history",
        icon: "costHistory",
      },
    ],
  },
  {
    kind: "link",
    label: "Services",
    path: "/dashboard/inventory",
    icon: "services",
    children: [
      {
        kind: "group",
        label: "EC2",
        icon: "ec2",
        path: "/dashboard/ec2/explorer",
        items: [
          {
            kind: "link",
            label: "Instances",
            path: "/dashboard/inventory/aws/ec2/instances",
            icon: "ec2Instances",
          },
          {
            kind: "link",
            label: "Volumes",
            path: "/dashboard/inventory/aws/ec2/volumes",
            icon: "ec2Volumes",
          },
          {
            kind: "link",
            label: "Snapshots",
            path: "/dashboard/inventory/aws/ec2/snapshots",
            icon: "ec2Snapshots",
          },
          {
            kind: "link",
            label: "Optimization",
            path: "/dashboard/ec2/optimization",
            icon: "ec2Optimization",
          },
          {
            kind: "link",
            label: "Elastic IP",
            path: "/dashboard/inventory/aws/ec2/elastic-ip",
            icon: "elasticIp",
          },
        ],
      },
      {
        kind: "group",
        label: "Load Balancer",
        icon: "services",
        path: "/dashboard/load-balancer/explorer",
        items: [
          {
            kind: "link",
            label: "Explorer",
            path: "/dashboard/load-balancer/explorer",
            icon: "costExplorer",
          },
          {
            kind: "link",
            label: "List",
            path: "/dashboard/inventory/aws/load-balancer/list",
            icon: "services",
          },
          {
            kind: "link",
            label: "Optimization",
            path: "/dashboard/load-balancer/optimization",
            icon: "optimization",
          },
        ],
      },
      {
        kind: "group",
        label: "S3",
        icon: "s3",
        path: "/dashboard/s3/cost",
        items: [
          {
            kind: "link",
            label: "Explorer",
            path: "/dashboard/s3/cost",
            icon: "costExplorer",
          },
          {
            kind: "link",
            label: "Bucket",
            path: "/dashboard/s3/bucket",
            icon: "s3Bucket",
          },
          {
            kind: "link",
            label: "Optimization",
            path: "/dashboard/s3/optimization",
            icon: "s3Optimization",
          },
        ],
      },
      {
        kind: "group",
        label: "Database",
        icon: "database",
        path: "/dashboard/services/database",
        items: [
          {
            kind: "link",
            label: "Assets",
            path: "/dashboard/services/database/assets",
            icon: "databaseAssets",
          },
          {
            kind: "link",
            label: "Optimization",
            path: "/dashboard/services/database/recommendations",
            icon: "databaseRecommendations",
          },
        ],
      },
    ],
  },
  { kind: "link", label: "Optimization", path: "/dashboard/optimization", icon: "optimization" },
  {
    kind: "link",
    label: "Anomalies",
    path: "/dashboard/anomalies-alerts",
    icon: "anomalies",
  },
  { kind: "link", label: "Policy", path: "/dashboard/policy", icon: "policy" },
  { kind: "link", label: "Budget", path: "/dashboard/budget", icon: "budget" },
  { kind: "link", label: "Report", path: "/dashboard/report", icon: "report" },
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
    : [
        ...flattenDashboardLink(node),
        ...((node.children ?? [])
          .filter((group) => group.path && group.items.length === 0)
          .map((group) => ({
            kind: "link" as const,
            label: group.label,
            path: group.path as string,
            icon: group.icon,
          }))),
      ];

export const dashboardNavLinks: DashboardNavLink[] = dashboardNav.flatMap((node) =>
  flattenDashboardNode(node),
);
