import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useUploadOverviewQuery } from "../../hooks/useUploadDashboardQueries";
import {
  OverviewBreakdownSection,
  OverviewKpiSection,
  OverviewTrendRegionSection,
} from "./components";
import { parseDateValue, parseOptionalInt } from "./utils/overviewFormatters";

export default function OverviewPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const rawBillingFileIds = searchParams.get("rawBillingFileIds") ?? "";
  const billingStart = parseDateValue(searchParams.get("billingPeriodStart")) ?? undefined;
  const billingEnd = parseDateValue(searchParams.get("billingPeriodEnd")) ?? undefined;
  const selectedAccountKey = parseOptionalInt(searchParams.get("subAccountKey") ?? searchParams.get("billingAccountKey"));
  const selectedServiceKey = parseOptionalInt(searchParams.get("serviceKey"));
  const selectedRegionKey = parseOptionalInt(searchParams.get("regionKey"));

  const query = useUploadOverviewQuery({
    rawBillingFileIds: rawBillingFileIds
      .split(",")
      .map((entry) => Number(entry.trim()))
      .filter((entry) => Number.isInteger(entry)),
    ...(billingStart ? { billingPeriodStart: billingStart } : {}),
    ...(billingEnd ? { billingPeriodEnd: billingEnd } : {}),
    ...(selectedAccountKey ? { subAccountKey: String(selectedAccountKey) } : {}),
    ...(selectedServiceKey ? { serviceKey: String(selectedServiceKey) } : {}),
    ...(selectedRegionKey ? { regionKey: String(selectedRegionKey) } : {}),
  });

  const applySearchParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(location.search);
    if (!value) params.delete(key);
    else params.set(key, value);
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
  };

  const data = query.data as any;

  return (
    <div className="dashboard-page overview-page">
      {query.isLoading ? <p className="dashboard-note">Loading overview insights...</p> : null}
      {query.isError ? <p className="dashboard-note">Failed to load overview: {query.error.message}</p> : null}

      {data ? <OverviewKpiSection data={data} /> : null}

      <OverviewTrendRegionSection trendData={data?.budgetVsActualForecast ?? []} anomalies={data?.anomaliesPreview?.items ?? []} />

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
