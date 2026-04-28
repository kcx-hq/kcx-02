export type Ec2RecommendationCategory = "compute" | "storage" | "pricing";
export type Ec2RecommendationType =
  | "idle_instance"
  | "underutilized_instance"
  | "overutilized_instance"
  | "unattached_volume"
  | "old_snapshot"
  | "uncovered_on_demand";
export type Ec2RecommendationResourceType = "instance" | "volume" | "snapshot";
export type Ec2RecommendationRisk = "low" | "medium" | "high";
export type Ec2RecommendationStatus = "open" | "accepted" | "ignored" | "snoozed" | "completed";

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
  status: Ec2RecommendationStatus;
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
  };
};

