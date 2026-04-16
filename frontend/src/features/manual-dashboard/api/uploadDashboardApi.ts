import { apiGet } from "@/lib/api";
import type {
  AnomaliesFiltersQuery,
  AnomaliesListResponse,
  CostExplorerFiltersQuery,
  CostExplorerGroupOptionsResponse,
  CostExplorerResponse,
  DashboardOverviewResponse,
} from "./dashboardTypes";
import type {
  UploadDashboardFiltersQuery,
  UploadDashboardFiltersResponse,
} from "./uploadDashboardTypes";

function withUploadDashboardQuery(path: string, filters?: UploadDashboardFiltersQuery): string {
  const params = new URLSearchParams();

  if (filters?.rawBillingFileIds && filters.rawBillingFileIds.length > 0) {
    params.set("rawBillingFileIds", filters.rawBillingFileIds.join(","));
  }
  if (filters?.billingPeriodStart) params.set("billingPeriodStart", filters.billingPeriodStart);
  if (filters?.billingPeriodEnd) params.set("billingPeriodEnd", filters.billingPeriodEnd);
  if (filters?.subAccountKey) params.set("subAccountKey", filters.subAccountKey);
  if (filters?.serviceKey) params.set("serviceKey", filters.serviceKey);
  if (filters?.regionKey) params.set("regionKey", filters.regionKey);
  if ((filters as CostExplorerFiltersQuery | undefined)?.granularity) {
    params.set("granularity", (filters as CostExplorerFiltersQuery).granularity as string);
  }
  if ((filters as CostExplorerFiltersQuery | undefined)?.groupBy) {
    params.set("groupBy", (filters as CostExplorerFiltersQuery).groupBy as string);
  }
  if ((filters as CostExplorerFiltersQuery | undefined)?.metric) {
    params.set("metric", (filters as CostExplorerFiltersQuery).metric as string);
  }
  if ((filters as CostExplorerFiltersQuery | undefined)?.compareKey) {
    params.set("compareKey", (filters as CostExplorerFiltersQuery).compareKey as string);
  }
  if ((filters as CostExplorerFiltersQuery | undefined)?.tagKey) {
    params.set("tagKey", ((filters as CostExplorerFiltersQuery).tagKey as string).trim().toLowerCase());
  }
  if ((filters as CostExplorerFiltersQuery | undefined)?.tagValue) {
    params.set("tagValue", ((filters as CostExplorerFiltersQuery).tagValue as string).trim().toLowerCase());
  }
  if (typeof (filters as AnomaliesFiltersQuery | undefined)?.billing_source_id === "number") {
    params.set("billing_source_id", String((filters as AnomaliesFiltersQuery).billing_source_id));
  }
  if ((filters as AnomaliesFiltersQuery | undefined)?.status) {
    params.set("status", (filters as AnomaliesFiltersQuery).status as string);
  }
  if ((filters as AnomaliesFiltersQuery | undefined)?.severity) {
    params.set("severity", (filters as AnomaliesFiltersQuery).severity as string);
  }
  if ((filters as AnomaliesFiltersQuery | undefined)?.anomaly_type) {
    params.set("anomaly_type", (filters as AnomaliesFiltersQuery).anomaly_type as string);
  }
  if ((filters as AnomaliesFiltersQuery | undefined)?.date_from) {
    params.set("date_from", (filters as AnomaliesFiltersQuery).date_from as string);
  }
  if ((filters as AnomaliesFiltersQuery | undefined)?.date_to) {
    params.set("date_to", (filters as AnomaliesFiltersQuery).date_to as string);
  }
  if (typeof (filters as AnomaliesFiltersQuery | undefined)?.limit === "number") {
    params.set("limit", String((filters as AnomaliesFiltersQuery).limit));
  }
  if (typeof (filters as AnomaliesFiltersQuery | undefined)?.offset === "number") {
    params.set("offset", String((filters as AnomaliesFiltersQuery).offset));
  }

  const query = params.toString();
  return query.length > 0 ? `${path}?${query}` : path;
}

function withUploadDashboardGroupOptionsQuery(
  path: string,
  filters?: UploadDashboardFiltersQuery & { tagKey?: string | null },
): string {
  const params = new URLSearchParams();

  if (filters?.rawBillingFileIds && filters.rawBillingFileIds.length > 0) {
    params.set("rawBillingFileIds", filters.rawBillingFileIds.join(","));
  }
  if (filters?.billingPeriodStart) params.set("billingPeriodStart", filters.billingPeriodStart);
  if (filters?.billingPeriodEnd) params.set("billingPeriodEnd", filters.billingPeriodEnd);
  if (filters?.subAccountKey) params.set("subAccountKey", filters.subAccountKey);
  if (filters?.serviceKey) params.set("serviceKey", filters.serviceKey);
  if (filters?.regionKey) params.set("regionKey", filters.regionKey);
  if (filters?.tagKey && filters.tagKey.trim().length > 0) {
    params.set("tagKey", filters.tagKey.trim().toLowerCase());
  }

  const query = params.toString();
  return query.length > 0 ? `${path}?${query}` : path;
}

export const uploadDashboardApi = {
  getOverview(filters?: UploadDashboardFiltersQuery) {
    return apiGet<DashboardOverviewResponse>(withUploadDashboardQuery("/upload-dashboard/overview", filters));
  },

  getCostExplorer(filters?: UploadDashboardFiltersQuery & CostExplorerFiltersQuery) {
    return apiGet<CostExplorerResponse>(withUploadDashboardQuery("/upload-dashboard/cost-explorer", filters));
  },

  getCostExplorerGroupOptions(filters?: UploadDashboardFiltersQuery & { tagKey?: string | null }) {
    return apiGet<CostExplorerGroupOptionsResponse>(
      withUploadDashboardGroupOptionsQuery("/upload-dashboard/cost-explorer/group-options", filters),
    );
  },

  getAnomaliesAlerts(filters?: UploadDashboardFiltersQuery & AnomaliesFiltersQuery) {
    return apiGet<AnomaliesListResponse>(withUploadDashboardQuery("/upload-dashboard/anomalies-alerts", filters));
  },

  getFilters(filters?: UploadDashboardFiltersQuery) {
    return apiGet<UploadDashboardFiltersResponse>(withUploadDashboardQuery("/upload-dashboard/overview/filters", filters));
  },
};

export type { UploadDashboardFiltersQuery } from "./uploadDashboardTypes";
