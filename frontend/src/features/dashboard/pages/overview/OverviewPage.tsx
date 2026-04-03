import { useMemo, useState } from "react";
import type { ColDef } from "ag-grid-community";
import type { EChartsOption } from "echarts";
import { AlertTriangle, Lightbulb } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import type {
  CostBreakdownItem,
  OverviewAnomaly,
  OverviewRecommendation,
  OverviewSortOrder,
} from "../../api/dashboardApi";
import { useDashboardScope } from "../../hooks/useDashboardScope";
import {
  useOverviewAnomaliesQuery,
  useOverviewQuery,
  useOverviewRecommendationsQuery,
} from "../../hooks/useDashboardQueries";
import { BaseEChart } from "../../common/charts/BaseEChart";
import { DonutChart } from "../../common/charts/DonutChart";
import { KpiCard, MetricBadge, PageSection, WidgetShell } from "../../common/components";
import { BaseDataTable, currencyFormatter } from "../../common/tables/BaseDataTable";
import { TableShell } from "../../common/tables/TableShell";

const currencyFormatterCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});

const currencyFormatterPrecise = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const parseOptionalInt = (value: string | null): number | null => {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

const parseDateValue = (value: string | null): string | null => {
  if (!value) {
    return null;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
};

const getMonthLabel = (value: string): string => {
  const [year, month] = value.split("-");
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
};

const toSeverityTone = (severity: string): "positive" | "negative" | "accent" | "neutral" => {
  const normalized = severity.toLowerCase();
  if (normalized === "high") return "negative";
  if (normalized === "medium") return "accent";
  if (normalized === "low") return "positive";
  return "neutral";
};

const getStatusTone = (status: string): "positive" | "negative" | "accent" | "neutral" => {
  const normalized = status.toLowerCase();
  if (normalized === "open") return "negative";
  if (normalized === "accepted" || normalized === "completed" || normalized === "resolved") return "positive";
  if (normalized === "ignored" || normalized === "dismissed") return "neutral";
  return "accent";
};

const buildTrendOption = (
  points: Array<{ month: string; budget: number; actual: number; forecast: number }>,
): EChartsOption => ({
  color: ["#3f6ed7", "#1f8b7a", "#ca8b17"],
  tooltip: {
    trigger: "axis",
    valueFormatter: (value) => currencyFormatterPrecise.format(Number(value ?? 0)),
  },
  legend: {
    top: 0,
    icon: "roundRect",
    textStyle: { color: "#5c7370", fontSize: 11 },
    itemHeight: 6,
    itemWidth: 16,
  },
  xAxis: {
    type: "category",
    boundaryGap: false,
    data: points.map((point) => getMonthLabel(point.month)),
    axisLine: { lineStyle: { color: "#d7e4df" } },
    axisLabel: { color: "#5c7370", fontSize: 11 },
  },
  yAxis: {
    type: "value",
    splitLine: { lineStyle: { color: "#e5efec" } },
    axisLabel: {
      color: "#6d837e",
      fontSize: 11,
      formatter: (value: number) => currencyFormatterCompact.format(value),
    },
  },
  series: [
    {
      name: "Budget",
      type: "line",
      smooth: true,
      data: points.map((point) => point.budget),
      symbolSize: 6,
      lineStyle: { width: 2.2 },
    },
    {
      name: "Actual",
      type: "line",
      smooth: true,
      data: points.map((point) => point.actual),
      symbolSize: 6,
      lineStyle: { width: 2.2 },
      areaStyle: {
        color: {
          type: "linear",
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: "rgba(31, 139, 122, 0.22)" },
            { offset: 1, color: "rgba(31, 139, 122, 0.02)" },
          ],
        },
      },
    },
    {
      name: "Forecast",
      type: "line",
      smooth: true,
      data: points.map((point) => point.forecast),
      symbolSize: 6,
      lineStyle: { width: 2.2, type: "dashed" },
    },
  ],
});

type BreakdownListProps = {
  title: string;
  subtitle: string;
  items: CostBreakdownItem[];
  selectedKey: number | null;
  onSelect: (key: number | null) => void;
};

function BreakdownList({ title, subtitle, items, selectedKey, onSelect }: BreakdownListProps) {
  const max = items.reduce((highest, item) => Math.max(highest, item.billedCost), 0);

  return (
    <WidgetShell title={title} subtitle={subtitle}>
      <div className="overview-breakdown-list">
        {items.slice(0, 7).map((item) => {
          const ratio = max > 0 ? (item.billedCost / max) * 100 : 0;
          const isActive = item.key !== null && selectedKey === item.key;
          return (
            <button
              key={`${title}-${item.key ?? item.name}`}
              type="button"
              className={`overview-breakdown-item${isActive ? " is-active" : ""}`}
              onClick={() => onSelect(isActive ? null : item.key)}
            >
              <div className="overview-breakdown-item__head">
                <span className="overview-breakdown-item__label">{item.name}</span>
                <span className="overview-breakdown-item__value">{currencyFormatterCompact.format(item.billedCost)}</span>
              </div>
              <div className="overview-breakdown-item__track">
                <span className="overview-breakdown-item__bar" style={{ width: `${Math.max(ratio, 3)}%` }} />
              </div>
              <div className="overview-breakdown-item__meta">
                <MetricBadge tone="accent">{percentFormatter.format(item.contributionPct)}%</MetricBadge>
              </div>
            </button>
          );
        })}
      </div>
    </WidgetShell>
  );
}

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

  const overviewFilters = useMemo(
    () => ({
      ...(billingStart ? { billingPeriodStart: billingStart } : {}),
      ...(billingEnd ? { billingPeriodEnd: billingEnd } : {}),
      ...(selectedAccountKey ? { accountKeys: [selectedAccountKey] } : {}),
      ...(selectedServiceKey ? { serviceKeys: [selectedServiceKey] } : {}),
      ...(selectedRegionKey ? { regionKeys: [selectedRegionKey] } : {}),
      page: 1,
      pageSize: 5,
      sortOrder: "desc" as const,
    }),
    [billingEnd, billingStart, selectedAccountKey, selectedRegionKey, selectedServiceKey],
  );

  const overviewQuery = useOverviewQuery(overviewFilters);
  const anomaliesQuery = useOverviewAnomaliesQuery({
    ...(billingStart ? { billingPeriodStart: billingStart } : {}),
    ...(billingEnd ? { billingPeriodEnd: billingEnd } : {}),
    ...(selectedAccountKey ? { accountKeys: [selectedAccountKey] } : {}),
    ...(selectedServiceKey ? { serviceKeys: [selectedServiceKey] } : {}),
    ...(selectedRegionKey ? { regionKeys: [selectedRegionKey] } : {}),
    page: anomaliesPage,
    pageSize: 5,
    sortBy: "anomalyDate",
    sortOrder: tableSortOrder,
  });
  const recommendationsQuery = useOverviewRecommendationsQuery({
    ...(billingStart ? { billingPeriodStart: billingStart } : {}),
    ...(billingEnd ? { billingPeriodEnd: billingEnd } : {}),
    ...(selectedAccountKey ? { accountKeys: [selectedAccountKey] } : {}),
    ...(selectedServiceKey ? { serviceKeys: [selectedServiceKey] } : {}),
    ...(selectedRegionKey ? { regionKeys: [selectedRegionKey] } : {}),
    page: recommendationsPage,
    pageSize: 5,
    sortBy: "estimatedSavings",
    sortOrder: tableSortOrder,
  });

  const data = overviewQuery.data;

  const anomalyColumns = useMemo<ColDef<OverviewAnomaly>[]>(
    () => [
      { headerName: "Date", field: "anomalyDate", minWidth: 120 },
      { headerName: "Service", field: "serviceName", minWidth: 140 },
      { headerName: "Region", field: "regionName", minWidth: 130 },
      { headerName: "Cost Impact", field: "costImpact", valueFormatter: currencyFormatter, minWidth: 130 },
      {
        headerName: "Severity",
        field: "severity",
        minWidth: 120,
        cellRenderer: (params: { value: string }) => (
          <span className={`overview-chip overview-chip--${params.value?.toLowerCase?.() ?? "neutral"}`}>
            {params.value ?? "unknown"}
          </span>
        ),
      },
      {
        headerName: "Status",
        field: "status",
        minWidth: 110,
        cellRenderer: (params: { value: string }) => (
          <span className={`overview-chip overview-chip--status-${params.value?.toLowerCase?.() ?? "neutral"}`}>
            {params.value ?? "unknown"}
          </span>
        ),
      },
    ],
    [],
  );

  const recommendationColumns = useMemo<ColDef<OverviewRecommendation>[]>(
    () => [
      { headerName: "Type", field: "recommendationType", minWidth: 140 },
      { headerName: "Service", field: "serviceName", minWidth: 130 },
      { headerName: "Savings", field: "estimatedSavings", valueFormatter: currencyFormatter, minWidth: 130 },
      { headerName: "Risk", field: "riskLevel", minWidth: 110 },
      { headerName: "Status", field: "status", minWidth: 110 },
      {
        headerName: "Actions",
        field: "actions",
        minWidth: 180,
        cellRenderer: (params: { data?: OverviewRecommendation }) => {
          const recommendation = params.data;
          if (!recommendation) return null;
          return (
            <div className="overview-actions-cell">
              <span className={`overview-action${recommendation.actions.viewEnabled ? "" : " is-disabled"}`}>View</span>
              <span className={`overview-action${recommendation.actions.applyEnabled ? "" : " is-disabled"}`}>Apply</span>
            </div>
          );
        },
      },
    ],
    [],
  );

  const applySearchParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(location.search);
    if (!value) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
  };

  const trendOption = useMemo(() => buildTrendOption(data?.budgetVsActualForecast ?? []), [data?.budgetVsActualForecast]);
  const trendHasData = Boolean(data?.budgetVsActualForecast?.length);

  return (
    <div className="dashboard-page overview-page">
      {overviewQuery.isLoading ? <p className="dashboard-note">Loading overview insights...</p> : null}
      {overviewQuery.isError ? <p className="dashboard-note">Failed to load overview: {overviewQuery.error.message}</p> : null}
      {data ? (
        <section className="overview-kpi-strip overview-kpi-board">
          <div className="overview-kpi-row overview-kpi-row--report">
            <KpiCard
              label="Total Spend"
              value={currencyFormatterPrecise.format(data.kpis.totalSpend)}
              delta={`${percentFormatter.format(
                data.kpis.previousPeriodSpend > 0
                  ? ((data.kpis.totalSpend - data.kpis.previousPeriodSpend) / data.kpis.previousPeriodSpend) * 100
                  : 0,
              )}% vs previous`}
              deltaTone={data.kpis.totalSpend > data.kpis.previousPeriodSpend ? "negative" : "positive"}
              meta="Current billing period"
            />
            <KpiCard
              label="Previous Period Spend"
              value={currencyFormatterPrecise.format(data.kpis.previousPeriodSpend)}
              delta="Baseline window"
              deltaTone="neutral"
              meta="Equivalent prior range"
            />
            <KpiCard
              label="Savings Achieved"
              value={currencyFormatterPrecise.format(data.kpis.savingsAchieved)}
              delta={`${percentFormatter.format(data.savingsInsights.savingsPct)}% savings`}
              deltaTone="positive"
              meta="List cost vs effective cost"
            />
            <KpiCard
              label="Top Region"
              value={data.kpis.topRegion?.name ?? "N/A"}
              delta={data.kpis.topRegion ? `${percentFormatter.format(data.kpis.topRegion.contributionPct)}% share` : "No data"}
              deltaTone="accent"
              meta={data.kpis.topRegion ? currencyFormatterCompact.format(data.kpis.topRegion.billedCost) : "No spend"}
            />
            <KpiCard
              label="Top Account"
              value={data.kpis.topAccount?.name ?? "N/A"}
              delta={data.kpis.topAccount ? `${percentFormatter.format(data.kpis.topAccount.contributionPct)}% share` : "No data"}
              deltaTone="accent"
              meta={data.kpis.topAccount ? currencyFormatterCompact.format(data.kpis.topAccount.billedCost) : "No spend"}
            />
            <KpiCard
              label="Active Alerts"
              value={String(data.kpis.activeAlerts)}
              delta={`${data.kpis.highSeverityAnomalyCount} high severity`}
              deltaTone={data.kpis.highSeverityAnomalyCount > 0 ? "negative" : "positive"}
              meta="Open anomalies + recommendations"
            />
          </div>
        </section>
      ) : null}

      <PageSection title="Budget vs Actual vs Forecast" description="Monthly trend for budget governance and variance control.">
        {trendHasData ? (
          <div className="overview-trend">
            <BaseEChart option={trendOption} height={290} />
          </div>
        ) : (
          <p className="dashboard-note">No trend data available for current filters.</p>
        )}
      </PageSection>

      <PageSection
        title="Breakdown"
        description="Top services, accounts, and regions by billed cost. Click a service row to filter the dashboard."
      >
        <div className="dashboard-showcase-grid dashboard-showcase-grid--charts">
          <BreakdownList
            title="Top Services"
            subtitle="Horizontal spend distribution"
            items={data?.topServices ?? []}
            selectedKey={selectedServiceKey}
            onSelect={(key) => {
              applySearchParam("serviceKey", key ? String(key) : null);
              setAnomaliesPage(1);
              setRecommendationsPage(1);
            }}
          />
          <BreakdownList
            title="Top Accounts"
            subtitle="Largest sub-account contributors"
            items={data?.topAccounts ?? []}
            selectedKey={selectedAccountKey}
            onSelect={(key) => {
              applySearchParam("subAccountKey", key ? String(key) : null);
              setAnomaliesPage(1);
              setRecommendationsPage(1);
            }}
          />
          <WidgetShell title="Top Regions" subtitle="Contribution by region (donut)">
            <DonutChart
              height={250}
              data={(data?.topRegions ?? []).map((region) => ({
                name: region.name,
                value: region.billedCost,
              }))}
            />
          </WidgetShell>
        </div>
      </PageSection>

      <PageSection title="Savings Insights" description="Savings quality from list-to-effective cost and optimization posture.">
        {data ? (
          <article className="overview-savings-hero">
            <div className="overview-savings-hero__stats">
              <div className="overview-savings-hero__stat">
                <span className="overview-savings-hero__label">List Cost</span>
                <strong className="overview-savings-hero__value">{currencyFormatterPrecise.format(data.savingsInsights.listCost)}</strong>
              </div>
              <div className="overview-savings-hero__stat">
                <span className="overview-savings-hero__label">Effective Cost</span>
                <strong className="overview-savings-hero__value">
                  {currencyFormatterPrecise.format(data.savingsInsights.effectiveCost)}
                </strong>
              </div>
              <div className="overview-savings-hero__stat">
                <span className="overview-savings-hero__label">Absolute Savings</span>
                <strong className="overview-savings-hero__value">
                  {currencyFormatterPrecise.format(data.savingsInsights.absoluteSavings)}
                </strong>
              </div>
              <div className="overview-savings-hero__stat">
                <span className="overview-savings-hero__label">Savings %</span>
                <strong className="overview-savings-hero__value">{percentFormatter.format(data.savingsInsights.savingsPct)}%</strong>
              </div>
            </div>
            <p className="overview-savings-hero__insight">
              <Lightbulb size={16} />
              <span>{data.savingsInsights.insightText}</span>
            </p>
          </article>
        ) : (
          <p className="dashboard-note">Savings insights will appear after overview data loads.</p>
        )}
      </PageSection>

      <PageSection title="Alerts & Recommendations" description="Active anomalies and recommendations with severity, effort, risk, and actions.">
        <div className="dashboard-showcase-grid dashboard-showcase-grid--tables">
          <TableShell
            title="Active Anomalies"
            subtitle={
              anomaliesQuery.data
                ? `${anomaliesQuery.data.summary.activeCount} active, ${anomaliesQuery.data.summary.highSeverityCount} high severity`
                : "Recent anomalies in selected scope"
            }
            actions={<MetricBadge tone="negative">High Severity Explicit</MetricBadge>}
          >
            {anomaliesQuery.isLoading ? <p className="dashboard-note">Loading anomalies...</p> : null}
            {anomaliesQuery.isError ? <p className="dashboard-note">Failed to load anomalies: {anomaliesQuery.error.message}</p> : null}
            {anomaliesQuery.data ? (
              <>
                <BaseDataTable
                  columnDefs={anomalyColumns}
                  rowData={anomaliesQuery.data.items}
                  height={250}
                  emptyMessage="No anomalies for current filters."
                />
                <div className="overview-pagination">
                  <button
                    type="button"
                    className="overview-pagination__btn"
                    disabled={anomaliesPage <= 1}
                    onClick={() => setAnomaliesPage((value) => Math.max(1, value - 1))}
                  >
                    Previous
                  </button>
                  <span className="overview-pagination__meta">
                    Page {anomaliesQuery.data.pagination.page} /{" "}
                    {Math.max(1, anomaliesQuery.data.pagination.totalPages)}
                  </span>
                  <button
                    type="button"
                    className="overview-pagination__btn"
                    disabled={anomaliesPage >= Math.max(1, anomaliesQuery.data.pagination.totalPages)}
                    onClick={() =>
                      setAnomaliesPage((value) =>
                        Math.min(Math.max(1, anomaliesQuery.data?.pagination.totalPages ?? 1), value + 1),
                      )
                    }
                  >
                    Next
                  </button>
                </div>
              </>
            ) : null}
          </TableShell>

          <TableShell
            title="Recommendations"
            subtitle={
              recommendationsQuery.data
                ? `${recommendationsQuery.data.summary.activeCount} active, ${currencyFormatterCompact.format(
                    recommendationsQuery.data.summary.estimatedSavingsTotal,
                  )} estimated savings`
                : "Optimization opportunities in selected scope"
            }
            actions={
              <MetricBadge tone="accent">
                <AlertTriangle size={12} />
                Action Matrix
              </MetricBadge>
            }
          >
            {recommendationsQuery.isLoading ? <p className="dashboard-note">Loading recommendations...</p> : null}
            {recommendationsQuery.isError ? (
              <p className="dashboard-note">Failed to load recommendations: {recommendationsQuery.error.message}</p>
            ) : null}
            {recommendationsQuery.data ? (
              <>
                <BaseDataTable
                  columnDefs={recommendationColumns}
                  rowData={recommendationsQuery.data.items}
                  height={250}
                  emptyMessage="No recommendations for current filters."
                />
                <div className="overview-pagination">
                  <button
                    type="button"
                    className="overview-pagination__btn"
                    disabled={recommendationsPage <= 1}
                    onClick={() => setRecommendationsPage((value) => Math.max(1, value - 1))}
                  >
                    Previous
                  </button>
                  <span className="overview-pagination__meta">
                    Page {recommendationsQuery.data.pagination.page} /{" "}
                    {Math.max(1, recommendationsQuery.data.pagination.totalPages)}
                  </span>
                  <button
                    type="button"
                    className="overview-pagination__btn"
                    disabled={recommendationsPage >= Math.max(1, recommendationsQuery.data.pagination.totalPages)}
                    onClick={() =>
                      setRecommendationsPage((value) =>
                        Math.min(Math.max(1, recommendationsQuery.data?.pagination.totalPages ?? 1), value + 1),
                      )
                    }
                  >
                    Next
                  </button>
                </div>
              </>
            ) : null}
          </TableShell>
        </div>
      </PageSection>

      {data ? (
        <section className="overview-insight-strip">
          <MetricBadge tone={toSeverityTone(data.kpis.highSeverityAnomalyCount > 0 ? "high" : "low")}>
            High severity anomalies: {data.kpis.highSeverityAnomalyCount}
          </MetricBadge>
          <MetricBadge tone={getStatusTone(data.kpis.activeAlerts > 0 ? "open" : "resolved")}>
            Active alerts: {data.kpis.activeAlerts}
          </MetricBadge>
          <MetricBadge tone="accent">
            Savings posture: {percentFormatter.format(data.savingsInsights.savingsPct)}%
          </MetricBadge>
        </section>
      ) : null}
    </div>
  );
}
