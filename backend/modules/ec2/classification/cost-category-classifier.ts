import type { Ec2NetworkCostCategory } from "./types.js";

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

export const classifyNetworkCostCategory = (lineItem: NetworkCostClassifierInput): Ec2NetworkCostCategory => {
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

  if (includesAny(blob, ["natgateway", "nat-gateway", "nat gateway"])) return "NAT Gateway";
  if (includesAny(blob, ["elasticip", "elastic ip", "idleaddress", "inuseaddress"])) return "Elastic IP";
  if (includesAny(blob, ["loadbalancer", "load balancer", "lcu", "alb", "nlb", "elb", "loadbalancing"])) return "Load Balancer";
  if (includesAny(toLocation, ["internet", "external"]) || includesAny(fromLocation, ["internet", "external"])) return "Internet Data Transfer";
  if (hasRegionCodes && fromRegionCode !== toRegionCode) return "Inter-Region Data Transfer";
  if (hasRegionCodes && fromRegionCode === toRegionCode) return "Inter-AZ Data Transfer";
  if (includesAny(blob, ["datatransfer-out", "aws-out-bytes"])) return "Internet Data Transfer";
  return "Other Network";
};
