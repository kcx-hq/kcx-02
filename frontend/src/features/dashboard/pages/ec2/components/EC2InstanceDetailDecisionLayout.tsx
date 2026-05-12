import { useEffect, useState } from "react";
import type { EChartsOption } from "echarts";
import type { ColDef, ValueFormatterParams } from "ag-grid-community";
import type { InventoryEc2InstanceDetailResponse } from "@/features/client-home/api/inventory-instances.api";
import type { EvidenceItem } from "./recommendationEvidence";

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
  issueTitle: string;
  issueDescription: string;
  riskLevel: string;
  metrics: Array<{ label: string; value: string }>;
  primaryEvidence: EvidenceItem[];
  primaryAction: string;
  showOpportunity: boolean;
  onViewActions: () => void;
  investigateLabel: string;
  onInvestigate: () => void;
  onOpenActionCenter: () => void;
}) {
  return (
    <section id="summary" className="ec2-instance-detail__panel ec2-instance-detail__summary-card">
      <div className="ec2-instance-detail__summary-head">
        <span className={`ec2-instance-detail__status-pill ec2-instance-detail__status-pill--${props.status.toLowerCase().replaceAll(" ", "-")}`}>
          {props.status}
        </span>
        <div className="ec2-instance-detail__cta-row">
          <button type="button" className="cost-explorer-state-btn" onClick={props.onViewActions}>View Recommended Actions</button>
          <button type="button" className="cost-explorer-state-btn" onClick={props.onInvestigate}>{props.investigateLabel}</button>
          <button type="button" className="cost-explorer-state-btn" onClick={props.onOpenActionCenter}>Open in Action Center</button>
        </div>
      </div>
      <h2 className="ec2-instance-detail__hero-title">{props.issueTitle}</h2>
      <p className="ec2-instance-detail__hero-desc">{props.issueDescription}</p>
      <div className="ec2-instance-detail__summary-grid">
        {props.metrics.map((item) => (
          <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>
        ))}
      </div>
      {props.showOpportunity ? (
        <div className="ec2-instance-detail__insight ec2-instance-detail__insight--warn">
          <strong>Primary Evidence</strong>
          <table className="ec2-instance-detail__simple-table">
            <tbody>
              {props.primaryEvidence.slice(0, 4).map((item) => (
                <tr key={`${item.label}-${item.value}`}><td>{item.label}</td><td><strong>{item.value}</strong></td></tr>
              ))}
            </tbody>
          </table>
          <strong>Primary Recommended Action</strong>
          <span>{props.primaryAction}</span>
        </div>
      ) : (
        <div className="ec2-instance-detail__insight ec2-instance-detail__insight--good">
          <strong>No active optimization opportunity found for this instance.</strong>
        </div>
      )}
      <div className="ec2-instance-detail__risk-line"><strong>Risk Level:</strong> {props.riskLevel}</div>
    </section>
  );
}

export function RecommendationCard(props: {
  recommendation: Recommendation;
  isHighlighted: boolean;
  onActionClick: (item: Recommendation) => void;
  formatCurrency: (value: number | null | undefined) => string;
  toTitle: (value: string) => string;
  recommendationTypeLabel: (value: string) => string;
  evidenceBullets: EvidenceItem[];
  actionBullets: string[];
  onStatusChange: (item: Recommendation, nextStatus: "open" | "in_progress" | "snoozed" | "dismissed" | "completed") => void;
  isStatusUpdating?: boolean;
}) {
  const { recommendation, onActionClick, formatCurrency, toTitle, recommendationTypeLabel } = props;
  return (
    <article className={`ec2-instance-detail__recommendation-card${props.isHighlighted ? " is-highlighted" : ""}`}>
      <header>
        <h4>{recommendationTypeLabel(recommendation.type)}</h4>
        <span>{toTitle(recommendation.category)}</span>
      </header>
      <div className="ec2-instance-detail__recommendation-body">
        <p><strong>Why this matters:</strong> {recommendation.problem}</p>
        <strong>Evidence</strong>
        <ul className="ec2-instance-detail__bullets">{props.evidenceBullets.map((item) => <li key={`${item.label}-${item.value}`}>{item.label}: <strong>{item.value}</strong></li>)}</ul>
        <strong>Recommended actions</strong>
        <ul className="ec2-instance-detail__bullets">{props.actionBullets.map((item) => <li key={item}>{item}</li>)}</ul>
      </div>
      <div className="ec2-instance-detail__recommendation-meta">
        <span><strong>Savings:</strong> {formatCurrency(recommendation.saving)}/month</span>
        <span><strong>Risk:</strong> {toTitle(recommendation.risk)}</span>
        <span><strong>Status:</strong> {toTitle(recommendation.status)}</span>
      </div>
      <select
        data-stop-row-click="true"
        disabled={props.isStatusUpdating}
        defaultValue=""
        onChange={(event) => {
          const value = event.target.value as "open" | "in_progress" | "snoozed" | "dismissed" | "completed";
          if (!value) return;
          props.onStatusChange(recommendation, value);
          event.target.value = "";
        }}
      >
        <option value="">Update Status</option>
        <option value="in_progress">Mark In Progress</option>
        <option value="snoozed">Snooze</option>
        <option value="dismissed">Dismiss</option>
        <option value="completed">Mark Completed</option>
        <option value="open">Reopen</option>
      </select>
      <button type="button" className="cost-explorer-state-btn" onClick={() => onActionClick(recommendation)}>Open in Action Center</button>
    </article>
  );
}

export function KeySignalsGrid(props: { items: Array<{ label: string; value: string }>; showTitle?: boolean }) {
  return (
    <section className="ec2-instance-detail__panel">
      {props.showTitle === false ? null : <h3>Key Signals</h3>}
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
  dominantLabel: string;
  dominantPct: string;
  formatCurrency: (value: number | null | undefined) => string;
  formatPercent: (value: number | null | undefined) => string;
  showTitle?: boolean;
}) {
  return (
    <section className="ec2-instance-detail__panel">
      {props.showTitle === false ? null : <h3>Cost Drivers</h3>}
      <div className="ec2-instance-detail__summary-line">
        <span>Total Cost: <strong>{props.totalCost}</strong></span>
      </div>
      <table className="ec2-instance-detail__simple-table">
        <thead><tr><th>Component</th><th>Cost</th><th>% of Total</th></tr></thead>
        <tbody>
          {props.costRows.map((row) => (
            <tr key={row.type}><td>{row.type}</td><td>{props.formatCurrency(row.cost)}</td><td>{props.formatPercent(row.pct)}</td></tr>
          ))}
        </tbody>
      </table>
      <div className="ec2-instance-detail__insight ec2-instance-detail__insight--warn">
        <strong>{props.dominantLabel} is the dominant cost driver.</strong>
        <span>{props.dominantLabel} accounts for {props.dominantPct} of total cost.</span>
      </div>
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
  insight: string | null;
  showTitle?: boolean;
}) {
  return (
    <section className="ec2-instance-detail__panel">
      {props.showTitle === false ? null : <h3>Performance</h3>}
      {props.insight ? <div className="ec2-instance-detail__insight ec2-instance-detail__insight--warn"><strong>{props.insight}</strong></div> : null}
      <div className="ec2-instance-detail__kpis ec2-instance-detail__kpis--compact">
        <div className="ec2-instance-detail__kpi"><span>Avg CPU</span><strong>{props.avgCpu}</strong></div>
        <div className="ec2-instance-detail__kpi"><span>Max CPU</span><strong>{props.maxCpu}</strong></div>
        <div className="ec2-instance-detail__kpi"><span>Network In</span><strong>{props.networkIn}</strong></div>
        <div className="ec2-instance-detail__kpi"><span>Network Out</span><strong>{props.networkOut}</strong></div>
      </div>
      <div className="ec2-instance-detail__charts2">
        <div><h4>CPU Trend</h4>{props.hasCpuTrend ? <BaseEChart option={props.cpuOption} height={260} /> : <p className="dashboard-note">Needs backend source for performance trend.</p>}</div>
        <div><h4>Network In/Out Trend</h4>{props.hasNetworkTrend ? <BaseEChart option={props.networkOption} height={260} /> : <p className="dashboard-note">Needs backend source for performance trend.</p>}</div>
      </div>
    </section>
  );
}

export function NetworkDetailsSection(props: {
  totalCost: string;
  totalUsage: string;
  internetCost: string;
  internetUsage: string;
  interAzCost: string;
  interAzUsage: string;
  rows: Array<NetworkRow & { reason: string }>;
  chartOption: EChartsOption;
  dominantInsight: string | null;
  whatToCheck: string[];
  hasBreakdown: boolean;
  formatCurrency: (value: number | null | undefined) => string;
  formatPercent: (value: number | null | undefined) => string;
  formatNumber: (value: number | null | undefined) => string;
  showTitle?: boolean;
}) {
  return (
    <section className="ec2-instance-detail__panel">
      {props.showTitle === false ? null : <h3>Network Evidence</h3>}
      <div className="ec2-instance-detail__kpis ec2-instance-detail__kpis--compact">
        <div className="ec2-instance-detail__kpi"><span>Total Network Cost</span><strong>{props.totalCost}</strong></div>
        <div className="ec2-instance-detail__kpi"><span>Total Data Transfer Usage</span><strong>{props.totalUsage}</strong></div>
        <div className="ec2-instance-detail__kpi"><span>Internet Data Transfer Cost</span><strong>{props.internetCost}</strong></div>
        <div className="ec2-instance-detail__kpi"><span>Internet Data Transfer Usage</span><strong>{props.internetUsage}</strong></div>
        <div className="ec2-instance-detail__kpi"><span>Inter-AZ Cost</span><strong>{props.interAzCost}</strong></div>
        <div className="ec2-instance-detail__kpi"><span>Inter-AZ Usage</span><strong>{props.interAzUsage}</strong></div>
      </div>
      {props.dominantInsight ? <div className="ec2-instance-detail__insight ec2-instance-detail__insight--warn"><strong>{props.dominantInsight}</strong></div> : null}
      {props.hasBreakdown ? <div className="ec2-instance-detail__network-chart"><BaseEChart option={props.chartOption} height={280} /></div> : <p className="dashboard-note">Needs backend source for network transfer breakdown.</p>}
      <table className="ec2-instance-detail__simple-table">
        <thead><tr><th>Transfer Type</th><th>Cost</th><th>% of Network Cost</th><th>Usage GB</th><th>Evidence / Reason</th></tr></thead>
        <tbody>
          {props.rows.map((row, index) => (
            <tr key={`${row.type}-${index}`}>
              <td>{row.type}</td><td>{props.formatCurrency(row.cost)}</td><td>{props.formatPercent(row.percentage)}</td><td>{props.formatNumber(row.usageGb)}</td><td>{row.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {props.whatToCheck.length > 0 ? (
        <div className="ec2-instance-detail__insight ec2-instance-detail__insight--good">
          <strong>What to check</strong>
          <ul className="ec2-instance-detail__bullets">{props.whatToCheck.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      ) : null}
    </section>
  );
}

export function StorageSection(props: {
  attachedVolumes: AttachedVolume[];
  storageColumns: ColDef<AttachedVolume>[];
  showDominantBanner: boolean;
  onVolumeRowClick: (row: AttachedVolume) => void;
  showTitle?: boolean;
}) {
  return (
    <section className="ec2-instance-detail__panel">
      {props.showTitle === false ? null : <h3>Storage</h3>}
      {props.showDominantBanner ? <div className="ec2-instance-detail__insight ec2-instance-detail__insight--warn"><strong>Storage is the dominant cost driver for this instance.</strong></div> : null}
      {props.attachedVolumes.length === 0 ? <p className="dashboard-note">No attached volumes found for this instance.</p> : (
        <BaseDataTable
          columnDefs={props.storageColumns}
          rowData={props.attachedVolumes}
          autoHeight
          pagination
          paginationPageSize={10}
          onRowClick={props.onVolumeRowClick}
        />
      )}
    </section>
  );
}

export function MetadataSection(props: {
  values: Array<{ label: string; value: string }>;
  metadataRows: Array<{ key: string; value: string }>;
  showTitle?: boolean;
}) {
  return (
    <section className="ec2-instance-detail__panel">
      {props.showTitle === false ? null : <h3>Metadata</h3>}
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

export function StickySectionNav(props: { sections: Array<{ id: string; label: string }>; onNavigate?: (id: string) => void }) {
  const [activeId, setActiveId] = useState<string>(props.sections[0]?.id ?? "summary");

  useEffect(() => {
    const onScroll = () => {
      const candidates = props.sections
        .map((section) => ({ section, element: document.getElementById(section.id) }))
        .filter((item): item is { section: { id: string; label: string }; element: HTMLElement } => item.element instanceof HTMLElement)
        .map((item) => ({ ...item, top: item.element.getBoundingClientRect().top }));

      const visible = candidates.filter((item) => item.top <= 150);
      const next = (visible.length > 0 ? visible[visible.length - 1] : candidates[0])?.section.id;
      if (next) setActiveId(next);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [props.sections]);

  return (
    <nav className="ec2-instance-detail__sticky-nav" aria-label="Instance detail sections">
      {props.sections.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          className={activeId === section.id ? "is-active" : undefined}
          onClick={(event) => {
            if (!props.onNavigate) return;
            event.preventDefault();
            props.onNavigate(section.id);
          }}
        >
          {section.label}
        </a>
      ))}
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

export const splitBullets = (input: string | null | undefined): string[] => {
  const base = typeof input === "string" ? input : "";
  const chunks = base
    .split(/\n|;|\.|\|/g)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (chunks.length === 0 && base.trim().length > 0) return [base.trim()];
  return chunks.slice(0, 6);
};

