import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { useInventoryLoadBalancers } from "@/features/client-home/hooks/useInventoryLoadBalancers";
import { BaseEChart } from "@/features/dashboard/common/charts/BaseEChart";
import { EmptyStateBlock } from "@/features/dashboard/common/components/EmptyStateBlock";
import { KpiCard } from "@/features/dashboard/common/components/KpiCard";
import {
  useLoadBalancerExplorerSummaryQuery,
  useLoadBalancerExplorerTrendQuery,
} from "@/features/dashboard/hooks/useDashboardQueries";
import { useDashboardScope } from "@/features/dashboard/hooks/useDashboardScope";
import { StickySectionNav } from "../ec2/components/EC2InstanceDetailDecisionLayout";

const LIST_PATH = "/dashboard/inventory/aws/load-balancer/list";

const CURRENCY_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const DECIMAL_FORMATTER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

const toTitle = (value: string | null | undefined): string => {
  if (!value) return "-";
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || typeof value === "undefined" || !Number.isFinite(value)) return "$0.00";
  return CURRENCY_FORMATTER.format(value);
};

const formatNumber = (value: number | null | undefined): string => {
  if (value === null || typeof value === "undefined" || !Number.isFinite(value)) return "0";
  return DECIMAL_FORMATTER.format(value);
};

const DEFAULT_TREND_OPTION: EChartsOption = {
  tooltip: { trigger: "axis", confine: true },
  grid: { left: 58, right: 14, top: 40, bottom: 34, containLabel: true },
  xAxis: {
    type: "category",
    boundaryGap: false,
    data: [],
    axisLabel: { hideOverlap: true, fontSize: 11 },
  },
  yAxis: {
    type: "value",
    name: "Cost (USD)",
    nameLocation: "end",
    nameGap: 24,
    nameTextStyle: { fontSize: 11, color: "#6d837e" },
    axisLabel: { fontSize: 11, margin: 10 },
  },
  series: [],
};

export default function LoadBalancerDetailPage() {
  const { loadBalancerId } = useParams<{ loadBalancerId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { scope } = useDashboardScope();

  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const startDate =
    scope?.from ??
    queryParams.get("startDate") ??
    queryParams.get("from") ??
    queryParams.get("billingPeriodStart") ??
    undefined;
  const endDate =
    scope?.to ??
    queryParams.get("endDate") ??
    queryParams.get("to") ??
    queryParams.get("billingPeriodEnd") ??
    undefined;
  const loadBalancerName = queryParams.get("loadBalancerName") ?? "";

  const listQuery = useInventoryLoadBalancers({
    startDate,
    endDate,
    search: loadBalancerName || loadBalancerId || null,
    page: 1,
    pageSize: 200,
  });

  const selected = useMemo(() => {
    const rows = listQuery.data?.items ?? [];
    if (!loadBalancerId) return rows[0] ?? null;
    const byId = rows.find((row) => row.id === loadBalancerId);
    if (byId) return byId;
    const decoded = decodeURIComponent(loadBalancerId);
    return rows.find((row) => row.id === decoded || row.arn === decoded || row.name === decoded) ?? null;
  }, [listQuery.data?.items, loadBalancerId]);

  const detailFilters = useMemo(
    () => ({
      startDate,
      endDate,
      metric: "cost" as const,
      granularity: "daily" as const,
      groupBy: "load_balancer" as const,
      groupValues: selected ? [selected.name] : loadBalancerName ? [loadBalancerName] : undefined,
      accountId: selected?.accountId ?? undefined,
      regions: selected?.region ? [selected.region] : undefined,
      types: selected?.type ? [selected.type] : undefined,
      schemes: selected?.scheme ? [selected.scheme] : undefined,
      states: selected?.state ? [selected.state] : undefined,
      teams: selected?.team ? [selected.team] : undefined,
      products: selected?.product ? [selected.product] : undefined,
      environments: selected?.environment ? [selected.environment] : undefined,
    }),
    [endDate, loadBalancerName, selected, startDate],
  );

  const summaryQuery = useLoadBalancerExplorerSummaryQuery(detailFilters, Boolean(scope) && Boolean(selected || loadBalancerName));
  const trendQuery = useLoadBalancerExplorerTrendQuery(detailFilters, Boolean(scope) && Boolean(selected || loadBalancerName));

  const trendOption = useMemo<EChartsOption>(() => {
    const graph = trendQuery.data?.graph;
    if (!graph || graph.series.length === 0) return DEFAULT_TREND_OPTION;
    const labels = graph.series[0]?.data.map((entry) => entry.date) ?? [];
    return {
      tooltip: { trigger: "axis", confine: true },
      legend: {
        show: true,
        type: "scroll",
        orient: "horizontal",
        top: 2,
        left: 58,
        right: 14,
        itemWidth: 12,
        itemHeight: 8,
        textStyle: { fontSize: 11 },
      },
      grid: { left: 58, right: 14, top: 68, bottom: 34, containLabel: true },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: labels,
        axisLabel: { hideOverlap: true, fontSize: 11 },
      },
      yAxis: {
        type: "value",
        name: "Cost (USD)",
        nameLocation: "end",
        nameGap: 24,
        nameTextStyle: { fontSize: 11, color: "#6d837e" },
        axisLabel: { fontSize: 11, margin: 10 },
      },
      series: graph.series.map((series) => ({
        name: series.label,
        type: "line",
        smooth: 0.42,
        showSymbol: false,
        emphasis: { focus: "series", scale: true },
        symbol: "circle",
        symbolSize: 6,
        lineStyle: { width: 2.3 },
        data: series.data.map((point) => point.value),
      })),
    };
  }, [trendQuery.data?.graph]);

  const tags = selected?.tags ?? {};
  const tagRows = useMemo(
    () => Object.entries(tags).map(([key, value]) => ({ key, value: String(value) })),
    [tags],
  );

  const backToList = () => {
    navigate({ pathname: LIST_PATH, search: location.search });
  };

  if (listQuery.isLoading) {
    return (
      <div className="dashboard-page">
        <p className="dashboard-note">Loading load balancer details...</p>
      </div>
    );
  }

  if (listQuery.isError || !selected) {
    return (
      <div className="dashboard-page">
        <EmptyStateBlock
          title="Unable to load load balancer details"
          message={listQuery.isError ? listQuery.error.message : "Load balancer not found for selected filters."}
          actions={
            <button type="button" className="cost-explorer-state-btn" onClick={backToList}>
              Back to Load Balancers
            </button>
          }
        />
      </div>
    );
  }

  const summary = summaryQuery.data?.summary;
  const totalCost = summary?.totalCost ?? selected.totalCost;
  const fixedCost = summary?.fixedCost ?? selected.fixedCost;
  const lcuCost = summary?.lcuCost ?? selected.lcuCost;
  const dataProcessingCost = summary?.dataProcessingCost ?? selected.dataProcessingCost;

  return (
    <div className="dashboard-page">
      <section className="ec2-instance-detail" aria-label="Load balancer detail">
        <div className="ec2-instance-detail__layout">
          <div className="ec2-instance-detail__content">
            <section id="overview" className="ec2-instance-detail__panel">
              <h3>Overview</h3>
              <section className="overview-kpi-strip overview-kpi-board ec2-instance-detail__kpi-board">
                <div className="overview-kpi-row overview-kpi-row--report ec2-overview-kpi-row">
                  <KpiCard label="Name" value={selected.name || "-"} />
                  <KpiCard label="Type" value={toTitle(selected.type)} />
                  <KpiCard label="Scheme" value={toTitle(selected.scheme)} />
                  <KpiCard label="State" value={toTitle(selected.state)} />
                  <KpiCard label="Region" value={selected.region ?? "-"} />
                </div>
              </section>
              <table className="ec2-instance-detail__simple-table">
                <tbody>
                  <tr><td>Name</td><td><strong>{selected.name || "-"}</strong></td></tr>
                  <tr><td>ARN</td><td><strong>{selected.arn ?? "-"}</strong></td></tr>
                  <tr><td>Type</td><td><strong>{toTitle(selected.type)}</strong></td></tr>
                  <tr><td>Scheme</td><td><strong>{toTitle(selected.scheme)}</strong></td></tr>
                  <tr><td>State</td><td><strong>{toTitle(selected.state)}</strong></td></tr>
                  <tr><td>Region</td><td><strong>{selected.region ?? "-"}</strong></td></tr>
                  <tr><td>VPC</td><td><strong>{typeof tags.vpcId === "string" ? tags.vpcId : "-"}</strong></td></tr>
                  <tr><td>DNS Name</td><td><strong>{typeof tags.dnsName === "string" ? tags.dnsName : "-"}</strong></td></tr>
                </tbody>
              </table>
            </section>

            <section id="cost-summary" className="ec2-instance-detail__panel">
              <h3>Cost Summary</h3>
              <div className="ec2-instance-detail__kpis ec2-instance-detail__kpis--compact">
                <div className="ec2-instance-detail__kpi"><span>Total Cost</span><strong>{formatCurrency(totalCost)}</strong></div>
                <div className="ec2-instance-detail__kpi"><span>Fixed Cost</span><strong>{formatCurrency(fixedCost)}</strong></div>
                <div className="ec2-instance-detail__kpi"><span>LCU Cost</span><strong>{formatCurrency(lcuCost)}</strong></div>
                <div className="ec2-instance-detail__kpi"><span>Data Processing Cost</span><strong>{formatCurrency(dataProcessingCost)}</strong></div>
              </div>
              <div className="ec2-instance-detail__summary-line">
                <span>
                  Cost trend: <strong>{formatNumber(summary?.trendPercent ?? 0)}%</strong>
                </span>
              </div>
            </section>

            <section id="cost-trend" className="ec2-instance-detail__panel">
              <h3>Cost Trend</h3>
              {trendQuery.isLoading ? <p className="dashboard-note">Loading cost trend...</p> : null}
              {trendQuery.isError ? (
                <EmptyStateBlock
                  title="Unable to load cost trend"
                  message={trendQuery.error.message || "An unexpected error occurred."}
                  actions={
                    <button type="button" className="cost-explorer-state-btn" onClick={() => void trendQuery.refetch()}>
                      Retry
                    </button>
                  }
                />
              ) : null}
              {!trendQuery.isLoading && !trendQuery.isError ? (
                trendQuery.data?.graph?.series?.length ? (
                  <BaseEChart option={trendOption} height={280} />
                ) : (
                  <p className="dashboard-note">No trend data for selected range.</p>
                )
              ) : null}
            </section>

            <section id="metadata" className="ec2-instance-detail__panel">
              <h3>Metadata</h3>
              <div className="ec2-instance-detail__meta-grid">
                <div><span>Name</span><strong>{selected.name || "-"}</strong></div>
                <div><span>ARN</span><strong>{selected.arn ?? "-"}</strong></div>
                <div><span>Account</span><strong>{selected.accountId ?? "-"}</strong></div>
                <div><span>Region</span><strong>{selected.region ?? "-"}</strong></div>
                <div><span>Team</span><strong>{selected.team ?? "-"}</strong></div>
                <div><span>Product</span><strong>{selected.product ?? "-"}</strong></div>
                <div><span>Environment</span><strong>{selected.environment ?? "-"}</strong></div>
                <div><span>Type</span><strong>{toTitle(selected.type)}</strong></div>
                <div><span>Scheme</span><strong>{toTitle(selected.scheme)}</strong></div>
                <div><span>State</span><strong>{toTitle(selected.state)}</strong></div>
              </div>
            </section>

            <section id="tags" className="ec2-instance-detail__panel">
              <h3>Tags</h3>
              <table className="ec2-instance-detail__simple-table">
                <thead><tr><th>Tag</th><th>Value</th></tr></thead>
                <tbody>
                  {tagRows.length === 0 ? <tr><td colSpan={2}>No tags available</td></tr> : null}
                  {tagRows.map((row) => <tr key={row.key}><td>{row.key}</td><td>{row.value}</td></tr>)}
                </tbody>
              </table>
            </section>
          </div>

          <StickySectionNav
            sections={[
              { id: "overview", label: "Overview" },
              { id: "cost-summary", label: "Cost Summary" },
              { id: "cost-trend", label: "Cost Trend" },
              { id: "metadata", label: "Metadata" },
              { id: "tags", label: "Tags" },
            ]}
            onNavigate={(id) => {
              const section = document.getElementById(id);
              if (!section) return;
              section.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          />
        </div>
      </section>
    </div>
  );
}
