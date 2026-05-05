import type { EChartsOption } from "echarts";
import type { ColDef, ValueFormatterParams } from "ag-grid-community";
import type { InventoryEc2InstanceDetailResponse } from "@/features/client-home/api/inventory-instances.api";

import { BaseEChart } from "@/features/dashboard/common/charts/BaseEChart";
import { KpiCard } from "@/features/dashboard/common/components/KpiCard";
import { BaseDataTable } from "@/features/dashboard/common/tables/BaseDataTable";

type Recommendation = InventoryEc2InstanceDetailResponse["recommendations"][number];
type AttachedVolume = InventoryEc2InstanceDetailResponse["attachedVolumes"][number];
type NetworkRow = InventoryEc2InstanceDetailResponse["networkInsight"]["breakdown"][number];

const NETWORK_BREAKDOWN_COLORS = ["#188977", "#2A5CAA", "#E07A2A", "#8D5A97", "#68757D"];

export type DecisionStatus = "Healthy" | "Optimization Opportunity" | "Risk Detected";

export function DecisionSummaryCard(props: {
  status: DecisionStatus;
  totalCost: string;
  potentialSavings: string;
  primaryIssue: string;
  riskLevel: string;
  onViewActions: () => void;
}) {
  return (
    <section id="summary" className="ec2-instance-detail__panel ec2-instance-detail__summary-card">
      <div className="ec2-instance-detail__summary-head">
        <span className={`ec2-instance-detail__status-pill ec2-instance-detail__status-pill--${props.status.toLowerCase().replaceAll(" ", "-")}`}>
          {props.status}
        </span>
        <button type="button" className="cost-explorer-state-btn" onClick={props.onViewActions}>View Recommended Actions</button>
      </div>
      <div className="ec2-instance-detail__summary-grid">
        <div><span>Total cost</span><strong>{props.totalCost}</strong></div>
        <div><span>Potential savings</span><strong>{props.potentialSavings}</strong></div>
        <div><span>Primary issue</span><strong>{props.primaryIssue}</strong></div>
        <div><span>Risk level</span><strong>{props.riskLevel}</strong></div>
      </div>
    </section>
  );
}

export function RecommendationCard(props: {
  recommendation: Recommendation;
  onActionClick: (item: Recommendation) => void;
  formatCurrency: (value: number | null | undefined) => string;
  toTitle: (value: string) => string;
  recommendationTypeLabel: (value: string) => string;
}) {
  const { recommendation, onActionClick, formatCurrency, toTitle, recommendationTypeLabel } = props;
  return (
    <article className="ec2-instance-detail__recommendation-card">
      <header>
        <h4>{recommendationTypeLabel(recommendation.type)}</h4>
        <span>{toTitle(recommendation.category)}</span>
      </header>
      <div className="ec2-instance-detail__recommendation-body">
        <p><strong>Problem:</strong> {recommendation.problem}</p>
        <p><strong>Evidence:</strong> {recommendation.evidence}</p>
        <p><strong>Recommended action:</strong> {recommendation.action}</p>
      </div>
      <div className="ec2-instance-detail__recommendation-meta">
        <span><strong>Savings:</strong> {formatCurrency(recommendation.saving)}</span>
        <span><strong>Risk:</strong> {toTitle(recommendation.risk)}</span>
        <span><strong>Status:</strong> {toTitle(recommendation.status)}</span>
      </div>
      <button type="button" className="cost-explorer-state-btn" onClick={() => onActionClick(recommendation)}>Open in Action Center</button>
    </article>
  );
}

export function KeySignalsGrid(props: { items: Array<{ label: string; value: string }> }) {
  return (
    <section id="signals" className="ec2-instance-detail__panel">
      <h3>Key Signals</h3>
      <section className="overview-kpi-strip overview-kpi-board ec2-instance-detail__kpi-board">
        <div className="overview-kpi-row overview-kpi-row--report ec2-overview-kpi-row">
          {props.items.map((item) => <KpiCard key={item.label} label={item.label} value={item.value} />)}
        </div>
      </section>
    </section>
  );
}

export function CostDriversSection(props: {
  costRows: Array<{ type: string; cost: number; pct: number }>;
  totalCost: string;
  ebsPct: string;
  attachedVolumes: AttachedVolume[];
  storageColumns: ColDef<AttachedVolume>[];
  formatCurrency: (value: number | null | undefined) => string;
  formatPercent: (value: number | null | undefined) => string;
  onVolumeRowClick: (row: AttachedVolume) => void;
}) {
  return (
    <section id="cost-drivers" className="ec2-instance-detail__panel">
      <h3>Cost Drivers</h3>
      <details open>
        <summary><strong>Cost and storage details</strong></summary>
        <div className="ec2-instance-detail__summary-line">
          <span>Total Cost: <strong>{props.totalCost}</strong></span>
        </div>
        <table className="ec2-instance-detail__simple-table">
          <thead><tr><th>Cost Type</th><th>Cost</th><th>%</th></tr></thead>
          <tbody>
            {props.costRows.map((row) => (
              <tr key={row.type}><td>{row.type}</td><td>{props.formatCurrency(row.cost)}</td><td>{props.formatPercent(row.pct)}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="ec2-instance-detail__insight ec2-instance-detail__insight--warn">
          <strong>Storage is the dominant cost driver</strong>
          <span>EBS accounts for {props.ebsPct} of total cost.</span>
        </div>
        <h4>Attached Volumes</h4>
        <BaseDataTable
          columnDefs={props.storageColumns}
          rowData={props.attachedVolumes}
          autoHeight
          pagination
          paginationPageSize={10}
          onRowClick={props.onVolumeRowClick}
        />
      </details>
    </section>
  );
}

export function PerformanceSection(props: {
  avgCpu: string;
  maxCpu: string;
  networkIn: string;
  networkOut: string;
  cpuOption: EChartsOption;
  networkOption: EChartsOption;
  hasCpuTrend: boolean;
  hasNetworkTrend: boolean;
}) {
  return (
    <section id="performance" className="ec2-instance-detail__panel">
      <h3>Performance</h3>
      <div className="ec2-instance-detail__kpis ec2-instance-detail__kpis--compact">
        <div className="ec2-instance-detail__kpi"><span>Avg CPU</span><strong>{props.avgCpu}</strong></div>
        <div className="ec2-instance-detail__kpi"><span>Max CPU</span><strong>{props.maxCpu}</strong></div>
        <div className="ec2-instance-detail__kpi"><span>Network In</span><strong>{props.networkIn}</strong></div>
        <div className="ec2-instance-detail__kpi"><span>Network Out</span><strong>{props.networkOut}</strong></div>
      </div>
      <div className="ec2-instance-detail__charts2">
        <div><h4>CPU Trend</h4>{props.hasCpuTrend ? <BaseEChart option={props.cpuOption} height={260} /> : <p className="dashboard-note">Needs backend source</p>}</div>
        <div><h4>Network Trend</h4>{props.hasNetworkTrend ? <BaseEChart option={props.networkOption} height={260} /> : <p className="dashboard-note">Needs backend source</p>}</div>
      </div>
    </section>
  );
}

export function NetworkDetailsSection(props: {
  totalCost: string;
  totalUsage: string;
  rows: NetworkRow[];
  chartOption: EChartsOption;
  dominantInsight: string | null;
  formatCurrency: (value: number | null | undefined) => string;
  formatPercent: (value: number | null | undefined) => string;
  formatNumber: (value: number | null | undefined) => string;
}) {
  return (
    <section id="network" className="ec2-instance-detail__panel">
      <h3>Network Details</h3>
      <div className="ec2-instance-detail__kpis ec2-instance-detail__kpis--compact">
        <div className="ec2-instance-detail__kpi"><span>Total Network Cost</span><strong>{props.totalCost}</strong></div>
        <div className="ec2-instance-detail__kpi"><span>Total Network Usage</span><strong>{props.totalUsage}</strong></div>
      </div>
      {props.rows.length > 1 ? <div className="ec2-instance-detail__network-chart"><BaseEChart option={props.chartOption} height={280} /></div> : null}
      {props.dominantInsight ? <p className="dashboard-note">{props.dominantInsight}</p> : null}
      <table className="ec2-instance-detail__simple-table">
        <thead><tr><th>Type</th><th>Cost</th><th>% of Network</th><th>Usage (GB)</th></tr></thead>
        <tbody>
          {props.rows.map((row, index) => (
            <tr key={`${row.type}-${index}`}>
              <td>{row.type}</td><td>{props.formatCurrency(row.cost)}</td><td>{props.formatPercent(row.percentage)}</td><td>{props.formatNumber(row.usageGb)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function MetadataSection(props: {
  values: Array<{ label: string; value: string }>;
  metadataRows: Array<{ key: string; value: string }>;
}) {
  return (
    <section id="metadata" className="ec2-instance-detail__panel">
      <h3>Metadata</h3>
      <div className="ec2-instance-detail__meta-grid">
        {props.values.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>)}
      </div>
      <table className="ec2-instance-detail__simple-table">
        <thead><tr><th>Tag</th><th>Value</th></tr></thead>
        <tbody>
          {props.metadataRows.length === 0 ? <tr><td colSpan={2}>No tags available</td></tr> : null}
          {props.metadataRows.map((row) => <tr key={row.key}><td>{row.key}</td><td>{row.value}</td></tr>)}
        </tbody>
      </table>
    </section>
  );
}

export function StickySectionNav(props: { showNetwork: boolean }) {
  return (
    <nav className="ec2-instance-detail__sticky-nav" aria-label="Instance detail sections">
      <a href="#summary">Summary</a>
      <a href="#actions">Actions</a>
      <a href="#cost-drivers">Cost Drivers</a>
      <a href="#performance">Performance</a>
      {props.showNetwork ? <a href="#network">Network</a> : null}
      <a href="#metadata">Metadata</a>
    </nav>
  );
}

export const networkBreakdownColorAt = (index: number): string => NETWORK_BREAKDOWN_COLORS[index % NETWORK_BREAKDOWN_COLORS.length];

export const volumeColumnsFactory = (
  formatSize: (value: number | null | undefined) => string,
  formatCurrency: (value: number | null | undefined) => string,
  formatNumber: (value: number | null | undefined) => string,
  toTitle: (value: string) => string,
): ColDef<AttachedVolume>[] => [
  { headerName: "Volume", field: "volumeId", minWidth: 190 },
  { headerName: "Size", field: "sizeGb", minWidth: 110, valueFormatter: (p: ValueFormatterParams<AttachedVolume, number | null | undefined>) => formatSize(p.value) },
  { headerName: "Type", field: "volumeType", minWidth: 100, valueFormatter: (p) => p.value ?? "-" },
  { headerName: "Cost", field: "cost", minWidth: 110, valueFormatter: (p) => formatCurrency(p.value as number | null | undefined) },
  { headerName: "State", field: "state", minWidth: 110, valueFormatter: (p) => (p.value ? toTitle(String(p.value)) : "-") },
  { headerName: "IOPS", field: "iops", minWidth: 100, valueFormatter: (p) => formatNumber(p.value as number | null | undefined) },
  { headerName: "Throughput", field: "throughput", minWidth: 120, valueFormatter: (p) => formatNumber(p.value as number | null | undefined) },
  { headerName: "Attached Since", field: "attachedSince", minWidth: 170, valueFormatter: (p) => (typeof p.value === "string" ? new Date(p.value).toLocaleDateString("en-US") : "-") },
];
