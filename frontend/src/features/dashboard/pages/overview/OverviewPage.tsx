import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import type { OverviewSortOrder } from "../../api/dashboardApi";
import { useDashboardScope } from "../../hooks/useDashboardScope";
import {
  useOverviewAnomaliesQuery,
  useOverviewQuery,
  useOverviewRecommendationsQuery,
} from "../../hooks/useDashboardQueries";
import {
  OverviewAlertsSection,
  OverviewBreakdownSection,
  OverviewInsightStrip,
  OverviewKpiSection,
  OverviewSavingsSection,
  OverviewTrendRegionSection,
} from "./components";
import { parseDateValue, parseOptionalInt } from "./utils/overviewFormatters";

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

  const [anomaliesPage, setAnomaliesPage] = useState(1);
  const [recommendationsPage, setRecommendationsPage] = useState(1);
  const [tableSortOrder] = useState<OverviewSortOrder>("desc");

  const billingStart = urlBillingStart ?? scope?.from ?? undefined;
  const billingEnd = urlBillingEnd ?? scope?.to ?? undefined;

  const sharedFilters = useMemo(
    () => ({
      ...(billingStart ? { billingPeriodStart: billingStart } : {}),
      ...(billingEnd ? { billingPeriodEnd: billingEnd } : {}),
      ...(selectedAccountKey ? { accountKeys: [selectedAccountKey] } : {}),
      ...(selectedServiceKey ? { serviceKeys: [selectedServiceKey] } : {}),
      ...(selectedRegionKey ? { regionKeys: [selectedRegionKey] } : {}),
    }),
    [billingEnd, billingStart, selectedAccountKey, selectedRegionKey, selectedServiceKey],
  );

  const overviewQuery = useOverviewQuery({
    ...sharedFilters,
    page: 1,
    pageSize: 5,
    sortOrder: "desc",
  });

  const anomaliesQuery = useOverviewAnomaliesQuery({
    ...sharedFilters,
    page: anomaliesPage,
    pageSize: 5,
    sortBy: "anomalyDate",
    sortOrder: tableSortOrder,
  });

  const recommendationsQuery = useOverviewRecommendationsQuery({
    ...sharedFilters,
    page: recommendationsPage,
    pageSize: 5,
    sortBy: "estimatedSavings",
    sortOrder: tableSortOrder,
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

      <OverviewTrendRegionSection trendData={data?.budgetVsActualForecast ?? []} topRegions={data?.topRegions ?? []} />

      <OverviewBreakdownSection
        topServices={data?.topServices ?? []}
        topAccounts={data?.topAccounts ?? []}
        selectedServiceKey={selectedServiceKey}
        selectedAccountKey={selectedAccountKey}
        onSelectService={(key) => {
          applySearchParam("serviceKey", key ? String(key) : null);
          setAnomaliesPage(1);
          setRecommendationsPage(1);
        }}
        onSelectAccount={(key) => {
          applySearchParam("subAccountKey", key ? String(key) : null);
          setAnomaliesPage(1);
          setRecommendationsPage(1);
        }}
      />


      <OverviewAlertsSection
        anomaliesLoading={anomaliesQuery.isLoading}
        anomaliesErrorMessage={anomaliesQuery.isError ? anomaliesQuery.error.message : null}
        anomaliesData={anomaliesQuery.data}
        anomaliesPage={anomaliesPage}
        onAnomaliesPrev={() => setAnomaliesPage((value) => Math.max(1, value - 1))}
        onAnomaliesNext={() =>
          setAnomaliesPage((value) => Math.min(Math.max(1, anomaliesQuery.data?.pagination.totalPages ?? 1), value + 1))
        }
        recommendationsLoading={recommendationsQuery.isLoading}
        recommendationsErrorMessage={recommendationsQuery.isError ? recommendationsQuery.error.message : null}
        recommendationsData={recommendationsQuery.data}
        recommendationsPage={recommendationsPage}
        onRecommendationsPrev={() => setRecommendationsPage((value) => Math.max(1, value - 1))}
        onRecommendationsNext={() =>
          setRecommendationsPage((value) =>
            Math.min(Math.max(1, recommendationsQuery.data?.pagination.totalPages ?? 1), value + 1),
          )
        }
      />

      {data ? <OverviewInsightStrip data={data} /> : null}
    </div>
  );
}
