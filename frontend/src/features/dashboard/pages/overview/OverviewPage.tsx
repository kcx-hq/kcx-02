import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useDashboardScope } from "../../hooks/useDashboardScope";
import { useOverviewQuery } from "../../hooks/useDashboardQueries";
import {
  OverviewBreakdownSection,
  OverviewKpiSection,
  OverviewTrendRegionSection,
} from "./components";
import { parseDateValue, parseOptionalInt } from "./utils/overviewFormatters";

const parseOptionalBoolean = (value: string | null): boolean | undefined => {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "on", "enabled", "yes"].includes(normalized)) return true;
  if (["false", "0", "off", "disabled", "no", "none"].includes(normalized)) return false;
  return undefined;
};

export default function OverviewPage() {
  const { scope } = useDashboardScope();
  const location = useLocation();
  const navigate = useNavigate();

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const urlBillingStart = parseDateValue(searchParams.get("billingPeriodStart")) ?? parseDateValue(searchParams.get("from"));
  const urlBillingEnd = parseDateValue(searchParams.get("billingPeriodEnd")) ?? parseDateValue(searchParams.get("to"));
  const selectedAccountKey = parseOptionalInt(searchParams.get("subAccountKey") ?? searchParams.get("billingAccountKey"));
  const selectedServiceKey = parseOptionalInt(searchParams.get("serviceKey"));
  const selectedRegionKey = parseOptionalInt(searchParams.get("regionKey"));
  const forecastingEnabled = parseOptionalBoolean(
    searchParams.get("forecastingEnabled") ??
      searchParams.get("forecasting") ??
      searchParams.get("forecastEnabled") ??
      searchParams.get("forecastFilter") ??
      searchParams.get("forecastingFilter"),
  );

  const billingStart = urlBillingStart ?? scope?.from ?? undefined;
  const billingEnd = urlBillingEnd ?? scope?.to ?? undefined;

  const sharedFilters = useMemo(
    () => ({
      ...(billingStart ? { billingPeriodStart: billingStart } : {}),
      ...(billingEnd ? { billingPeriodEnd: billingEnd } : {}),
      ...(typeof forecastingEnabled === "boolean" ? { forecastingEnabled } : {}),
      ...(selectedAccountKey ? { accountKeys: [selectedAccountKey] } : {}),
      ...(selectedServiceKey ? { serviceKeys: [selectedServiceKey] } : {}),
      ...(selectedRegionKey ? { regionKeys: [selectedRegionKey] } : {}),
    }),
    [billingEnd, billingStart, forecastingEnabled, selectedAccountKey, selectedRegionKey, selectedServiceKey],
  );

  const overviewQuery = useOverviewQuery({
    ...sharedFilters,
    page: 1,
    pageSize: 5,
    sortOrder: "desc",
  });

  const applySearchParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(location.search);
    if (!value) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
  };

  const data = overviewQuery.data;

  return (
    <div className="dashboard-page overview-page">
      {overviewQuery.isLoading ? <p className="dashboard-note">Loading overview insights...</p> : null}
      {overviewQuery.isError ? <p className="dashboard-note">Failed to load overview: {overviewQuery.error.message}</p> : null}

      {data ? <OverviewKpiSection data={data} /> : null}

      <OverviewTrendRegionSection trendData={data?.budgetVsActualForecast ?? []} anomalies={data?.anomaliesPreview.items ?? []} />

      <OverviewBreakdownSection
        topServices={data?.topServices ?? []}
        topAccounts={data?.topAccounts ?? []}
        topRegions={data?.topRegions ?? []}
        selectedServiceKey={selectedServiceKey}
        selectedAccountKey={selectedAccountKey}
        onSelectService={(key) => {
          applySearchParam("serviceKey", key ? String(key) : null);
        }}
        onSelectAccount={(key) => {
          applySearchParam("subAccountKey", key ? String(key) : null);
        }}
      />
    </div>
  );
}
