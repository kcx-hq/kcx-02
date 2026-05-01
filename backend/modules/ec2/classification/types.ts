export type Ec2InstanceCondition = "idle" | "underutilized" | "overutilized" | "uncovered" | "healthy";

export type Ec2VolumeSignal = "unattached" | "attached_stopped" | "idle" | "underutilized" | "normal";

export type Ec2SnapshotSignal = "old" | "orphaned" | "normal";

export type Ec2TransferType = "internet" | "inter_region" | "inter_az" | "unknown";

export type Ec2ElasticIpState = "attached" | "unattached";

export type Ec2NetworkCostCategory =
  | "NAT Gateway"
  | "Elastic IP"
  | "Load Balancer"
  | "Internet Data Transfer"
  | "Inter-Region Data Transfer"
  | "Inter-AZ Data Transfer"
  | "Other Network";
