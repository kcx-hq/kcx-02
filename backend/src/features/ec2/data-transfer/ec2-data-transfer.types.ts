import type { DashboardScope } from "../../dashboard/dashboard.types.js";

export const EC2_TRANSFER_TYPES = ["internet", "inter_region", "inter_az", "regional", "unknown"] as const;
export type Ec2TransferType = (typeof EC2_TRANSFER_TYPES)[number];

export type Ec2DataTransferInput = {
  scope: DashboardScope;
  startDate: string;
  endDate: string;
  accountId: string | null;
  region: string | null;
  team: string | null;
  product: string | null;
  environment: string | null;
  tagKey: string | null;
  tagValue: string | null;
  transferType: Ec2TransferType | null;
};

export type Ec2DataTransferRawRow = {
  date: string;
  resourceId: string | null;
  resourceName: string | null;
  accountId: string | null;
  accountName: string | null;
  region: string | null;
  team: string | null;
  product: string | null;
  environment: string | null;
  usageType: string | null;
  productUsageType: string | null;
  productFamily: string | null;
  operation: string | null;
  lineItemDescription: string | null;
  fromLocation: string | null;
  toLocation: string | null;
  fromRegionCode: string | null;
  toRegionCode: string | null;
  usageQuantity: number | string | null;
  usageQuantityBytes: number | string | null;
  cost: number | string | null;
};

export type Ec2DataTransferRow = {
  resourceId: string | null;
  resourceName: string | null;
  accountId: string;
  accountName: string | null;
  region: string;
  team: string | null;
  product: string | null;
  environment: string | null;
  transferType: Ec2TransferType;
  transferTypeLabel: string;
  usageGb: number;
  cost: number;
  costTrendPct: number | null;
  firstSeen: string | null;
  lastSeen: string | null;
  recommendation: string | null;
  recommendationSeverity: "low" | "medium" | "high" | null;
  estimatedSavings: number;
  confidence: "low" | "medium" | "high";
};

export type Ec2DataTransferResponse = {
  summary: {
    totalCost: number;
    totalUsageGb: number;
    resourceCount: number;
    internetCost: number;
    interRegionCost: number;
    interAzCost: number;
    regionalCost: number;
    unknownCost: number;
    potentialSavings: number;
  };
  breakdown: Array<{
    transferType: Ec2TransferType;
    label: string;
    cost: number;
    usageGb: number;
    percentageOfDataTransferCost: number;
    resourceCount: number;
    recommendationCount: number;
  }>;
  trend: Array<{
    date: string;
    internetCost: number;
    interRegionCost: number;
    interAzCost: number;
    regionalCost: number;
    unknownCost: number;
    totalCost: number;
    usageGb: number;
  }>;
};
