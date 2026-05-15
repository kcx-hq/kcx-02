import { InventoryProviderPage } from "./components/InventoryProviderPage";
import type { InventoryServiceGroup } from "./components/inventory-provider.types";

const serviceGroups: InventoryServiceGroup[] = [
  {
    id: "compute",
    title: "Compute (EC2)",
    items: [
      {
        id: "ec2-explorer",
        label: "EC2 Explorer",
        href: "/dashboard/ec2/explorer",
        matchPrefixes: ["/dashboard/ec2/explorer"],
      },
      {
        id: "ec2-instances",
        label: "Instances",
        href: "/dashboard/inventory/aws/ec2/instances",
        matchPrefixes: ["/dashboard/inventory/aws/ec2/instances"],
      },
      {
        id: "ec2-volumes",
        label: "Volumes",
        href: "/dashboard/inventory/aws/ec2/volumes",
        matchPrefixes: ["/dashboard/inventory/aws/ec2/volumes"],
      },
      {
        id: "ec2-snapshots",
        label: "Snapshots",
        href: "/dashboard/inventory/aws/ec2/snapshots",
        matchPrefixes: ["/dashboard/inventory/aws/ec2/snapshots"],
      },
      {
        id: "ec2-optimization",
        label: "Optimization",
        href: "/dashboard/ec2/optimization",
        matchPrefixes: ["/dashboard/ec2/optimization"],
      },
      {
        id: "ec2-data-transfer",
        label: "Data Transfer",
        href: "/dashboard/ec2/network/data-transfer",
        matchPrefixes: ["/dashboard/ec2/network/data-transfer"],
      },
      {
        id: "ec2-elastic-ip",
        label: "Elastic IP",
        href: "/dashboard/inventory/aws/ec2/elastic-ip",
        matchPrefixes: ["/dashboard/inventory/aws/ec2/elastic-ip", "/dashboard/ec2/network/elastic-ip"],
      },
      {
        id: "ec2-amis",
        label: "AMIs",
        placeholder: true,
      },
    ],
  },
  {
    id: "storage",
    title: "Storage",
    items: [
      {
        id: "s3-explorer",
        label: "S3 Bucket",
        href: "/dashboard/s3",
        matchPrefixes: ["/dashboard/s3"],
      },
      {
        id: "s3-cost",
        label: "S3 Cost",
        href: "/dashboard/s3/cost",
        matchPrefixes: ["/dashboard/s3/cost"],
      },
      {
        id: "s3-usage",
        label: "S3 Usage",
        href: "/dashboard/s3/usage",
        matchPrefixes: ["/dashboard/s3/usage"],
      },
      {
        id: "s3-optimization",
        label: "S3 Optimization",
        href: "/dashboard/s3/optimization",
        matchPrefixes: ["/dashboard/s3/optimization"],
      },
    ],
  },
  {
    id: "database",
    title: "Database",
    items: [
      {
        id: "database-explorer",
        label: "Database Explorer",
        href: "/dashboard/services/database",
        matchPrefixes: ["/dashboard/services/database"],
      },
      {
        id: "database-assets",
        label: "Database Assets",
        href: "/dashboard/services/database/assets",
        matchPrefixes: ["/dashboard/services/database/assets"],
      },
    ],
  },
  {
    id: "load-balancing",
    title: "Load Balancing",
    items: [
      {
        id: "load-balancer-explorer",
        label: "Load Balancer Explorer",
        href: "/dashboard/load-balancer/explorer",
        matchPrefixes: ["/dashboard/load-balancer/explorer"],
      },
      {
        id: "load-balancer-list",
        label: "Load Balancer List",
        href: "/dashboard/inventory/aws/load-balancer/list",
        matchPrefixes: ["/dashboard/inventory/aws/load-balancer/list"],
      },
      {
        id: "load-balancer-optimization",
        label: "Load Balancer Optimization",
        href: "/dashboard/load-balancer/optimization",
        matchPrefixes: ["/dashboard/load-balancer/optimization"],
      },
    ],
  },
];

export default function AwsInventoryPage() {
  return (
    <InventoryProviderPage
      title="Services"
      subtitle="Explore cost-driving cloud services across your connected accounts."
      hideHeader
      groups={serviceGroups}
    />
  );
}
