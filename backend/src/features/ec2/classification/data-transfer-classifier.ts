import type {
  Ec2DataTransferClassification,
  Ec2TransferDirection,
  Ec2TransferType,
} from "./types.js";

const normalize = (value: string | null | undefined): string => (value ?? "").toLowerCase();
const includesAny = (text: string, tokens: string[]): boolean => tokens.some((token) => text.includes(token));

export const TRANSFER_TYPE_LABELS: Record<Ec2TransferType, string> = {
  internet: "Internet Data Transfer",
  inter_region: "Inter-Region Data Transfer",
  inter_az: "Inter-AZ Data Transfer",
  regional: "Regional Data Transfer",
  unknown: "Unknown",
};

export const isNatGatewayLine = (input: { usageType: string | null; productUsageType: string | null; productFamily: string | null; operation: string | null; lineItemDescription: string | null; }): boolean => {
  const blob = [normalize(input.usageType), normalize(input.productUsageType), normalize(input.productFamily), normalize(input.operation), normalize(input.lineItemDescription)].join(" ");
  return includesAny(blob, ["natgateway", "nat-gateway", "nat gateway", "natgateway-bytes", "dataprocessing-bytes"]);
};

const isExcludedNonTransferLine = (input: {
  usageType: string | null;
  productUsageType: string | null;
  productFamily: string | null;
  operation: string | null;
  lineItemDescription: string | null;
}): boolean => {
  const blob = [
    normalize(input.usageType),
    normalize(input.productUsageType),
    normalize(input.productFamily),
    normalize(input.operation),
    normalize(input.lineItemDescription),
  ].join(" ");
  if (includesAny(blob, ["natgateway", "nat-gateway", "nat gateway", "dataprocessing-bytes"])) return true;
  if (includesAny(blob, ["loadbalancer", "load balancer", "loadbalancing", "lcu"])) return true;
  if (includesAny(blob, ["elasticip", "elastic ip", "publicipv4", "public ipv4", "idleaddress", "inuseaddress"])) return true;
  if (includesAny(blob, ["boxusage", "runinstances", "cpucredits", "cpu credit"])) return true;
  if (includesAny(blob, ["ebs:", "ebs-", "elastic block store", "gp2", "gp3", "io1", "io2", "st1", "sc1"])) return true;
  if (includesAny(blob, ["snapshot"])) return true;
  return false;
};

export const isDataTransferCandidate = (input: { usageType: string | null; productUsageType: string | null; productFamily: string | null; operation: string | null; lineItemDescription: string | null; }): boolean => {
  const usageType = normalize(input.usageType);
  const productUsageType = normalize(input.productUsageType);
  const productFamily = normalize(input.productFamily);
  const lineItemDescription = normalize(input.lineItemDescription);
  if (isExcludedNonTransferLine(input) || isNatGatewayLine(input)) return false;
  return (
    usageType.includes("datatransfer")
    || productUsageType.includes("datatransfer")
    || productFamily.includes("data transfer")
    || lineItemDescription.includes("data transfer")
  );
};

export const classifyTransferType = (input: { usageType: string | null; productUsageType: string | null; productFamily: string | null; operation: string | null; lineItemDescription: string | null; fromLocation: string | null; toLocation: string | null; fromRegionCode: string | null; toRegionCode: string | null; }): { transferType: Ec2TransferType; confidence: "low" | "medium" | "high" } => {
  const blob = [normalize(input.usageType), normalize(input.productUsageType), normalize(input.productFamily), normalize(input.operation), normalize(input.lineItemDescription), normalize(input.fromLocation), normalize(input.toLocation)].join(" ");
  const fromRegionCode = normalize(input.fromRegionCode);
  const toRegionCode = normalize(input.toRegionCode);
  const hasRegionCodes = fromRegionCode.length > 0 && toRegionCode.length > 0;
  if (includesAny(blob, [
    "datatransfer-out-bytes",
    "datatransfer-in-bytes",
    "datatransfer-out-internet",
    "datatransfer-in-internet",
    "aws-out-bytes",
    "aws-in-bytes",
    "aws-datatransfer-out-bytes",
    "aws-datatransfer-in-bytes",
    "internet",
    "external",
  ])) {
    return { transferType: "internet", confidence: "high" };
  }
  if (includesAny(blob, [
    "datatransfer-interaz",
    "datatransfer-xaz-in-bytes",
    "datatransfer-xaz-out-bytes",
    "interaz",
    "inter-az",
    "availabilityzone",
    "availability-zone",
    "az-az",
    "zone-zone",
  ])) {
    return { transferType: "inter_az", confidence: "high" };
  }
  if (includesAny(blob, ["datatransfer-regional-bytes", "aws-datatransfer-regional-bytes", "interregion", "inter-region", "crossregion", "cross-region", "region-region"])) {
    return { transferType: "inter_region", confidence: "high" };
  }
  if (includesAny(blob, ["regional-bytes", "datatransfer-regional", "sameregion", "same-region"])) {
    return { transferType: "regional", confidence: "medium" };
  }
  if (hasRegionCodes && fromRegionCode !== toRegionCode) return { transferType: "inter_region", confidence: "medium" };
  if (hasRegionCodes && fromRegionCode === toRegionCode) return { transferType: "regional", confidence: "low" };
  return { transferType: "unknown", confidence: "low" };
};

export const classifyTransferDirection = (input: {
  usageType: string | null;
  productUsageType: string | null;
  operation: string | null;
  lineItemDescription: string | null;
  transferType: Ec2TransferType;
}): Ec2TransferDirection => {
  if (input.transferType === "inter_region") return "inter_region";
  if (input.transferType === "inter_az") return "inter_az";
  if (input.transferType === "regional") return "regional";
  const blob = [
    normalize(input.usageType),
    normalize(input.productUsageType),
    normalize(input.operation),
    normalize(input.lineItemDescription),
  ].join(" ");
  if (input.transferType === "internet") {
    if (includesAny(blob, ["out-bytes", "datatransfer-out", "datatransfer-out-internet", "aws-out-bytes"])) return "internet_out";
    if (includesAny(blob, ["in-bytes", "datatransfer-in", "datatransfer-in-internet", "aws-in-bytes"])) return "internet_in";
  }
  return "unknown";
};

export const classifyDataTransferSignals = (input: {
  usageType: string | null;
  productUsageType: string | null;
  productFamily: string | null;
  operation: string | null;
  lineItemDescription: string | null;
  fromLocation: string | null;
  toLocation: string | null;
  fromRegionCode: string | null;
  toRegionCode: string | null;
}): Ec2DataTransferClassification => {
  const nat = isNatGatewayLine(input);
  if (nat) {
    return {
      isNatGateway: true,
      isDataTransferCandidate: false,
      transferType: "unknown",
      transferDirection: "unknown",
      confidence: "low",
    };
  }
  const candidate = isDataTransferCandidate(input);
  const { transferType, confidence } = classifyTransferType(input);
  const transferDirection = classifyTransferDirection({
    usageType: input.usageType,
    productUsageType: input.productUsageType,
    operation: input.operation,
    lineItemDescription: input.lineItemDescription,
    transferType,
  });
  return {
    isNatGateway: nat,
    isDataTransferCandidate: candidate,
    transferType,
    transferDirection,
    confidence,
  };
};
