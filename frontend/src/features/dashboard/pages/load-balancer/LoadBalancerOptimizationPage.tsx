import { Check, ChevronDown, Filter, RotateCcw, Search } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { ColDef } from "ag-grid-community";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { dashboardApi } from "../../api/dashboardApi";
import type { Ec2RecommendationRecord, Ec2RecommendationStatus, Ec2RecommendationType } from "../../api/dashboardTypes";
import { BaseDataTable } from "../../common/tables/BaseDataTable";
import { useEc2RecommendationsQuery } from "../../hooks/useDashboardQueries";
import { useDashboardScope } from "../../hooks/useDashboardScope";
import { formatRecommendationEvidence } from "../ec2/components/recommendationEvidence";
import { useInventoryLoadBalancerDetail } from "@/features/client-home/hooks/useInventoryLoadBalancers";

type MainTab = "overview" | "recommendations";
type RecommendationsFilterKey = "category" | "issueType" | "status" | "severity";
type FilterOption = { key: string; label: string };

const LIST_PATH = "/dashboard/inventory/aws/load-balancer/list";
const EXPLORER_PATH = "/dashboard/load-balancer/explorer";

const MAIN_TABS: Array<{ key: MainTab; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "recommendations", label: "Recommendations" },
];

const CURRENCY_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const LB_COST_TYPES = new Set<Ec2RecommendationType>(["idle_load_balancer", "low_traffic_load_balancer", "high_data_processing_cost"]);
const LB_RELIABILITY_TYPES = new Set<Ec2RecommendationType>(["unhealthy_targets", "high_error_rate"]);

const toTitle = (value: string): string =>
  value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

const formatCurrency = (value: number | null | undefined): string =>
  value === null || typeof value === "undefined" || !Number.isFinite(value) ? "-" : CURRENCY_FORMATTER.format(value);

const typeLabel = (value: Ec2RecommendationType): string => {
  if (value === "idle_load_balancer") return "Idle Load Balancer";
  if (value === "low_traffic_load_balancer") return "Low Traffic Load Balancer";
  if (value === "unhealthy_targets") return "Unhealthy Targets";
  if (value === "high_error_rate") return "High Error Rate";
  if (value === "high_data_processing_cost") return "High Data Processing Cost";
  return toTitle(value);
};

const whyThisMatters = (type: Ec2RecommendationType): string => {
  if (type === "idle_load_balancer" || type === "low_traffic_load_balancer") {
    return "This load balancer appears underused, so you may be paying for capacity that provides little value.";
  }
  if (type === "high_error_rate") {
    return "Elevated error rates can impact customer experience, request success, and overall reliability.";
  }
  if (type === "unhealthy_targets") {
    return "Unhealthy targets reduce service availability and can cause traffic routing failures or degraded performance.";
  }
  if (type === "high_data_processing_cost") {
    return "Data processing costs can dominate spend at scale, so optimizing traffic patterns can reduce monthly cost.";
  }
  return "This recommendation may improve reliability, efficiency, or cost posture for this load balancer.";
};

const statusLabel = (value: Ec2RecommendationStatus): string => (value === "in_progress" ? "In Progress" : toTitle(value));

const statusBadgeClassName = (status: Ec2RecommendationStatus): string => {
  if (status === "open") return "is-status-open";
  if (status === "in_progress") return "is-status-in-progress";
  if (status === "snoozed") return "is-status-snoozed";
  if (status === "dismissed") return "is-status-dismissed";
  return "is-status-completed";
};

function FilterDropdown({ label, selected, options, isOpen, onToggle, onSelect }: { label: string; selected: string; options: FilterOption[]; isOpen: boolean; onToggle: () => void; onSelect: (key: string) => void; }) {
  const selectedLabel = options.find((option) => option.key === selected)?.label ?? (selected !== "all" ? toTitle(selected) : "All");
  return (
    <div className="cost-explorer-toolbar-item">
      <button type="button" className={`cost-explorer-toolbar-trigger${isOpen ? " is-active" : ""}`} onClick={onToggle}>
        <span className="cost-explorer-toolbar-trigger__label">{label}</span>
        <span className="cost-explorer-toolbar-trigger__row">
          <span className="cost-explorer-toolbar-trigger__value">{selectedLabel}</span>
          <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
        </span>
      </button>
      {isOpen ? (
        <div className="cost-explorer-filter-popover ec2-explorer-filter-popover" role="dialog">
          <div className="cost-explorer-filter-popover__list" role="listbox">
            {options.map((option) => {
              const active = option.key === selected;
              return (
                <button key={option.key} type="button" className={`cost-explorer-filter-option${active ? " is-active" : ""}`} onClick={() => onSelect(option.key)}>
                  <span>{option.label}</span>
                  {active ? <Check size={14} aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status: Ec2RecommendationStatus }) {
  return <span className={`optimization-rightsizing-pill ${statusBadgeClassName(status)}`}>{statusLabel(status)}</span>;
}

export default function LoadBalancerOptimizationPage() {
  const { scope } = useDashboardScope();
  const navigate = useNavigate();
  const location = useLocation();

  const [activeTab, setActiveTab] = useState<MainTab>("overview");
  const [activeDropdown, setActiveDropdown] = useState<RecommendationsFilterKey | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [issueTypeFilter, setIssueTypeFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [searchFilter, setSearchFilter] = useState("");
  const [statusOverrides, setStatusOverrides] = useState<Record<number, Ec2RecommendationStatus>>({});
  const [pendingRecommendationId, setPendingRecommendationId] = useState<number | null>(null);
  const [selectedRecommendation, setSelectedRecommendation] = useState<Ec2RecommendationRecord | null>(null);
  const [selectedDetailStatus, setSelectedDetailStatus] = useState<Ec2RecommendationStatus>("open");

  const deferredSearchFilter = useDeferredValue(searchFilter);
  const query = useEc2RecommendationsQuery({ service: "load_balancer", resourceType: "load_balancer" });
  const detailQuery = useInventoryLoadBalancerDetail(selectedRecommendation?.resourceId ?? null);

  const allRows = useMemo(() => {
    const data = query.data?.recommendations;
    if (!data) return [];
    return [...data.compute, ...data.storage, ...data.pricing, ...data.network].filter((row) => row.resourceType === "load_balancer");
  }, [query.data]);

  const recommendationFilterOptions = useMemo(() => {
    const issueTypes = Array.from(new Set(allRows.map((item) => item.type))).sort();
    return {
      categories: [{ key: "all", label: "All" }, { key: "cost_optimization", label: "Cost Optimization" }, { key: "reliability", label: "Reliability" }],
      issueTypes: [{ key: "all", label: "All" }, ...issueTypes.map((type) => ({ key: type, label: typeLabel(type as Ec2RecommendationType) }))],
      severity: [{ key: "all", label: "All" }, { key: "low", label: "Low" }, { key: "medium", label: "Medium" }, { key: "high", label: "High" }],
    };
  }, [allRows]);

  const filteredRecommendations = useMemo(() => allRows.filter((item) => {
    const status = statusOverrides[item.id] ?? item.status ?? "open";
    if (statusFilter === "active" && status !== "open" && status !== "in_progress") return false;
    if (statusFilter !== "active" && statusFilter !== "all" && status !== statusFilter) return false;
    if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
    if (issueTypeFilter !== "all" && item.type !== issueTypeFilter) return false;
    if (severityFilter !== "all" && item.risk !== severityFilter) return false;
    const text = deferredSearchFilter.trim().toLowerCase();
    if (!text) return true;
    return [item.resourceName, item.resourceId, item.type, item.category, item.action].join(" ").toLowerCase().includes(text);
  }), [allRows, categoryFilter, issueTypeFilter, severityFilter, statusFilter, statusOverrides, deferredSearchFilter]);

  const totalSavings = useMemo(() => allRows.reduce((sum, row) => sum + (row.estimatedMonthlySaving || 0), 0), [allRows]);
  const costOptimizationSavings = useMemo(() => allRows.filter((row) => LB_COST_TYPES.has(row.type)).reduce((sum, row) => sum + (row.estimatedMonthlySaving || 0), 0), [allRows]);
  const reliabilityIssues = useMemo(() => allRows.filter((row) => LB_RELIABILITY_TYPES.has(row.type)).length, [allRows]);

  const unifiedCols = useMemo<ColDef<Ec2RecommendationRecord>[]>(() => [
    { headerName: "Resource", field: "resourceName", minWidth: 190 },
    { headerName: "Category", valueGetter: (p) => toTitle(p.data?.category ?? "-"), minWidth: 170 },
    { headerName: "Issue Type", valueGetter: (p) => typeLabel((p.data?.type ?? "idle_load_balancer") as Ec2RecommendationType), minWidth: 170 },
    { headerName: "Evidence Summary", valueGetter: (p) => p.data ? formatRecommendationEvidence(p.data.type, p.data.evidence).summary : "-", minWidth: 240 },
    { headerName: "Recommended Action", valueGetter: (p) => p.data?.action ?? "-", minWidth: 240 },
    { headerName: "Saving", valueGetter: (p) => formatCurrency(p.data?.estimatedMonthlySaving), minWidth: 120, maxWidth: 140 },
    { headerName: "Status", maxWidth: 140, cellRenderer: (p: { data?: Ec2RecommendationRecord }) => p.data ? <StatusBadge status={(statusOverrides[p.data.id] ?? p.data.status ?? "open") as Ec2RecommendationStatus} /> : null },
  ], [statusOverrides]);

  const selectedStatus = selectedRecommendation ? (statusOverrides[selectedRecommendation.id] ?? selectedRecommendation.status ?? "open") : "open";
  const selectedEvidence = selectedRecommendation ? formatRecommendationEvidence(selectedRecommendation.type, selectedRecommendation.evidence) : null;

  const applyStatusUpdate = async () => {
    if (!scope || !selectedRecommendation) return;
    setPendingRecommendationId(selectedRecommendation.id);
    setStatusOverrides((prev) => ({ ...prev, [selectedRecommendation.id]: selectedDetailStatus }));
    try {
      await dashboardApi.updateEc2RecommendationStatus(scope, selectedRecommendation.id, { status: selectedDetailStatus });
      void query.refetch();
    } finally {
      setPendingRecommendationId(null);
    }
  };

  return (
    <div className="dashboard-page optimization-page">
      <div className="optimization-header-shell">
        <div className="optimization-header-tabs" role="tablist" aria-label="Load Balancer Optimization sections">
          {MAIN_TABS.map((tab) => (
            <button key={tab.key} type="button" className={`optimization-header-tab ${activeTab === tab.key ? "is-active" : ""}`} onClick={() => setActiveTab(tab.key)} role="tab" aria-selected={activeTab === tab.key}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "overview" ? (
        <section className="dashboard-widget-shell">
          <div className="dashboard-widget-shell__body optimization-tab-body">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <article className="optimization-verified-item"><p className="optimization-overview-insight-item__title">Total Potential Savings</p><p className="optimization-overview-insight-item__value">{formatCurrency(totalSavings)}</p></article>
              <article className="optimization-verified-item"><p className="optimization-overview-insight-item__title">Cost Optimization Savings</p><p className="optimization-overview-insight-item__value">{formatCurrency(costOptimizationSavings)}</p></article>
              <article className="optimization-verified-item"><p className="optimization-overview-insight-item__title">Reliability Issues</p><p className="optimization-overview-insight-item__value">{reliabilityIssues}</p></article>
              <article className="optimization-verified-item"><p className="optimization-overview-insight-item__title">Total Recommendations</p><p className="optimization-overview-insight-item__value">{allRows.length}</p></article>
            </div>
            <div className="mt-4">
              <button type="button" className="optimization-overview-nav-link cost-explorer-chip-bar__clear cost-explorer-chip-bar__clear--inline" onClick={() => setActiveTab("recommendations")}>View All Recommendations</button>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "recommendations" ? (
        <section className="dashboard-widget-shell">
          <div className="dashboard-widget-shell__body optimization-tab-body">
            <div className="cost-explorer-toolbar-row ec2-explorer-toolbar-row--primary">
              <div className="cost-explorer-toolbar-item"><button type="button" className="cost-explorer-toolbar-trigger"><span className="cost-explorer-toolbar-trigger__row"><span className="cost-explorer-toolbar-trigger__value">Filters</span><Filter className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" /></span></button></div>
              <FilterDropdown label="Category" selected={categoryFilter} options={recommendationFilterOptions.categories} isOpen={activeDropdown === "category"} onToggle={() => setActiveDropdown((v) => (v === "category" ? null : "category"))} onSelect={(key) => { setCategoryFilter(key); setActiveDropdown(null); }} />
              <FilterDropdown label="Issue Type" selected={issueTypeFilter} options={recommendationFilterOptions.issueTypes} isOpen={activeDropdown === "issueType"} onToggle={() => setActiveDropdown((v) => (v === "issueType" ? null : "issueType"))} onSelect={(key) => { setIssueTypeFilter(key); setActiveDropdown(null); }} />
              <FilterDropdown label="Status" selected={statusFilter} options={[{ key: "active", label: "Open + In Progress" }, { key: "open", label: "Open" }, { key: "in_progress", label: "In Progress" }, { key: "snoozed", label: "Snoozed" }, { key: "dismissed", label: "Dismissed" }, { key: "completed", label: "Completed" }, { key: "all", label: "All" }]} isOpen={activeDropdown === "status"} onToggle={() => setActiveDropdown((v) => (v === "status" ? null : "status"))} onSelect={(key) => { setStatusFilter(key); setActiveDropdown(null); }} />
              <FilterDropdown label="Severity" selected={severityFilter} options={recommendationFilterOptions.severity} isOpen={activeDropdown === "severity"} onToggle={() => setActiveDropdown((v) => (v === "severity" ? null : "severity"))} onSelect={(key) => { setSeverityFilter(key); setActiveDropdown(null); }} />
              <div className="cost-explorer-toolbar-item"><label className="cost-explorer-toolbar-trigger ec2-instances-search-trigger"><span className="ec2-instances-search-trigger__icon-wrap" aria-hidden="true"><Search size={14} /></span><input type="search" value={searchFilter} onChange={(event) => setSearchFilter(event.target.value)} placeholder="Search recommendations" aria-label="Search recommendations" className="ec2-instances-search-trigger__input" /></label></div>
              <div className="cost-explorer-toolbar-item"><button type="button" className="cost-explorer-toolbar-trigger ec2-instances-toolbar-icon-trigger" onClick={() => { setCategoryFilter("all"); setIssueTypeFilter("all"); setStatusFilter("active"); setSeverityFilter("all"); setSearchFilter(""); setActiveDropdown(null); }} aria-label="Reset recommendation filters" title="Reset recommendation filters"><span className="cost-explorer-toolbar-trigger__row ec2-instances-toolbar-icon-trigger__row"><RotateCcw size={14} /></span></button></div>
            </div>
            <BaseDataTable columnDefs={unifiedCols} rowData={filteredRecommendations} pagination paginationPageSize={10} autoHeight emptyMessage="No recommendations found" onRowClick={(row) => { setSelectedRecommendation(row); setSelectedDetailStatus((statusOverrides[row.id] ?? row.status ?? "open") as Ec2RecommendationStatus); }} />
          </div>
        </section>
      ) : null}

      <Dialog open={Boolean(selectedRecommendation)} onOpenChange={(open) => { if (!open) setSelectedRecommendation(null); }}>
        <DialogContent className="optimization-recommendation-drawer lb-optimization-recommendation-drawer left-auto right-0 top-0 flex h-screen max-h-screen w-[min(100vw,40rem)] max-w-none -translate-x-0 -translate-y-0 flex-col rounded-none border-l border-[color:var(--border-light)] p-0 data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100">
          {selectedRecommendation ? (
            <>
              <DialogHeader className="optimization-drawer-header">
                <div className="optimization-drawer-title-row">
                  <DialogTitle className="optimization-drawer-title">{typeLabel(selectedRecommendation.type)}</DialogTitle>
                  <StatusBadge status={selectedStatus as Ec2RecommendationStatus} />
                </div>
                <div className="optimization-drawer-subtitle"><span className="font-mono">{selectedRecommendation.resourceName || selectedRecommendation.resourceId}</span></div>
              </DialogHeader>
              <div className="optimization-drawer-body">
                <section className="optimization-drawer-section">
                  <h3>Header</h3>
                  <dl className="optimization-drawer-evidence">
                    <div className="optimization-drawer-evidence__row"><dt>Issue Type</dt><dd>{typeLabel(selectedRecommendation.type)}</dd></div>
                    <div className="optimization-drawer-evidence__row"><dt>Resource Name</dt><dd>{selectedRecommendation.resourceName || selectedRecommendation.resourceId}</dd></div>
                    <div className="optimization-drawer-evidence__row"><dt>Status</dt><dd>{statusLabel(selectedStatus as Ec2RecommendationStatus)}</dd></div>
                    <div className="optimization-drawer-evidence__row"><dt>Severity</dt><dd>{toTitle(selectedRecommendation.risk)}</dd></div>
                    <div className="optimization-drawer-evidence__row"><dt>Estimated Monthly Savings</dt><dd>{formatCurrency(selectedRecommendation.estimatedMonthlySaving)}</dd></div>
                  </dl>
                </section>

                <section className="optimization-drawer-section">
                  <h3>Resource Context</h3>
                  {detailQuery.data ? (
                    <dl className="optimization-drawer-evidence">
                      <div className="optimization-drawer-evidence__row"><dt>Load Balancer Name</dt><dd>{detailQuery.data.name}</dd></div>
                      <div className="optimization-drawer-evidence__row"><dt>ARN</dt><dd className="break-all">{detailQuery.data.arn ?? "-"}</dd></div>
                      <div className="optimization-drawer-evidence__row"><dt>Type</dt><dd>{detailQuery.data.type ?? "-"}</dd></div>
                      <div className="optimization-drawer-evidence__row"><dt>Scheme</dt><dd>{detailQuery.data.scheme ?? "-"}</dd></div>
                      <div className="optimization-drawer-evidence__row"><dt>Region</dt><dd>{detailQuery.data.region ?? selectedRecommendation.region ?? "-"}</dd></div>
                      <div className="optimization-drawer-evidence__row"><dt>Account</dt><dd>{detailQuery.data.accountId ?? selectedRecommendation.accountId ?? "-"}</dd></div>
                      <div className="optimization-drawer-evidence__row"><dt>State</dt><dd>{detailQuery.data.state ?? "-"}</dd></div>
                    </dl>
                  ) : <p>{detailQuery.isLoading ? "Loading load balancer context..." : "Load balancer context unavailable."}</p>}
                </section>

                <section className="optimization-drawer-section">
                  <h3>Evidence</h3>
                  {selectedEvidence?.rows?.length ? (
                    <dl className="optimization-drawer-evidence">
                      {selectedEvidence.rows.map((row) => (
                        <div className="optimization-drawer-evidence__row" key={row.key}><dt>{row.label}</dt><dd>{row.value}</dd></div>
                      ))}
                    </dl>
                  ) : <p>{selectedRecommendation.evidence || "No evidence available."}</p>}
                  <div className="optimization-drawer-callout mt-3">{selectedRecommendation.evidence}</div>
                </section>

                <section className="optimization-drawer-section">
                  <h3>Recommended Action</h3>
                  <div className="optimization-drawer-callout">{selectedRecommendation.action}</div>
                </section>

                <section className="optimization-drawer-section">
                  <h3>Why this matters</h3>
                  <p>{whyThisMatters(selectedRecommendation.type)}</p>
                </section>

                <section className="optimization-drawer-section">
                  <h3>Lifecycle / Status</h3>
                  <div className="flex gap-2 items-center mb-3">
                    <select value={selectedDetailStatus} onChange={(e) => setSelectedDetailStatus(e.target.value as Ec2RecommendationStatus)} className="dashboard-header-field__control">
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="snoozed">Snoozed</option>
                      <option value="dismissed">Dismissed</option>
                      <option value="completed">Completed</option>
                    </select>
                    <button type="button" className="optimization-drawer-action optimization-drawer-action--primary" disabled={pendingRecommendationId === selectedRecommendation.id} onClick={applyStatusUpdate}>Update Status</button>
                  </div>
                  <dl className="optimization-drawer-evidence">
                    <div className="optimization-drawer-evidence__row"><dt>Detected At</dt><dd>{selectedRecommendation.detectedAt ?? "-"}</dd></div>
                    <div className="optimization-drawer-evidence__row"><dt>Last Seen At</dt><dd>{selectedRecommendation.lastSeenAt ?? "-"}</dd></div>
                    <div className="optimization-drawer-evidence__row"><dt>Status Reason</dt><dd>{selectedRecommendation.statusReason ?? "-"}</dd></div>
                  </dl>
                </section>

                <section className="optimization-drawer-section">
                  <h3>Related links/actions</h3>
                  <div className="optimization-drawer-footer__actions">
                    <button type="button" className="optimization-drawer-action" onClick={() => navigate({ pathname: `${LIST_PATH}/${encodeURIComponent(selectedRecommendation.resourceId)}`, search: new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(location.search)), loadBalancerName: selectedRecommendation.resourceName || selectedRecommendation.resourceId }).toString() })}>View Load Balancer Detail</button>
                    <button type="button" className="optimization-drawer-action" onClick={() => navigate({ pathname: EXPLORER_PATH, search: new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(location.search)), groupBy: "load_balancer", groupValues: selectedRecommendation.resourceId }).toString() })}>View in Explorer filtered by this load balancer</button>
                    <button type="button" className="optimization-drawer-action" onClick={() => setSelectedRecommendation(null)}>Close</button>
                  </div>
                </section>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
