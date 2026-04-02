export type DashboardScope =
  | {
      scopeType: "upload";
      tenantId: string;
      rawBillingFileIds: number[];
      ingestionRunIds: number[];
      from: string;
      to: string;
    }
  | {
      scopeType: "global";
      tenantId: string;
      from: string;
      to: string;
      providerId?: number;
      billingAccountKey?: number;
      subAccountKey?: number;
      serviceKey?: number;
      regionKey?: number;
    };

export type DashboardRequest = {
  tenantId: string;
  rawBillingFileId?: number;
  rawBillingFileIds?: number[];
  from?: string;
  to?: string;
  providerId?: number;
  billingAccountKey?: number;
  subAccountKey?: number;
  serviceKey?: number;
  regionKey?: number;
};
