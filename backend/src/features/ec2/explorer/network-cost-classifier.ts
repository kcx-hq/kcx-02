import type { Ec2NetworkBreakdownType } from "./ec2-explorer.types.js";
import { logger } from "../../../utils/logger.js";
import {
  classifyExplorerCostCategory,
  type NetworkCostClassifierInput,
} from "../classification/cost-category-classifier.js";
import { classifyDataTransferSignals } from "../classification/data-transfer-classifier.js";

const shouldLogClassificationDebug = (): boolean => {
  if (process.env.NETWORK_CLASSIFICATION_DEBUG === "1" || process.env.NETWORK_CLASSIFICATION_DEBUG === "true") {
    return true;
  }
  return process.env.NODE_ENV !== "production";
};

export { type NetworkCostClassifierInput };

export const classifyNetworkCostType = (lineItem: NetworkCostClassifierInput): Ec2NetworkBreakdownType => {
  const explorerCategory = classifyExplorerCostCategory(lineItem);
  let classified: Ec2NetworkBreakdownType = "Other Network";
  if (explorerCategory === "nat_gateway") classified = "NAT Gateway";
  else if (explorerCategory === "elastic_ip") classified = "Elastic IP";
  else if (explorerCategory === "load_balancer") classified = "Load Balancer";
  else if (explorerCategory === "data_transfer") {
    const transfer = classifyDataTransferSignals(lineItem).transferType;
    if (transfer === "internet") classified = "Internet Data Transfer";
    else if (transfer === "inter_region") classified = "Inter-Region Data Transfer";
    else if (transfer === "inter_az") classified = "Inter-AZ Data Transfer";
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
      explorer_category: explorerCategory,
      classified_type: classified,
    });
  }

  return classified;
};
