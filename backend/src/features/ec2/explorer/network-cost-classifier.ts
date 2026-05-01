import type { Ec2NetworkBreakdownType } from "./ec2-explorer.types.js";
import { logger } from "../../../utils/logger.js";
import {
  classifyNetworkCostCategory,
  type NetworkCostClassifierInput,
} from "../../../../modules/ec2/classification/cost-category-classifier.js";

const shouldLogClassificationDebug = (): boolean => {
  if (process.env.NETWORK_CLASSIFICATION_DEBUG === "1" || process.env.NETWORK_CLASSIFICATION_DEBUG === "true") {
    return true;
  }
  return process.env.NODE_ENV !== "production";
};

export { type NetworkCostClassifierInput };

export const classifyNetworkCostType = (lineItem: NetworkCostClassifierInput): Ec2NetworkBreakdownType => {
  const classified = classifyNetworkCostCategory(lineItem) as Ec2NetworkBreakdownType;

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
