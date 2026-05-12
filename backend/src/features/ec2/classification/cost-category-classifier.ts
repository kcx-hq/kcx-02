import type { Ec2ExplorerCostCategory } from "./types.js";

const normalize = (value: string | null): string => (value ?? "").toLowerCase();
const includesAny = (text: string, terms: string[]): boolean => terms.some((term) => text.includes(term.toLowerCase()));

export type NetworkCostClassifierInput = {
  usageType: string | null;
  productUsageType: string | null;
  productFamily: string | null;
  operation: string | null;
  lineItemDescription: string | null;
  lineItemType?: string | null;
  serviceName?: string | null;
  fromLocation: string | null;
  toLocation: string | null;
  fromRegionCode: string | null;
  toRegionCode: string | null;
};

export const classifyExplorerCostCategory = (lineItem: NetworkCostClassifierInput): Ec2ExplorerCostCategory => {
  const usageType = normalize(lineItem.usageType);
  const productUsageType = normalize(lineItem.productUsageType);
  const productFamily = normalize(lineItem.productFamily);
  const operation = normalize(lineItem.operation);
  const description = normalize(lineItem.lineItemDescription);
  const lineItemType = normalize(lineItem.lineItemType ?? null);
  const serviceName = normalize(lineItem.serviceName ?? null);
  const fromLocation = normalize(lineItem.fromLocation);
  const toLocation = normalize(lineItem.toLocation);
  const blob = [
    usageType,
    productUsageType,
    productFamily,
    operation,
    description,
    lineItemType,
    serviceName,
    fromLocation,
    toLocation,
  ].join(" ");

  // Priority order:
  // 1 NAT 2 EIP 3 Data Transfer 4 Snapshot 5 EBS 6 Compute 7 Other
  const hasNat = includesAny(blob, ["natgateway", "nat-gateway", "nat gateway", "natgateway-hours", "natgateway-bytes"]);
  if (hasNat) return "nat_gateway";

  const hasEip = includesAny(blob, ["elasticip", "elastic ip", "idleaddress", "inuseaddress", "publicipv4"]);
  if (hasEip) return "elastic_ip";

  const hasDataTransfer = includesAny(blob, [
    "datatransfer",
    "data transfer",
    "dataprocessing-bytes",
    "interzone",
    "inter-zone",
    "interregion",
    "inter-region",
    "cross-az",
    "region-to-region",
    "aws-out-bytes",
    "aws-in-bytes",
    "bytes",
  ]) || includesAny(fromLocation, ["internet", "external"]) || includesAny(toLocation, ["internet", "external"]);
  if (hasDataTransfer) return "data_transfer";

  const hasSnapshot = includesAny(blob, ["snapshot", "ebssnapshot", "ec2_snapshot"]);
  if (hasSnapshot) return "snapshot";

  const hasEbs = includesAny(blob, [
    "ebs:",
    "volumeusage",
    "volumep-iops",
    "volumeiousage",
    "volumethroughput",
    "gp2",
    "gp3",
    "io1",
    "io2",
    "st1",
    "sc1",
  ]);
  if (hasEbs) return "ebs";

  const hasCompute = includesAny(blob, [
    "boxusage",
    "spotusage",
    "dedicatedusage",
    "hostboxusage",
    "cpucredits",
    "unlimitedusage",
    "runinstances",
    "instanceusage",
  ]);
  if (hasCompute) return "compute";
  return "other";
};
