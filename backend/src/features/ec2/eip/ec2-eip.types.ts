import type { DashboardScope } from "../../dashboard/dashboard.types.js";

export const EC2_EIP_STATES = ["all", "attached", "unattached", "unknown"] as const;
export type Ec2ElasticIpState = (typeof EC2_EIP_STATES)[number];

export type Ec2ElasticIpInput = {
  scope: DashboardScope;
  startDate: string;
  endDate: string;
  accountId: string | null;
  region: string | null;
  state: Ec2ElasticIpState;
  search: string | null;
  page: number;
  pageSize: number;
};

export type Ec2ElasticIpRawRow = {
  eipId: string | null;
  publicIp: string | null;
  accountId: string | null;
  accountName: string | null;
  region: string | null;
  usageType: string | null;
  productName: string | null;
  operation: string | null;
  lineItemType: string | null;
  lineItemDescription: string | null;
  cost: number | string | null;
  usageDate: string;
};

export type Ec2ElasticIpRow = {
  eipId: string;
  publicIp: string;
  accountName: string;
  accountId: string;
  region: string;
  state: "attached" | "unattached" | "unknown";
  associatedResourceId: string | null;
  cost: number;
  lastSeen: string | null;
  recommendation: string | null;
  estimatedSavings: number;
};

export type Ec2ElasticIpResponse = {
  summary: {
    totalCost: number;
    totalEips: number;
    unattachedCount: number;
    potentialSavings: number;
  };
  rows: Ec2ElasticIpRow[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
};
