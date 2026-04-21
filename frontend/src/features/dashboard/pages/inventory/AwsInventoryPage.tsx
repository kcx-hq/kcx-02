import { InventoryProviderPage } from "./components/InventoryProviderPage";
import type { InventoryServiceGroup } from "./components/inventory-provider.types";

const serviceGroups: InventoryServiceGroup[] = [
  {
    id: "compute",
    title: "Compute (EC2)",
    items: [
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
        id: "ec2-amis",
        label: "AMIs",
        placeholder: true,
      },
      {
        id: "ec2-anomaly-detection",
        label: "Anomaly Detection",
        href: "/dashboard/ec2/anomaly-detection",
        matchPrefixes: ["/dashboard/ec2/anomaly-detection"],
      },
    ],
  },
  {
    id: "storage",
    title: "Storage",
    items: [
      {
        id: "s3-buckets",
        label: "S3 Buckets",
        placeholder: true,
      },
    ],
  },
  {
    id: "database",
    title: "Database",
    items: [
      {
        id: "rds-instances",
        label: "RDS Instances",
        placeholder: true,
      },
    ],
  },
  {
    id: "commitments",
    title: "Commitments",
    items: [
      {
        id: "savings-plans",
        label: "Savings Plans",
        placeholder: true,
      },
      {
        id: "reserved-instances",
        label: "Reserved Instances",
        placeholder: true,
      },
    ],
  },
];

export default function AwsInventoryPage() {
  return (
    <InventoryProviderPage
      title="Services"
      subtitle="Explore cost-driving cloud services across your connected accounts."
      groups={serviceGroups}
    />
  );
}
