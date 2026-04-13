export type UploadDashboardSectionKey = "overview" | "cost-explorer" | "anomalies-alerts";

export type UploadDashboardSectionResponse = {
  [key: string]: unknown;
};

export type UploadDashboardFiltersQuery = {
  rawBillingFileIds?: number[];
  billingPeriodStart?: string;
  billingPeriodEnd?: string;
  subAccountKey?: string;
  serviceKey?: string;
  regionKey?: string;
};

export type UploadDashboardFiltersResponse = {
  billingPeriod: {
    min: string | null;
    max: string | null;
    defaultStart: string | null;
    defaultEnd: string | null;
  };
  accounts: Array<{ key: number; name: string }>;
  services: Array<{ key: number; name: string }>;
  regions: Array<{ key: number; name: string }>;
};
