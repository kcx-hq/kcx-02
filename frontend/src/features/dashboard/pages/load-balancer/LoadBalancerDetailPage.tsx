import { useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { BaseEChart } from "@/features/dashboard/common/charts/BaseEChart";
import { EmptyStateBlock } from "@/features/dashboard/common/components/EmptyStateBlock";
import { KpiCard } from "@/features/dashboard/common/components/KpiCard";
import {
  useLoadBalancerExplorerSummaryQuery,
  useLoadBalancerExplorerTrendQuery,
} from "@/features/dashboard/hooks/useDashboardQueries";
import { useDashboardScope } from "@/features/dashboard/hooks/useDashboardScope";
import {
  LOAD_BALANCER_USAGE_TYPE_OPTIONS,
  type LoadBalancerExplorerControlsState,
} from "@/features/dashboard/pages/load-balancer/loadBalancerExplorer.types";
import { StickySectionNav } from "../ec2/components/EC2InstanceDetailDecisionLayout";
import { useInventoryLoadBalancerDetail } from "@/features/client-home/hooks/useInventoryLoadBalancers";

const LIST_PATH = "/dashboard/inventory/aws/load-balancer/list";

const CURRENCY_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const NUMBER_FORMATTER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const INTEGER_FORMATTER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

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

const formatDateTime = (value: string | null | undefined): string => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return DATE_TIME_FORMATTER.format(date);
};

const formatInteger = (value: number | null | undefined): string => {
  if (value === null || typeof value === "undefined" || !Number.isFinite(value)) return "0";
  return INTEGER_FORMATTER.format(Math.trunc(value));
};

const formatProcessedGb = (value: number | null | undefined): string => {
  if (value === null || typeof value === "undefined" || !Number.isFinite(value)) return "0 GB";
  return `${NUMBER_FORMATTER.format(value)} GB`;
};

const deriveNameFromArn = (arn: string | null | undefined): string | null => {
  const value = String(arn ?? "").trim();
  if (!value) return null;
  const marker = "/loadbalancer/";
  const normalized = value.includes(marker) ? value.split(marker).at(-1) ?? value : value.split(":").at(-1) ?? value;
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length >= 2) return parts[1];
  return parts.at(-1) ?? null;
};

const safeDecode = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const toNumber = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const healthStatusFromCounts = (
  healthyTargets: number | null | undefined,
  unhealthyTargets: number | null | undefined,
): { label: "Healthy" | "Warning" | "Unhealthy"; tone: "healthy" | "warning" | "unhealthy" } => {
  const healthy = Math.max(0, Math.trunc(toNumber(healthyTargets)));
  const unhealthy = Math.max(0, Math.trunc(toNumber(unhealthyTargets)));
  if (unhealthy > 0 && healthy === 0) return { label: "Unhealthy", tone: "unhealthy" };
  if (unhealthy > 0) return { label: "Warning", tone: "warning" };
  return { label: "Healthy", tone: "healthy" };
};

const usageAxisLabel = (usageType: LoadBalancerExplorerControlsState["usageType"]): string => {
  if (usageType === "processed_gb") return "GB";
  if (usageType === "active_connections" || usageType === "new_connections") return "Connections";
  if (usageType === "healthy_hosts" || usageType === "unhealthy_hosts") return "Hosts";
  if (usageType === "errors") return "Errors";
  return "Requests";
};

const usagePointValue = (
  point: Record<string, unknown>,
  usageType: LoadBalancerExplorerControlsState["usageType"],
): number => {
  if (usageType === "processed_gb") return toNumber(point.processedGB ?? point.processed_gb ?? point.value);
  if (usageType === "active_connections") return toNumber(point.activeConnections ?? point.active_connections ?? point.value);
  if (usageType === "new_connections") return toNumber(point.newConnections ?? point.new_connections ?? point.value);
  if (usageType === "healthy_hosts") return toNumber(point.healthyHosts ?? point.healthy_hosts ?? point.value);
  if (usageType === "unhealthy_hosts") return toNumber(point.unhealthyHosts ?? point.unhealthy_hosts ?? point.value);
  if (usageType === "errors") return toNumber(point.errorCount ?? point.error_count ?? point.value);
  return toNumber(point.requestCount ?? point.request_count ?? point.value);
};

const toDefaultActionsText = (value: unknown[] | Record<string, unknown> | null): string => {
  const shortenArnTail = (raw: string): string => {
    const text = raw.trim();
    if (!text) return "unknown-target";
    const parts = text.split("/");
    if (parts.length >= 3) return parts[parts.length - 2] || parts[parts.length - 1] || text;
    return parts[parts.length - 1] || text;
  };

  const summarizeAction = (item: unknown): string => {
    if (typeof item !== "object" || item === null) return String(item);
    const action = item as Record<string, unknown>;
    const type = String(action.Type ?? action.type ?? "").trim().toLowerCase();
    if (!type) return JSON.stringify(item);

    if (type === "forward") {
      const targetGroupArn =
        String(action.TargetGroupArn ?? action.targetGroupArn ?? "").trim() ||
        (Array.isArray(action.ForwardConfig)
          ? ""
          : typeof action.ForwardConfig === "object" && action.ForwardConfig !== null
            ? String(
                (action.ForwardConfig as Record<string, unknown>).TargetGroups &&
                Array.isArray((action.ForwardConfig as Record<string, unknown>).TargetGroups)
                  ? (
                      ((action.ForwardConfig as Record<string, unknown>).TargetGroups as unknown[])[0] as Record<string, unknown> | undefined
                    )?.TargetGroupArn ?? ""
                  : "",
              ).trim()
            : "");
      return `Forward -> ${shortenArnTail(targetGroupArn)}`;
    }

    if (type === "redirect") {
      return "Redirect";
    }
    if (type === "fixed-response" || type === "fixed_response") {
      return "Fixed Response";
    }
    if (type === "authenticate-oidc" || type === "authenticate_oidc") {
      return "Authenticate OIDC";
    }
    if (type === "authenticate-cognito" || type === "authenticate_cognito") {
      return "Authenticate Cognito";
    }

    return type.replaceAll("-", " ").replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
  };

  if (!value) return "-";
  if (Array.isArray(value)) {
    const summaries = value.map((item) => summarizeAction(item)).filter(Boolean);
    return summaries.length > 0 ? summaries.join(", ") : "-";
  }
  return summarizeAction(value);
};

const buildCostTrendOption = (graph: unknown): EChartsOption => {
  const fallback: EChartsOption = {
    tooltip: { trigger: "axis", confine: true },
    grid: { left: 58, right: 14, top: 40, bottom: 34, containLabel: true },
    xAxis: { type: "category", boundaryGap: false, data: [], axisLabel: { hideOverlap: true, fontSize: 11 } },
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

  const raw = graph as { series?: Array<{ key?: string; label?: string; data?: Array<Record<string, unknown>> }> } | undefined;
  if (!raw || !Array.isArray(raw.series) || raw.series.length === 0) return fallback;
  const labels = raw.series[0]?.data?.map((entry) => String(entry.date ?? ""))?.filter(Boolean) ?? [];
  return {
    tooltip: { trigger: "axis", confine: true },
    legend: {
      show: raw.series.length > 1,
      type: "scroll",
      orient: "horizontal",
      top: 2,
      left: 58,
      right: 14,
      itemWidth: 12,
      itemHeight: 8,
      textStyle: { fontSize: 11 },
    },
    grid: { left: 58, right: 14, top: raw.series.length > 1 ? 68 : 40, bottom: 34, containLabel: true },
    xAxis: { type: "category", boundaryGap: false, data: labels, axisLabel: { hideOverlap: true, fontSize: 11 } },
    yAxis: {
      type: "value",
      name: "Cost (USD)",
      nameLocation: "end",
      nameGap: 24,
      nameTextStyle: { fontSize: 11, color: "#6d837e" },
      axisLabel: { fontSize: 11, margin: 10 },
    },
    series: raw.series.map((series) => ({
      name: series.label ?? series.key ?? "Series",
      type: "line",
      smooth: 0.42,
      showSymbol: false,
      lineStyle: { width: 2.3 },
      data: (series.data ?? []).map((point) => toNumber(point.value)),
    })),
  };
};

const buildUsageTrendOption = (
  graph: unknown,
  usageType: LoadBalancerExplorerControlsState["usageType"],
): EChartsOption => {
  const axisLabel = usageAxisLabel(usageType);
  const fallback: EChartsOption = {
    tooltip: { trigger: "axis", confine: true },
    grid: { left: 58, right: 14, top: 40, bottom: 34, containLabel: true },
    xAxis: { type: "category", boundaryGap: false, data: [], axisLabel: { hideOverlap: true, fontSize: 11 } },
    yAxis: {
      type: "value",
      name: axisLabel,
      nameLocation: "end",
      nameGap: 24,
      nameTextStyle: { fontSize: 11, color: "#6d837e" },
      axisLabel: { fontSize: 11, margin: 10 },
    },
    series: [],
  };
  const raw = graph as { series?: Array<{ key?: string; label?: string; data?: Array<Record<string, unknown>> }> } | undefined;
  if (!raw || !Array.isArray(raw.series) || raw.series.length === 0) return fallback;
  const labels = raw.series[0]?.data?.map((entry) => String(entry.date ?? ""))?.filter(Boolean) ?? [];
  return {
    tooltip: { trigger: "axis", confine: true },
    legend: {
      show: raw.series.length > 1,
      type: "scroll",
      orient: "horizontal",
      top: 2,
      left: 58,
      right: 14,
      itemWidth: 12,
      itemHeight: 8,
      textStyle: { fontSize: 11 },
    },
    grid: { left: 58, right: 14, top: raw.series.length > 1 ? 68 : 40, bottom: 34, containLabel: true },
    xAxis: { type: "category", boundaryGap: false, data: labels, axisLabel: { hideOverlap: true, fontSize: 11 } },
    yAxis: {
      type: "value",
      name: axisLabel,
      nameLocation: "end",
      nameGap: 24,
      nameTextStyle: { fontSize: 11, color: "#6d837e" },
      axisLabel: { fontSize: 11, margin: 10 },
    },
    series: raw.series.map((series) => ({
      name: series.label ?? series.key ?? "Series",
      type: "line",
      smooth: 0.42,
      showSymbol: false,
      lineStyle: { width: 2.3 },
      data: (series.data ?? []).map((point) => usagePointValue(point, usageType)),
    })),
  };
};

export default function LoadBalancerDetailPage() {
  const { loadBalancerId } = useParams<{ loadBalancerId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { scope } = useDashboardScope();
  const [usageType, setUsageType] = useState<LoadBalancerExplorerControlsState["usageType"]>("requests");

  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const decodedLoadBalancerId = useMemo(() => (loadBalancerId ? safeDecode(loadBalancerId) : ""), [loadBalancerId]);
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

  const detailQuery = useInventoryLoadBalancerDetail(decodedLoadBalancerId || null);
  const detail = detailQuery.data;

  const costFilters = useMemo(
    () => ({
      startDate,
      endDate,
      metric: "cost" as const,
      granularity: "daily" as const,
      groupBy: "cost_type" as const,
      groupValues: [],
      cloudConnectionId: detail?.cloudConnectionId ?? undefined,
      loadBalancerArn: detail?.arn ?? undefined,
      accountId: detail?.accountId ?? undefined,
      regions: detail?.region ? [detail.region] : undefined,
      types: detail?.type ? [detail.type] : undefined,
      schemes: detail?.scheme ? [detail.scheme] : undefined,
      states: detail?.state ? [detail.state] : undefined,
      tags: undefined,
    }),
    [detail?.accountId, detail?.arn, detail?.cloudConnectionId, detail?.region, detail?.scheme, detail?.state, detail?.type, endDate, startDate],
  );

  const usageFilters = useMemo(
    () => ({
      startDate,
      endDate,
      metric: "usage" as const,
      usageType,
      granularity: "daily" as const,
      groupBy: "load_balancer" as const,
      groupValues: [],
      cloudConnectionId: detail?.cloudConnectionId ?? undefined,
      loadBalancerArn: detail?.arn ?? undefined,
      accountId: detail?.accountId ?? undefined,
      regions: detail?.region ? [detail.region] : undefined,
      types: detail?.type ? [detail.type] : undefined,
      schemes: detail?.scheme ? [detail.scheme] : undefined,
      states: detail?.state ? [detail.state] : undefined,
      tags: undefined,
    }),
    [detail?.accountId, detail?.arn, detail?.cloudConnectionId, detail?.region, detail?.scheme, detail?.state, detail?.type, endDate, startDate, usageType],
  );

  const explorerQueriesEnabled = Boolean(scope && detail);
  const costSummaryQuery = useLoadBalancerExplorerSummaryQuery(costFilters, explorerQueriesEnabled);
  const costTrendQuery = useLoadBalancerExplorerTrendQuery(costFilters, explorerQueriesEnabled);
  const usageSummaryQuery = useLoadBalancerExplorerSummaryQuery(usageFilters, explorerQueriesEnabled);
  const usageTrendQuery = useLoadBalancerExplorerTrendQuery(usageFilters, explorerQueriesEnabled);

  const costTrendOption = useMemo(() => buildCostTrendOption(costTrendQuery.data?.graph), [costTrendQuery.data?.graph]);
  const usageTrendOption = useMemo(
    () => buildUsageTrendOption(usageTrendQuery.data?.graph, usageType),
    [usageTrendQuery.data?.graph, usageType],
  );

  const backToList = () => {
    navigate({ pathname: LIST_PATH, search: location.search });
  };

  if (!loadBalancerId) {
    return (
      <div className="dashboard-page">
        <EmptyStateBlock
          title="Load balancer not found"
          message="No load balancer identifier was provided."
          actions={<button type="button" className="cost-explorer-state-btn" onClick={backToList}>Back to Load Balancers</button>}
        />
      </div>
    );
  }

  if (detailQuery.isLoading) {
    return (
      <div className="dashboard-page">
        <p className="dashboard-note">Loading load balancer details...</p>
      </div>
    );
  }

  if (detailQuery.isError || !detail) {
    return (
      <div className="dashboard-page">
        <EmptyStateBlock
          title={detailQuery.isError ? "Unable to load load balancer details" : "Load balancer not found"}
          message={detailQuery.isError ? detailQuery.error.message : "No load balancer matched the selected identifier."}
          actions={<button type="button" className="cost-explorer-state-btn" onClick={backToList}>Back to Load Balancers</button>}
        />
      </div>
    );
  }

  const costSummary = costSummaryQuery.data?.summary;
  const usageSummary = usageSummaryQuery.data?.summary;
  const displayName = (detail.name ?? "").trim() || deriveNameFromArn(detail.arn) || "Unknown Load Balancer";
  const overviewRows = [
    { label: "Name", value: displayName },
    { label: "Type", value: toTitle(detail.type) },
    { label: "Scheme", value: toTitle(detail.scheme) },
    { label: "State", value: toTitle(detail.state) },
    { label: "Region", value: detail.region ?? "-" },
    { label: "Account", value: detail.accountId ?? "-" },
    { label: "VPC", value: detail.vpcId ?? "-" },
    { label: "DNS Name", value: detail.dnsName ?? "-" },
    { label: "Created At", value: formatDateTime(detail.createdAtAws) },
  ];
  const tagRows = Object.entries(detail.tags ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const costHasTrendData = Boolean(costTrendQuery.data?.graph?.series?.some((series) => series.data.length > 0));
  const usageHasTrendData = Boolean(usageTrendQuery.data?.graph?.series?.some((series) => series.data.length > 0));

  return (
    <div className="dashboard-page load-balancer-detail-page">
      <section className="ec2-instance-detail" aria-label="Load balancer detail">
        <div className="ec2-instance-detail__layout">
          <div className="ec2-instance-detail__content">
            <section id="overview" className="ec2-instance-detail__panel">
              <div className="load-balancer-detail__header">
                <h2 className="load-balancer-detail__title" title={displayName}>{displayName}</h2>
                <p className="load-balancer-detail__subtitle">Load Balancer Detail</p>
              </div>
              <div className="load-balancer-detail__arn-wrap">
                <span className="load-balancer-detail__arn-label">ARN</span>
                <code className="load-balancer-detail__arn" title={detail.arn ?? "-"}>{detail.arn ?? "-"}</code>
              </div>
              <h3>Overview</h3>
              <table className="ec2-instance-detail__simple-table">
                <tbody>
                  {overviewRows.map((row) => (
                    <tr key={row.label}>
                      <td>{row.label}</td>
                      <td><strong>{row.value}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section id="cost-summary" className="ec2-instance-detail__panel">
              <h3>Cost Summary</h3>
              <section className="overview-kpi-strip overview-kpi-board ec2-instance-detail__kpi-board">
                <div className="overview-kpi-row overview-kpi-row--report ec2-overview-kpi-row">
                  <KpiCard label="Total Cost" value={formatCurrency(costSummary?.totalCost)} />
                  <KpiCard label="Fixed Cost" value={formatCurrency(costSummary?.fixedCost)} />
                  <KpiCard label="LCU Cost" value={formatCurrency(costSummary?.lcuCost)} />
                  <KpiCard label="Data Processing Cost" value={formatCurrency(costSummary?.dataProcessingCost)} />
                </div>
              </section>
            </section>

            <section id="cost-trend" className="ec2-instance-detail__panel">
              <h3>Cost Trend</h3>
              {costTrendQuery.isLoading ? <p className="dashboard-note">Loading cost trend...</p> : null}
              {costTrendQuery.isError ? (
                <EmptyStateBlock
                  title="Unable to load cost trend"
                  message={costTrendQuery.error.message || "An unexpected error occurred."}
                  actions={<button type="button" className="cost-explorer-state-btn" onClick={() => void costTrendQuery.refetch()}>Retry</button>}
                />
              ) : null}
              {!costTrendQuery.isLoading && !costTrendQuery.isError ? (
                costHasTrendData
                  ? <div className="load-balancer-detail__chart-shell"><BaseEChart option={costTrendOption} height={280} /></div>
                  : <p className="dashboard-note">No cost trend data for selected range.</p>
              ) : null}
            </section>

            <section id="usage-summary" className="ec2-instance-detail__panel">
              <h3>Usage Summary</h3>
              <section className="overview-kpi-strip overview-kpi-board ec2-instance-detail__kpi-board">
                <div className="overview-kpi-row overview-kpi-row--report ec2-overview-kpi-row">
                  <KpiCard label="Requests" value={formatInteger(toNumber(usageSummary?.requestCount))} />
                  <KpiCard label="Processed GB" value={formatProcessedGb(toNumber(usageSummary?.processedGB))} />
                  <KpiCard label="Active Connections" value={formatInteger(toNumber(usageSummary?.activeConnections))} />
                  <KpiCard label="New Connections" value={formatInteger(toNumber(usageSummary?.newConnections))} />
                  <KpiCard label="Healthy Hosts" value={formatInteger(toNumber(usageSummary?.healthyHosts))} />
                  <KpiCard label="Unhealthy Hosts" value={formatInteger(toNumber(usageSummary?.unhealthyHosts))} />
                  <KpiCard label="Errors" value={formatInteger(toNumber(usageSummary?.errorCount))} />
                </div>
              </section>
            </section>

            <section id="usage-trend" className="ec2-instance-detail__panel">
              <div className="ec2-explorer-chart__header">
                <h3>Usage Trend</h3>
                <label className="ec2-explorer-chart__chart-type">
                  <span className="ec2-explorer-chart__chart-type-label">Usage Type</span>
                  <select
                    value={usageType}
                    onChange={(event) => setUsageType(event.target.value as LoadBalancerExplorerControlsState["usageType"])}
                    aria-label="Usage type"
                  >
                    {LOAD_BALANCER_USAGE_TYPE_OPTIONS.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {usageTrendQuery.isLoading ? <p className="dashboard-note">Loading usage trend...</p> : null}
              {usageTrendQuery.isError ? (
                <EmptyStateBlock
                  title="Unable to load usage trend"
                  message={usageTrendQuery.error.message || "An unexpected error occurred."}
                  actions={<button type="button" className="cost-explorer-state-btn" onClick={() => void usageTrendQuery.refetch()}>Retry</button>}
                />
              ) : null}
              {!usageTrendQuery.isLoading && !usageTrendQuery.isError ? (
                usageHasTrendData
                  ? <div className="load-balancer-detail__chart-shell"><BaseEChart option={usageTrendOption} height={280} /></div>
                  : <p className="dashboard-note">No usage trend data for selected range.</p>
              ) : null}
            </section>

            <section id="target-groups" className="ec2-instance-detail__panel">
              <h3>Target Groups</h3>
              {detail.targetGroups.length === 0 ? (
                <p className="dashboard-note">No target groups found.</p>
              ) : (
                <table className="ec2-instance-detail__simple-table load-balancer-detail__target-groups-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Protocol</th>
                      <th>Port</th>
                      <th>Target Type</th>
                      <th>Healthy Targets</th>
                      <th>Unhealthy Targets</th>
                      <th>Health Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.targetGroups.map((group) => {
                      const healthyCount = Math.max(0, Math.trunc(toNumber(group.healthyTargetCount)));
                      const unhealthyCount = Math.max(0, Math.trunc(toNumber(group.unhealthyTargetCount)));
                      const status = healthStatusFromCounts(healthyCount, unhealthyCount);
                      return (
                      <tr key={group.arn}>
                        <td className="load-balancer-detail__tg-name-cell" title={group.name ?? group.arn}>
                          {group.name ?? group.arn}
                        </td>
                        <td>{group.protocol ?? "-"}</td>
                        <td>{group.port ?? "-"}</td>
                        <td>{group.targetType ?? "-"}</td>
                        <td className="load-balancer-detail__count-cell">{healthyCount}</td>
                        <td className="load-balancer-detail__count-cell">{unhealthyCount}</td>
                        <td>
                          <span className={`load-balancer-detail__health-pill load-balancer-detail__health-pill--${status.tone}`}>
                            {status.label}
                          </span>
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              )}
            </section>

            <section id="listeners" className="ec2-instance-detail__panel">
              <h3>Listeners</h3>
              {detail.listeners.length === 0 ? (
                <p className="dashboard-note">No listeners found.</p>
              ) : (
                <table className="ec2-instance-detail__simple-table">
                  <thead>
                    <tr>
                      <th>Protocol</th>
                      <th>Port</th>
                      <th>SSL Policy</th>
                      <th>Default Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.listeners.map((listener) => (
                      <tr key={listener.arn}>
                        <td title={listener.protocol ?? "-"} className="load-balancer-detail__truncate-cell">{listener.protocol ?? "-"}</td>
                        <td title={listener.port === null ? "-" : String(listener.port)} className="load-balancer-detail__truncate-cell">{listener.port ?? "-"}</td>
                        <td title={listener.sslPolicy ?? "-"} className="load-balancer-detail__truncate-cell">{listener.sslPolicy ?? "-"}</td>
                        <td
                          title={toDefaultActionsText(listener.defaultActions)}
                          className="load-balancer-detail__truncate-cell"
                        >
                          {toDefaultActionsText(listener.defaultActions)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section id="tags" className="ec2-instance-detail__panel">
              <h3>Tags</h3>
              {tagRows.length === 0 ? (
                <p className="dashboard-note">No tags found.</p>
              ) : (
                <table className="ec2-instance-detail__simple-table">
                  <thead>
                    <tr>
                      <th>Key</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tagRows.map(([key, value]) => (
                      <tr key={key}>
                        <td>{key}</td>
                        <td>{typeof value === "string" ? value : JSON.stringify(value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>

          <StickySectionNav
            sections={[
              { id: "overview", label: "Overview" },
              { id: "cost-summary", label: "Cost Summary" },
              { id: "cost-trend", label: "Cost Trend" },
              { id: "usage-summary", label: "Usage Summary" },
              { id: "usage-trend", label: "Usage Trend" },
              { id: "target-groups", label: "Target Groups" },
              { id: "listeners", label: "Listeners" },
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
