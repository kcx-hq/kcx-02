export type Ec2InstanceCondition = "idle" | "underutilized" | "overutilized" | "uncovered" | "healthy";
export type Ec2InstancePrimaryCondition = "idle" | "underutilized" | "overutilized" | "healthy";
export type Ec2InstanceSignal = "idle" | "underutilized" | "overutilized" | "uncovered_on_demand";
export type Ec2InstancePricingCondition = "uncovered_on_demand" | "covered" | "unknown";
export type Ec2InstanceClassification = {
  primaryCondition: Ec2InstancePrimaryCondition;
  signals: Ec2InstanceSignal[];
  pricingCondition: Ec2InstancePricingCondition;
};

export type Ec2VolumeSignal =
  | "unattached"
  | "attached_stopped"
  | "idle"
  | "underutilized"
  | "low_utilization"
  | "normal";
export type Ec2VolumeClassification = {
  primaryCondition: Ec2VolumeSignal;
  signals: Exclude<Ec2VolumeSignal, "normal">[];
};

export type Ec2SnapshotSignal = "old" | "orphaned" | "normal";
export type Ec2SnapshotClassification = {
  primaryCondition: Ec2SnapshotSignal;
  signals: Exclude<Ec2SnapshotSignal, "normal">[];
};

export type Ec2TransferType = "internet" | "inter_region" | "inter_az" | "unknown";
export type Ec2DataTransferClassification = {
  isNatGateway: boolean;
  isDataTransferCandidate: boolean;
  transferType: Ec2TransferType;
  confidence: "low" | "medium" | "high";
};

export type Ec2ElasticIpState = "attached" | "unattached" | "unknown";
export type Ec2ElasticIpClassification = {
  state: Ec2ElasticIpState;
  associatedResourceId: string | null;
  signals: Ec2ElasticIpState[];
};

export type Ec2ExplorerCostCategory =
  | "compute"
  | "data_transfer"
  | "ebs"
  | "snapshot"
  | "elastic_ip"
  | "load_balancer"
  | "nat_gateway"
  | "other";
