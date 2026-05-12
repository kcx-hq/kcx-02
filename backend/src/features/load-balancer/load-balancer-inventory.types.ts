export type AwsConnectionContext = {
  tenantId: string | null;
  providerId: string | null;
  connectionId: string;
  actionRoleArn: string;
  externalId: string | null;
  defaultRegion: string;
  accountId: string;
};

export type RegionInfo = {
  region: string;
  optInStatus: string | null;
};

export type LoadBalancerInventoryRow = {
  cloudConnectionId: string;
  accountId: string;
  region: string;
  arn: string;
  name: string | null;
  type: "application" | "network";
  scheme: string | null;
  state: string | null;
  vpcId: string | null;
  dnsName: string | null;
  createdAtAws: Date | null;
  securityGroups: string[] | null;
  availabilityZones: Array<Record<string, unknown>> | null;
  tags: Record<string, string> | null;
  listenerCount: number;
  targetGroupCount: number;
  lastSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type LoadBalancerTargetGroupInventoryRow = {
  cloudConnectionId: string;
  accountId: string;
  region: string;
  arn: string;
  name: string | null;
  loadBalancerArn: string | null;
  protocol: string | null;
  port: number | null;
  targetType: string | null;
  vpcId: string | null;
  healthCheckProtocol: string | null;
  healthCheckPath: string | null;
  healthyTargetCount: number | null;
  unhealthyTargetCount: number | null;
  tags: Record<string, string> | null;
  lastSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type LoadBalancerListenerInventoryRow = {
  cloudConnectionId: string;
  accountId: string;
  region: string;
  arn: string;
  loadBalancerArn: string | null;
  protocol: string | null;
  port: number | null;
  sslPolicy: string | null;
  certificates: Array<Record<string, unknown>> | null;
  defaultActions: Array<Record<string, unknown>> | null;
  lastSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type TargetHealthSummary = {
  healthyTargetCount: number;
  unhealthyTargetCount: number;
};
