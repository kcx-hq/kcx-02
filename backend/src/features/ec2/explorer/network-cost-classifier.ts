import type { Ec2NetworkBreakdownType } from "./ec2-explorer.types.js";
import { logger } from "../../../utils/logger.js";

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

const normalize = (value: string | null): string => (value ?? "").toLowerCase();

const includesAny = (text: string, terms: string[]): boolean =>
  terms.some((term) => text.includes(term.toLowerCase()));

const shouldLogClassificationDebug = (): boolean => {
  if (process.env.NETWORK_CLASSIFICATION_DEBUG === "1" || process.env.NETWORK_CLASSIFICATION_DEBUG === "true") {
    return true;
  }
  return process.env.NODE_ENV !== "production";
};

export const classifyNetworkCostType = (lineItem: NetworkCostClassifierInput): Ec2NetworkBreakdownType => {
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
  let classified: Ec2NetworkBreakdownType = "Other Network";

  // 1) NAT Gateway
  if (includesAny(blob, ["natgateway", "nat-gateway", "nat gateway"])) {
    classified = "NAT Gateway";
  } else if (includesAny(blob, ["elasticip", "elastic ip", "idleaddress", "inuseaddress"])) {
    // 2) Elastic IP
    classified = "Elastic IP";
  } else if (includesAny(blob, ["loadbalancer", "load balancer", "lcu", "alb", "nlb", "elb", "loadbalancing"])) {
    // 3) Load Balancer
    classified = "Load Balancer";
  } else if (
    // 4) Internet Data Transfer (strict location based)
    includesAny(toLocation, ["internet", "external"]) ||
    includesAny(fromLocation, ["internet", "external"])
  ) {
    classified = "Internet Data Transfer";
  } else if (
    // 5) Inter-Region Data Transfer
    hasRegionCodes &&
    fromRegionCode !== toRegionCode
  ) {
    classified = "Inter-Region Data Transfer";
  } else if (
    // 6) Inter-AZ Data Transfer
    hasRegionCodes &&
    fromRegionCode === toRegionCode
  ) {
    classified = "Inter-AZ Data Transfer";
  } else if (
    // 7) Internet Data Transfer (text fallback only)
    includesAny(blob, ["datatransfer-out", "aws-out-bytes"])
  ) {
    classified = "Internet Data Transfer";
  } else {
    // 8) Other Network
    classified = "Other Network";
  }

  if (shouldLogClassificationDebug()) {
    logger.debug("EC2 network cost classified", {
      usage_type: lineItem.usageType,
      product_usage_type: lineItem.productUsageType,
      operation: lineItem.operation,
      line_item_description: lineItem.lineItemDescription,
      from_region_code: lineItem.fromRegionCode,
      to_region_code: lineItem.toRegionCode,
      from_location: lineItem.fromLocation,
      to_location: lineItem.toLocation,
      classified_type: classified,
    });
  }

  return classified;
};
