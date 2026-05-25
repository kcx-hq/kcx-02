import type { DashboardScope } from "../../dashboard.types.js";

export type S3AnomaliesFilters = {
  limit: number;
  offset: number;
  severity?: "low" | "medium" | "high";
  status?: "open" | "resolved" | "ignored";
};

export type S3AnomalyRow = {
  id: string;
  startDate: string;
  insightTitle: string;
  insightDescription: string;
  recommendation: string | null;
  duration: string;
  accountId: string | null;
  service: string;
  region: string | null;
  costImpactType: "Increase";
  costImpact: number;
  impactPercent: number;
  cost: number;
  severity: "low" | "medium" | "high";
  status: "open" | "resolved" | "ignored";
};

export type S3AnomaliesResponse = {
  section: "s3-anomalies";
  items: S3AnomalyRow[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
};

export type S3AnomaliesRepositoryInput = {
  scope: DashboardScope;
  filters: S3AnomaliesFilters;
};

