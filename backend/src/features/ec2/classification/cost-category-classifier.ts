import type { Ec2ExplorerCostCategory } from "./types.js";

const normalize = (value: string | null): string => (value ?? "").toLowerCase();
const includesAny = (text: string, terms: string[]): boolean => terms.some((term) => text.includes(term.toLowerCase()));

export type NetworkCostClassifierInput = {
  usageType: string | null;
  productUsageType: string | null;
  productFamily: string | null;
  operation: string | null;
  lineItemDescription: string | null;
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
  const fromLocation = normalize(lineItem.fromLocation);
  const toLocation = normalize(lineItem.toLocation);
  const fromRegionCode = normalize(lineItem.fromRegionCode);
  const toRegionCode = normalize(lineItem.toRegionCode);
  const blob = [usageType, productUsageType, productFamily, operation, description, fromLocation, toLocation].join(" ");
  const hasRegionCodes = fromRegionCode.length > 0 && toRegionCode.length > 0;

  if (includesAny(blob, ["natgateway", "nat-gateway", "nat gateway"])) return "nat_gateway";
  if (includesAny(blob, ["elasticip", "elastic ip", "idleaddress", "inuseaddress"])) return "elastic_ip";
  if (includesAny(blob, ["loadbalancer", "load balancer", "lcu", "alb", "nlb", "elb", "loadbalancing"])) return "load_balancer";
  if (
    includesAny(toLocation, ["internet", "external"]) ||
    includesAny(fromLocation, ["internet", "external"]) ||
    hasRegionCodes ||
    includesAny(blob, ["datatransfer", "data transfer", "datatransfer-out", "aws-out-bytes", "aws-in-bytes", "interregion", "inter-zone", "interzone", "cross-az", "region-to-region"])
  ) {
    return "data_transfer";
  }
  if (includesAny(blob, ["snapshot", "ebssnapshot", "ec2_snapshot"])) return "snapshot";
  if (includesAny(blob, ["ebs", "volumeusage", "gp2", "gp3", "io1", "io2", "st1", "sc1"])) return "ebs";
  if (includesAny(blob, ["boxusage", "runinstances", "cpucredits", "instance"])) return "compute";
  return "other";
};
