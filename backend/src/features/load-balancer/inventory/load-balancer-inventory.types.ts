export type InventoryLoadBalancersListQuery = {
  startDate: string | null;
  endDate: string | null;
  search: string | null;
  account: string | null;
  region: string | null;
  type: string | null;
  scheme: string | null;
  state: string | null;
  team: string | null;
  product: string | null;
  environment: string | null;
  tags: Array<{ key: string; value: string }>;
  sortBy: "name" | "type" | "scheme" | "region" | "totalCost" | "fixedCost" | "lcuCost" | "dataProcessingCost";
  sortDirection: "asc" | "desc";
  page: number;
  pageSize: number;
};

export type InventoryLoadBalancersListItem = {
  id: string;
  arn: string | null;
  name: string;
  type: string | null;
  scheme: string | null;
  state: string | null;
  region: string | null;
  vpcId: string | null;
  dnsName: string | null;
  createdAtAws: string | null;
  accountId: string | null;
  team: string | null;
  product: string | null;
  environment: string | null;
  totalCost: number;
  fixedCost: number;
  lcuCost: number;
  dataProcessingCost: number;
  tags: Record<string, unknown> | null;
};

export type InventoryLoadBalancersListResponse = {
  items: InventoryLoadBalancersListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type InventoryLoadBalancerDetailTargetGroup = {
  arn: string;
  name: string | null;
  protocol: string | null;
  port: number | null;
  targetType: string | null;
  healthyTargetCount: number;
  unhealthyTargetCount: number;
};

export type InventoryLoadBalancerDetailListener = {
  arn: string;
  protocol: string | null;
  port: number | null;
  sslPolicy: string | null;
  defaultActions: unknown[] | Record<string, unknown> | null;
};

export type InventoryLoadBalancerDetailItem = {
  id: string;
  arn: string | null;
  name: string;
  type: string | null;
  scheme: string | null;
  state: string | null;
  region: string | null;
  vpcId: string | null;
  dnsName: string | null;
  createdAtAws: string | null;
  accountId: string | null;
  cloudConnectionId: string | null;
  tags: Record<string, unknown> | null;
  targetGroups: InventoryLoadBalancerDetailTargetGroup[];
  listeners: InventoryLoadBalancerDetailListener[];
};
