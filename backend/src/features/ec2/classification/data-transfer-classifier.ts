import type { Ec2DataTransferClassification, Ec2TransferType } from "./types.js";

const normalize = (value: string | null | undefined): string => (value ?? "").toLowerCase();
const includesAny = (text: string, tokens: string[]): boolean => tokens.some((token) => text.includes(token));

export const TRANSFER_TYPE_LABELS: Record<Ec2TransferType, string> = {
  internet: "Internet Data Transfer",
  inter_region: "Inter-Region Data Transfer",
  inter_az: "Inter-AZ Data Transfer",
  unknown: "Unknown",
};

export const isNatGatewayLine = (input: { usageType: string | null; productUsageType: string | null; productFamily: string | null; operation: string | null; lineItemDescription: string | null; }): boolean => {
  const blob = [normalize(input.usageType), normalize(input.productUsageType), normalize(input.productFamily), normalize(input.operation), normalize(input.lineItemDescription)].join(" ");
  return includesAny(blob, ["natgateway", "nat-gateway", "nat gateway", "natgateway-bytes", "dataprocessing-bytes"]);
};

export const isDataTransferCandidate = (input: { usageType: string | null; productUsageType: string | null; productFamily: string | null; operation: string | null; lineItemDescription: string | null; }): boolean => {
  const blob = [normalize(input.usageType), normalize(input.productUsageType), normalize(input.productFamily), normalize(input.operation), normalize(input.lineItemDescription)].join(" ");
  if (isNatGatewayLine(input)) return false;
  if (includesAny(blob, ["elasticip", "elastic ip", "idleaddress", "inuseaddress", "loadbalancer", "load balancer", "lcu"])) return false;
  return includesAny(blob, ["datatransfer", "data transfer", "aws-out-bytes", "aws-in-bytes", "regional-datatransfer-out-bytes", "interregion", "inter-zone", "interzone", "cross-az", "region-to-region"]);
};

export const classifyTransferType = (input: { usageType: string | null; productUsageType: string | null; productFamily: string | null; operation: string | null; lineItemDescription: string | null; fromLocation: string | null; toLocation: string | null; fromRegionCode: string | null; toRegionCode: string | null; }): { transferType: Ec2TransferType; confidence: "low" | "medium" | "high" } => {
  const blob = [normalize(input.usageType), normalize(input.productUsageType), normalize(input.productFamily), normalize(input.operation), normalize(input.lineItemDescription), normalize(input.fromLocation), normalize(input.toLocation)].join(" ");
  const fromRegionCode = normalize(input.fromRegionCode);
  const toRegionCode = normalize(input.toRegionCode);
  const hasRegionCodes = fromRegionCode.length > 0 && toRegionCode.length > 0;
  if (includesAny(normalize(input.toLocation), ["internet", "external"]) || includesAny(normalize(input.fromLocation), ["internet", "external"])) return { transferType: "internet", confidence: "high" };
  if (hasRegionCodes && fromRegionCode !== toRegionCode) return { transferType: "inter_region", confidence: "high" };
  if (hasRegionCodes && fromRegionCode === toRegionCode) return { transferType: "inter_az", confidence: "high" };
  if (includesAny(blob, ["datatransfer-out", "aws-out-bytes"])) return { transferType: "internet", confidence: "medium" };
  return { transferType: "unknown", confidence: "low" };
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
      confidence: "low",
    };
  }
  const candidate = isDataTransferCandidate(input);
  const { transferType, confidence } = classifyTransferType(input);
  return {
    isNatGateway: nat,
    isDataTransferCandidate: candidate,
    transferType,
    confidence,
  };
};
