import type { Ec2TransferType } from "./types.js";

const normalize = (value: string | null | undefined): string => (value ?? "").toLowerCase();
const includesAny = (text: string, tokens: string[]): boolean => tokens.some((token) => text.includes(token));

export const TRANSFER_TYPE_LABELS: Record<Ec2TransferType, string> = {
  internet: "Internet Data Transfer",
  inter_region: "Inter-Region Data Transfer",
  inter_az: "Inter-AZ Data Transfer",
  unknown: "Unknown",
};

export const SAVINGS_RATE: Record<Ec2TransferType, number> = {
  internet: 0.2,
  inter_region: 0.3,
  inter_az: 0.25,
  unknown: 0.1,
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

export const toTransferRecommendation = (input: { transferType: Ec2TransferType; cost: number; usageGb: number; }): { recommendation: string | null; severity: "low" | "medium" | "high" | null } => {
  if (input.transferType === "internet") {
    if (input.cost >= 10 || input.usageGb >= 100) return { recommendation: "Review public traffic, use CDN/caching/compression where applicable.", severity: input.cost >= 50 || input.usageGb >= 500 ? "high" : "medium" };
    return { recommendation: null, severity: null };
  }
  if (input.transferType === "inter_region" && input.cost > 0) return { recommendation: "Co-locate dependent services in the same region where possible.", severity: input.cost >= 25 ? "high" : "medium" };
  if (input.transferType === "inter_az" && input.cost > 0) return { recommendation: "Review cross-AZ communication and placement of chatty services.", severity: input.cost >= 20 ? "high" : "medium" };
  if (input.transferType === "unknown" && input.cost >= 5) return { recommendation: "Review billing usage type and source resource mapping.", severity: input.cost >= 25 ? "medium" : "low" };
  return { recommendation: null, severity: null };
};
