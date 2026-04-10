import type { UploadDashboardFiltersQuery } from "../api/uploadDashboardApi";

const parseDateValue = (value: string | null): string | undefined => {
  if (!value) return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
};

const parseRawBillingFileIds = (value: string | null): number[] | undefined => {
  if (!value) return undefined;
  const parsed = value
    .split(",")
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isInteger(entry));
  return parsed.length > 0 ? [...new Set(parsed)] : undefined;
};

export function parseUploadDashboardFiltersFromSearch(search: string): UploadDashboardFiltersQuery {
  const params = new URLSearchParams(search);
  const rawBillingFileIds = parseRawBillingFileIds(params.get("rawBillingFileIds"));

  return {
    ...(rawBillingFileIds ? { rawBillingFileIds } : {}),
    ...(parseDateValue(params.get("billingPeriodStart")) ? { billingPeriodStart: parseDateValue(params.get("billingPeriodStart")) } : {}),
    ...(parseDateValue(params.get("billingPeriodEnd")) ? { billingPeriodEnd: parseDateValue(params.get("billingPeriodEnd")) } : {}),
    ...(params.get("subAccountKey") ? { subAccountKey: params.get("subAccountKey") as string } : {}),
    ...(params.get("serviceKey") ? { serviceKey: params.get("serviceKey") as string } : {}),
    ...(params.get("regionKey") ? { regionKey: params.get("regionKey") as string } : {}),
  };
}
