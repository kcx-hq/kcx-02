export type Ec2RecommendationCategory = "compute" | "storage" | "pricing" | "network";
export type Ec2RecommendationType =
  | "idle_instance"
  | "underutilized_instance"
  | "overutilized_instance"
  | "unattached_volume"
  | "old_snapshot"
  | "orphaned_snapshot"
  | "uncovered_on_demand"
  | "high_internet_data_transfer"
  | "high_inter_region_data_transfer"
  | "high_inter_az_data_transfer"
  | "low_cpu_high_network"
  | "high_nat_gateway_cost"
  | "unattached_elastic_ip";
export type Ec2RecommendationResourceType = "instance" | "volume" | "snapshot" | "elastic_ip";
export type Ec2RecommendationRisk = "low" | "medium" | "high";
export type Ec2RecommendationEffort = "low" | "medium" | "high";
export type Ec2RecommendationStatus = "open" | "in_progress" | "snoozed" | "dismissed" | "completed";

export type Ec2RecommendationsQuery = {
  tenantId: string;
  dateFrom: string;
  dateTo: string;
  cloudConnectionId: string | null;
  billingSourceId: number | null;
  category: Ec2RecommendationCategory | null;
  type: Ec2RecommendationType | null;
  status: Ec2RecommendationStatus | null;
  account: string | null;
  region: string | null;
  team: string | null;
  product: string | null;
  environment: string | null;
  tags: string[];
};

export type Ec2RefreshRecommendationsInput = {
  tenantId: string;
  dateFrom: string;
  dateTo: string;
  cloudConnectionId: string | null;
  billingSourceId: number | null;
};

export type Ec2RecommendationRecord = {
  id: number;
  category: Ec2RecommendationCategory;
  type: Ec2RecommendationType;
  resourceType: Ec2RecommendationResourceType;
  resourceId: string;
  resourceName: string;
  accountId: string | null;
  region: string | null;
  problem: string;
  evidence: string;
  action: string;
  estimatedMonthlySaving: number;
  risk: Ec2RecommendationRisk;
  effort: Ec2RecommendationEffort;
  status: Ec2RecommendationStatus;
  statusReason: string | null;
  snoozedUntil: string | null;
  detectedAt: string | null;
  lastSeenAt: string | null;
  metadata: Record<string, unknown> | null;
};

export type Ec2RecommendationsResponse = {
  overview: {
    totalPotentialMonthlySaving: number;
    countByCategory: Record<Ec2RecommendationCategory, number>;
    savingByCategory: Record<Ec2RecommendationCategory, number>;
    countByType: Record<Ec2RecommendationType, number>;
  };
  recommendations: {
    compute: Ec2RecommendationRecord[];
    storage: Ec2RecommendationRecord[];
    pricing: Ec2RecommendationRecord[];
    network: Ec2RecommendationRecord[];
  };
};
