import { useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import type { ColDef, ValueFormatterParams } from "ag-grid-community";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { useInventoryEc2InstanceDetail } from "@/features/client-home/hooks/useInventoryEc2Instances";
import { BaseEChart } from "@/features/dashboard/common/charts/BaseEChart";
import { EmptyStateBlock } from "@/features/dashboard/common/components/EmptyStateBlock";
import { KpiCard } from "@/features/dashboard/common/components/KpiCard";
import { BaseDataTable } from "@/features/dashboard/common/tables/BaseDataTable";
import {
  EC2InstanceDetailHeaderTabs,
  type EC2InstanceDetailTabKey,
} from "./components/EC2InstanceDetailHeaderTabs";

const VOLUMES_PAGE_PATH = "/dashboard/inventory/aws/ec2/volumes";
const INSTANCES_PAGE_PATH = "/dashboard/inventory/aws/ec2/instances";

const CURRENCY_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const DECIMAL_FORMATTER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

const toIsoDate = (value: Date): string => value.toISOString().slice(0, 10);

const getDefaultDateRange = (): { start: string; end: string } => {
  const today = new Date();
  const startOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  return {
    start: toIsoDate(startOfMonth),
    end: toIsoDate(today),
  };
};

const toTitle = (value: string): string =>
  value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || typeof value === "undefined" || !Number.isFinite(value)) return "-";
  return CURRENCY_FORMATTER.format(value);
};

const formatPercent = (value: number | null | undefined): string => {
  if (value === null || typeof value === "undefined" || !Number.isFinite(value)) return "-";
  return `${DECIMAL_FORMATTER.format(value)}%`;
};

const formatNumber = (value: number | null | undefined): string => {
  if (value === null || typeof value === "undefined" || !Number.isFinite(value)) return "-";
  return DECIMAL_FORMATTER.format(value);
};

const formatSize = (value: number | null | undefined): string => {
  if (value === null || typeof value === "undefined" || !Number.isFinite(value)) return "-";
  return `${value.toLocaleString()} GB`;
};

const bytesToGb = (value: number | null | undefined): number => {
  if (value === null || typeof value === "undefined" || !Number.isFinite(value)) return 0;
  return value / (1024 * 1024 * 1024);
};

const toPricingLabel = (value: "on_demand" | "reserved" | "savings_plan" | "spot" | "other" | null): string => {
  if (value === "on_demand") return "On-Demand";
  if (value === "reserved") return "RI";
  if (value === "savings_plan") return "SP";
  if (value === "spot") return "Spot";
  if (value === "other") return "Other";
  return "Unknown";
};

const getTagValue = (tags: Record<string, unknown>, key: string): string => {
  const exact = tags[key];
  if (typeof exact === "string" && exact.trim().length > 0) return exact;
  const found = Object.entries(tags).find(([k]) => k.toLowerCase() === key.toLowerCase());
  if (!found) return "-";
  return String(found[1]);
};

export default function EC2InstanceDetailPage() {
  const { instanceId } = useParams<{ instanceId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<EC2InstanceDetailTabKey>("overview");

  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const defaults = getDefaultDateRange();
  const startDate = queryParams.get("startDate") ?? queryParams.get("from") ?? queryParams.get("billingPeriodStart") ?? defaults.start;
  const endDate = queryParams.get("endDate") ?? queryParams.get("to") ?? queryParams.get("billingPeriodEnd") ?? defaults.end;
  const cloudConnectionId = queryParams.get("cloudConnectionId") ?? queryParams.get("cloud_connection_id");

  const detailQuery = useInventoryEc2InstanceDetail({
    instanceId: instanceId ?? "",
    cloudConnectionId,
    startDate,
    endDate,
  });

  const backToInstances = () => {
    const next = new URLSearchParams(location.search);
    next.delete("instanceId");
    navigate({ pathname: INSTANCES_PAGE_PATH, search: next.toString() });
  };

  if (detailQuery.isLoading) {
    return (
      <div className="dashboard-page">
        <p className="dashboard-note">Loading instance details...</p>
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <div className="dashboard-page">
        <EmptyStateBlock
          title="Unable to load instance details"
          message={detailQuery.isError ? detailQuery.error.message : "Instance not found for selected filters."}
          actions={
            <button type="button" className="cost-explorer-state-btn" onClick={backToInstances}>
              Back to Instances
            </button>
          }
        />
      </div>
    );
  }

  const detail = detailQuery.data;
  const tags = detail.tags ?? {};

  const costRows = [
    { type: "Compute", cost: detail.costSummary.computeCost },
    { type: "EBS", cost: detail.costSummary.ebsCost },
    { type: "Network", cost: detail.costSummary.networkCost },
    { type: "Other / Unallocated", cost: detail.costSummary.otherCost },
  ].map((row) => ({
    ...row,
    pct: detail.costSummary.totalCost > 0 ? (row.cost / detail.costSummary.totalCost) * 100 : 0,
  }));

  const recommendation = detail.recommendations[0] ?? null;
  const isUncoveredOnDemand = recommendation?.type === "uncovered_on_demand";
  const avgCpu = detail.usageSummary.avgCpu;
  const networkUsageGb = bytesToGb(detail.usageSummary.networkUsageBytes);
  const state = (detail.identity.state ?? "").toLowerCase();
  const overviewInsight = isUncoveredOnDemand
    ? { label: "Uncovered On-Demand", tone: "warn" as const, message: "On-Demand instance without coverage." }
    : avgCpu !== null && avgCpu < 5 && networkUsageGb < 1
      ? { label: "Idle", tone: "idle" as const, message: "Low CPU and network usage detected." }
      : avgCpu !== null && avgCpu < 20
        ? { label: "Underutilized", tone: "warn" as const, message: "Instance is underutilized." }
        : avgCpu !== null && avgCpu > 75
          ? { label: "Overutilized", tone: "warn" as const, message: "High CPU usage detected." }
          : { label: "Healthy", tone: "good" as const, message: "Usage and cost posture appear healthy." };

  const pricingInsight = detail.pricingSummary.pricingType === "on_demand"
    ? "On-Demand detected. Consider RI/SP for stable workloads."
    : detail.pricingSummary.pricingType === "spot"
      ? "Spot pricing detected."
      : detail.pricingSummary.coveragePercent > 0
        ? "Instance has pricing coverage."
        : "Needs backend source";

  const storageColumns: ColDef<(typeof detail.attachedVolumes)[number]>[] = [
    { headerName: "Volume", field: "volumeId", minWidth: 190 },
    { headerName: "Size", field: "sizeGb", minWidth: 110, valueFormatter: (p: ValueFormatterParams<(typeof detail.attachedVolumes)[number], number | null | undefined>) => formatSize(p.value) },
    { headerName: "Type", field: "volumeType", minWidth: 100, valueFormatter: (p) => p.value ?? "-" },
    { headerName: "Cost", field: "cost", minWidth: 110, valueFormatter: (p) => formatCurrency(p.value as number | null | undefined) },
    { headerName: "State", field: "state", minWidth: 110, valueFormatter: (p) => (p.value ? toTitle(String(p.value)) : "-") },
    { headerName: "IOPS", field: "iops", minWidth: 100, valueFormatter: (p) => formatNumber(p.value as number | null | undefined) },
    { headerName: "Throughput", field: "throughput", minWidth: 120, valueFormatter: (p) => formatNumber(p.value as number | null | undefined) },
    { headerName: "Attached Since", field: "attachedSince", minWidth: 170, valueFormatter: (p) => (typeof p.value === "string" ? new Date(p.value).toLocaleDateString("en-US") : "-") },
    { headerName: "Delete on Termination", field: "deleteOnTermination", minWidth: 170, valueFormatter: (p) => (typeof p.value === "boolean" ? (p.value ? "Yes" : "No") : "-") },
  ];

  const recommendationColumns: ColDef<(typeof detail.recommendations)[number]>[] = [
    { headerName: "Type", field: "type", minWidth: 140, valueFormatter: (p) => toTitle(String(p.value ?? "")) },
    { headerName: "Problem", field: "problem", minWidth: 180 },
    { headerName: "Evidence", field: "evidence", minWidth: 220 },
    { headerName: "Action", field: "action", minWidth: 160 },
    { headerName: "Saving", field: "saving", minWidth: 120, valueFormatter: (p) => formatCurrency(p.value as number | null | undefined) },
    { headerName: "Risk", field: "risk", minWidth: 90, valueFormatter: (p) => toTitle(String(p.value ?? "")) },
    { headerName: "Status", field: "status", minWidth: 90, valueFormatter: (p) => toTitle(String(p.value ?? "")) },
  ];

  const metadataRows = Object.entries(tags).map(([key, value]) => ({ key, value: String(value) }));

  const costTrendLabels = detail.trends.costTrend.map((d) => d.date);

  const buildLineOption = (
    params: {
      labels: string[];
      yAxisName: string;
      series: Array<{ name: string; data: Array<number | null | undefined> }>;
      legend?: string[];
    },
    opts?: { area?: boolean },
  ): EChartsOption => {
    const showLegend = (params.legend ?? []).length > 0;
    return {
      tooltip: {
        trigger: "axis",
        confine: true,
      },
      legend: showLegend
        ? {
            show: true,
            type: "scroll",
            orient: "horizontal",
            top: 2,
            left: 58,
            right: 14,
            itemWidth: 12,
            itemHeight: 8,
            textStyle: { fontSize: 11 },
          }
        : { show: false },
      grid: {
        left: 58,
        right: 14,
        top: showLegend ? 68 : 40,
        bottom: 34,
        containLabel: true,
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: params.labels,
        axisLabel: { hideOverlap: true, fontSize: 11 },
      },
      yAxis: {
        type: "value",
        name: params.yAxisName,
        nameLocation: "end",
        nameGap: 24,
        nameTextStyle: { fontSize: 11, color: "#6d837e" },
        axisLabel: { fontSize: 11, margin: 10 },
      },
      series: params.series.map((item) => ({
        name: item.name,
        type: "line",
        smooth: 0.42,
        showSymbol: false,
        symbol: "circle",
        symbolSize: 6,
        lineStyle: { width: 2.3 },
        areaStyle: opts?.area ? { opacity: 0.14 } : undefined,
        data: item.data,
      })),
    };
  };

  const overviewCostOption: EChartsOption = buildLineOption(
    {
      labels: costTrendLabels,
      yAxisName: "USD",
      legend: ["Compute", "EBS", "Network", "Other"],
      series: [
        { name: "Compute", data: detail.trends.costTrend.map((d) => d.computeCost) },
        { name: "EBS", data: detail.trends.costTrend.map((d) => d.ebsCost) },
        { name: "Network", data: detail.trends.costTrend.map((d) => d.networkCost) },
        { name: "Other", data: detail.trends.costTrend.map((d) => d.otherCost) },
      ],
    },
    { area: true },
  );

  const overviewCpuOption: EChartsOption = buildLineOption({
    labels: detail.trends.cpuTrend.map((d) => d.date),
    yAxisName: "%",
    series: [{ name: "Avg CPU", data: detail.trends.cpuTrend.map((d) => d.avgCpu) }],
  });

  const overviewNetworkOption: EChartsOption = buildLineOption({
    labels: detail.trends.networkTrend.map((d) => d.date),
    yAxisName: "GB",
    series: [{ name: "Total Network Usage", data: detail.trends.networkTrend.map((d) => d.totalGb) }],
  });

  const usageCpuOption: EChartsOption = buildLineOption({
    labels: detail.trends.cpuTrend.map((d) => d.date),
    yAxisName: "%",
    legend: ["Avg CPU", "Max CPU"],
    series: [
      { name: "Avg CPU", data: detail.trends.cpuTrend.map((d) => d.avgCpu) },
      { name: "Max CPU", data: detail.trends.cpuTrend.map((d) => d.maxCpu ?? 0) },
    ],
  });

  const usageNetworkOption: EChartsOption = buildLineOption({
    labels: detail.trends.networkTrend.map((d) => d.date),
    yAxisName: "GB",
    legend: ["Network In", "Network Out"],
    series: [
      { name: "Network In", data: detail.trends.networkTrend.map((d) => d.inGb) },
      { name: "Network Out", data: detail.trends.networkTrend.map((d) => d.outGb) },
    ],
  });

  return (
    <div className="dashboard-page">
      <section className="ec2-instance-detail" aria-label="EC2 instance detail">
        <EC2InstanceDetailHeaderTabs activeTab={activeTab} onChange={setActiveTab} />

        {activeTab === "overview" ? (
          <section className="ec2-instance-detail__panel">
            <section className="overview-kpi-strip overview-kpi-board ec2-instance-detail__kpi-board">
              <div className="overview-kpi-row overview-kpi-row--report ec2-overview-kpi-row">
                <KpiCard label="Total Cost" value={formatCurrency(detail.costSummary.totalCost)} />
                <KpiCard label="Compute Cost" value={formatCurrency(detail.costSummary.computeCost)} />
                <KpiCard label="Volume Cost" value={formatCurrency(detail.costSummary.ebsCost)} />
                <KpiCard label="Avg CPU" value={formatPercent(detail.usageSummary.avgCpu)} />
                <KpiCard label="Network Usage" value={`${formatNumber(bytesToGb(detail.usageSummary.networkUsageBytes))} GB`} />
                <KpiCard label="State" value={toTitle(state || "unknown")} />
                <KpiCard label="Instance Type" value={detail.identity.type ?? "-"} />
                <KpiCard label="Pricing Type" value={toPricingLabel(detail.pricingSummary.pricingType)} />
              </div>
            </section>
            <div className={`ec2-instance-detail__insight ec2-instance-detail__insight--${overviewInsight.tone}`}>
              <strong>{overviewInsight.label}</strong>
              <span>{overviewInsight.message}</span>
            </div>
            <div className="ec2-instance-detail__charts3 ec2-instance-detail__charts3--overview">
              <div>
                <h4>Cost Trend</h4>
                {detail.trends.costTrend.length > 0 ? <BaseEChart option={overviewCostOption} height={260} /> : <p className="dashboard-note">Needs backend source</p>}
              </div>
              <div>
                <h4>CPU Trend</h4>
                {detail.trends.cpuTrend.length > 0 ? <BaseEChart option={overviewCpuOption} height={260} /> : <p className="dashboard-note">Needs backend source</p>}
              </div>
              <div>
                <h4>Network Trend</h4>
                {detail.trends.networkTrend.length > 0 ? <BaseEChart option={overviewNetworkOption} height={260} /> : <p className="dashboard-note">Needs backend source</p>}
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === "cost-breakdown" ? (
          <section className="ec2-instance-detail__panel">
            <p><strong>Total Cost: {formatCurrency(detail.costSummary.totalCost)}</strong></p>
            <table className="ec2-instance-detail__simple-table">
              <thead><tr><th>Usage Type</th><th>Cost</th><th>%</th></tr></thead>
              <tbody>
                {costRows.map((row) => (
                  <tr key={row.type}><td>{row.type}</td><td>{formatCurrency(row.cost)}</td><td>{DECIMAL_FORMATTER.format(row.pct)}%</td></tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        {activeTab === "usage" ? (
          <section className="ec2-instance-detail__panel">
            <div className="ec2-instance-detail__kpis ec2-instance-detail__kpis--compact">
              <div className="ec2-instance-detail__kpi"><span>Avg CPU (%)</span><strong>{formatPercent(detail.usageSummary.avgCpu)}</strong></div>
              <div className="ec2-instance-detail__kpi"><span>Max CPU (%)</span><strong>{formatPercent(detail.usageSummary.maxCpu)}</strong></div>
              <div className="ec2-instance-detail__kpi"><span>Network In (GB)</span><strong>{formatNumber(bytesToGb(detail.usageSummary.networkInBytes))}</strong></div>
              <div className="ec2-instance-detail__kpi"><span>Network Out (GB)</span><strong>{formatNumber(bytesToGb(detail.usageSummary.networkOutBytes))}</strong></div>
              <div className="ec2-instance-detail__kpi"><span>Total Network Usage (GB)</span><strong>{formatNumber(bytesToGb(detail.usageSummary.networkUsageBytes))}</strong></div>
              <div className="ec2-instance-detail__kpi"><span>Network Cost ($)</span><strong>{formatCurrency(detail.usageSummary.networkCost)}</strong></div>
            </div>
            <div className="ec2-instance-detail__charts2">
              <div><h4>CPU Trend</h4>{detail.trends.cpuTrend.length > 0 ? <BaseEChart option={usageCpuOption} height={280} /> : <p className="dashboard-note">Needs backend source</p>}</div>
              <div><h4>Network Trend</h4>{detail.trends.networkTrend.length > 0 ? <BaseEChart option={usageNetworkOption} height={280} /> : <p className="dashboard-note">Needs backend source</p>}</div>
            </div>
          </section>
        ) : null}

        {activeTab === "storage" ? (
          <section className="ec2-instance-detail__panel">
            <div className="ec2-instance-detail__summary-line">
              <span>Total Volume Cost: <strong>{formatCurrency(detail.costSummary.ebsCost)}</strong></span>
              <span>Total Volume Size: <strong>{formatSize(detail.attachedVolumes.reduce((sum, row) => sum + (row.sizeGb ?? 0), 0))}</strong></span>
              <span>Volume Count: <strong>{detail.attachedVolumes.length}</strong></span>
            </div>
            <BaseDataTable
              columnDefs={storageColumns}
              rowData={detail.attachedVolumes}
              autoHeight
              pagination
              paginationPageSize={10}
              onRowClick={(row) => {
                const next = new URLSearchParams(location.search);
                next.set("volumeId", row.volumeId);
                next.set("search", row.volumeId);
                navigate({ pathname: `${VOLUMES_PAGE_PATH}/${row.volumeId}`, search: next.toString() });
              }}
            />
          </section>
        ) : null}

        {activeTab === "pricing-efficiency" ? (
          <section className="ec2-instance-detail__panel">
            <div className="ec2-instance-detail__kpis ec2-instance-detail__kpis--compact">
              <div className="ec2-instance-detail__kpi"><span>Pricing Type</span><strong>{toPricingLabel(detail.pricingSummary.pricingType)}</strong></div>
              <div className="ec2-instance-detail__kpi"><span>Coverage %</span><strong>{formatPercent(detail.pricingSummary.coveragePercent)}</strong></div>
              <div className="ec2-instance-detail__kpi"><span>Compute Cost</span><strong>{formatCurrency(detail.pricingSummary.computeCost)}</strong></div>
              <div className="ec2-instance-detail__kpi"><span>Estimated Monthly Cost</span><strong>{formatCurrency(detail.costSummary.totalCost)}</strong></div>
              <div className="ec2-instance-detail__kpi"><span>Potential Savings</span><strong>{detail.pricingSummary.potentialSavings === null ? "Needs recommendation" : formatCurrency(detail.pricingSummary.potentialSavings)}</strong></div>
            </div>
            <p className="dashboard-note">{pricingInsight}</p>
          </section>
        ) : null}

        {activeTab === "recommendations" ? (
          <section className="ec2-instance-detail__panel">
            {detail.recommendations.length === 0 ? (
              <p className="dashboard-note">No optimization opportunities found for this instance.</p>
            ) : (
              <BaseDataTable
                columnDefs={recommendationColumns}
                rowData={detail.recommendations}
                autoHeight
                onRowClick={() => {}}
              />
            )}
          </section>
        ) : null}

        {activeTab === "metadata" ? (
          <section className="ec2-instance-detail__panel">
            <div className="ec2-instance-detail__meta-grid">
              <div><span>Team</span><strong>{getTagValue(tags, "Team")}</strong></div>
              <div><span>Product</span><strong>{getTagValue(tags, "Product")}</strong></div>
              <div><span>Environment</span><strong>{getTagValue(tags, "Environment")}</strong></div>
              <div><span>Owner</span><strong>{getTagValue(tags, "Owner")}</strong></div>
              <div><span>Instance ID</span><strong>{detail.identity.instanceId}</strong></div>
              <div><span>Region</span><strong>{detail.identity.region ?? "-"}</strong></div>
              <div><span>Account</span><strong>{detail.identity.account ?? "-"}</strong></div>
              <div><span>Launch Time</span><strong>{detail.identity.launchTime ? new Date(detail.identity.launchTime).toLocaleString("en-US") : "-"}</strong></div>
              <div><span>Availability Zone</span><strong>{detail.identity.availabilityZone ?? "-"}</strong></div>
            </div>
            <table className="ec2-instance-detail__simple-table">
              <thead><tr><th>Tag</th><th>Value</th></tr></thead>
              <tbody>
                {metadataRows.length === 0 ? <tr><td colSpan={2}>No tags available</td></tr> : null}
                {metadataRows.map((row) => <tr key={row.key}><td>{row.key}</td><td>{row.value}</td></tr>)}
              </tbody>
            </table>
          </section>
        ) : null}
      </section>
    </div>
  );
}
