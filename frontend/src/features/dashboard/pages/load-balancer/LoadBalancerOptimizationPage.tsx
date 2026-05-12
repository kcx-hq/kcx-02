import { Check, ChevronDown, Filter, RotateCcw, Search, X } from "lucide-react";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useLocation, useNavigate } from "react-router-dom";

import type { ColDef } from "ag-grid-community";



import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

type StatusAction = { label: string; status?: Ec2RecommendationStatus; kind?: "details" };



const LIST_PATH = "/dashboard/inventory/aws/load-balancer/list";

const EXPLORER_PATH = "/dashboard/load-balancer/explorer";

const normalizeFilterValue = (value: string | null | undefined): string =>
  typeof value === "string" ? value.trim().toLowerCase() : "";



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

const NUMBER_FORMATTER = new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric" });



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



const statusLabel = (value: Ec2RecommendationStatus): string => {

  if (value === "in_progress") return "In Progress";

  if (value === "completed") return "Resolved";

  return toTitle(value);

};



const statusBadgeClassName = (status: Ec2RecommendationStatus): string => {

  if (status === "open") return "is-status-open";

  if (status === "in_progress") return "is-status-in-progress";

  if (status === "snoozed") return "is-status-snoozed";

  if (status === "dismissed") return "is-status-dismissed";

  return "is-status-completed";

};



const toRiskClassName = (risk: Ec2RecommendationRecord["risk"]): string => {

  const normalized = (risk ?? "").toString().trim().toUpperCase();

  if (normalized === "LOW" || normalized === "MEDIUM" || normalized === "HIGH") return normalized;

  return "LOW";

};



const formatReadableDate = (value: string | null | undefined): string => {

  if (!value) return "-";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return value;

  return DATE_FORMATTER.format(parsed);

};



const formatLoadBalancerType = (value: string | null | undefined): string => {

  if (!value) return "-";

  const normalized = value.trim().toLowerCase();

  if (normalized === "application") return "Application";

  if (normalized === "network") return "Network";

  return toTitle(value);

};



const formatLoadBalancerScheme = (value: string | null | undefined): string => {

  if (!value) return "-";

  const normalized = value.trim().toLowerCase();

  if (normalized === "internet-facing") return "Internet-facing";

  if (normalized === "internal") return "Internal";

  return toTitle(value);

};



const formatEvidenceLabel = (value: string): string => {

  const normalized = value.trim().toLowerCase();

  if (normalized === "processed_gb") return "Processed GB";

  if (normalized === "lb_type" || normalized === "type") return "Type";

  if (normalized === "scheme") return "Scheme";

  return value;

};



const formatEvidenceValue = (label: string, value: string): string => {

  if (label === "Type") return formatLoadBalancerType(value);

  if (label === "Scheme") return formatLoadBalancerScheme(value);

  if (label === "Processed GB") {

    const numeric = Number(value);

    return Number.isFinite(numeric) ? `${NUMBER_FORMATTER.format(numeric)} GB` : value;

  }

  const parsed = new Date(value);

  if (!Number.isNaN(parsed.getTime()) && /date|at|time|from|to/i.test(label)) return DATE_FORMATTER.format(parsed);

  return value;

};



const truncateText = (value: string | null | undefined, max: number = 88): string => {

  const raw = (value ?? "").trim();

  if (!raw) return "-";

  return raw.length > max ? `${raw.slice(0, max - 1)}...` : raw;

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



function getStatusActions(status: Ec2RecommendationStatus): StatusAction[] {

  if (status === "open") return [{ label: "Mark In Progress", status: "in_progress" }, { label: "Mark Resolved", status: "completed" }, { label: "Dismiss", status: "dismissed" }, { label: "View Details", kind: "details" }];

  if (status === "in_progress") return [{ label: "Mark Open", status: "open" }, { label: "Mark Resolved", status: "completed" }, { label: "Dismiss", status: "dismissed" }, { label: "View Details", kind: "details" }];

  if (status === "dismissed") return [{ label: "Reopen", status: "open" }, { label: "View Details", kind: "details" }];

  return [{ label: "Reopen", status: "open" }, { label: "View Details", kind: "details" }];

}



function RecommendationActions({
  item,
  status,
  pending,
  onStatusChange,
  onViewDetails,
}: {
  item: Ec2RecommendationRecord;
  status: Ec2RecommendationStatus;
  pending: boolean;
  onStatusChange: (item: Ec2RecommendationRecord, status: Ec2RecommendationStatus) => void;
  onViewDetails: (item: Ec2RecommendationRecord) => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const actions = getStatusActions(status);

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (event.target instanceof Element && event.target.closest("[data-lb-actions-menu='true']")) return;
      setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  const toggleMenu = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const width = 190;
      const estimatedMenuHeight = actions.length * 36 + 14;
      const openUpward = window.innerHeight - rect.bottom < estimatedMenuHeight + 12;
      setMenuPosition({
        top: openUpward ? Math.max(12, rect.top - estimatedMenuHeight - 6) : rect.bottom + 6,
        left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)),
      });
    }
    setOpen((value) => !value);
  };

  return (
    <div
      className="relative inline-flex"
      data-stop-row-click="true"
      data-lb-actions-menu="true"
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <button
        ref={triggerRef}
        type="button"
        className="optimization-action-menu__trigger"
        disabled={pending}
        onClick={toggleMenu}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        Update Status <ChevronDown size={13} aria-hidden="true" />
      </button>
      {open
        ? createPortal(
            <div
              className="optimization-action-menu__content lb-optimization-action-menu__content"
              role="menu"
              style={menuPosition ? { position: "fixed", top: menuPosition.top, left: menuPosition.left } : undefined}
              data-lb-actions-menu="true"
            >
              {actions.map((option) => (
                <button
                  key={`${option.kind ?? option.status}-${option.label}`}
                  type="button"
                  className="optimization-action-menu__item lb-optimization-action-menu__item"
                  onClick={() => {
                    setOpen(false);
                    if (option.kind === "details") {
                      onViewDetails(item);
                      return;
                    }
                    if (option.status) onStatusChange(item, option.status);
                  }}
                  role="menuitem"
                >
                  {option.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export default function LoadBalancerOptimizationPage() {

  const { scope } = useDashboardScope();

  const navigate = useNavigate();

  const location = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);



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

  const [selectedDetailReason, setSelectedDetailReason] = useState("");

  const [statusUpdatedAtOverrides, setStatusUpdatedAtOverrides] = useState<Record<number, string>>({});
  const queryIssueType = normalizeFilterValue(searchParams.get("issueType"));
  const queryTab = normalizeFilterValue(searchParams.get("tab"));



  const deferredSearchFilter = useDeferredValue(searchFilter);

  const query = useEc2RecommendationsQuery({ service: "load_balancer", resourceType: "load_balancer" });

  const detailQuery = useInventoryLoadBalancerDetail(selectedRecommendation?.resourceId ?? null);



  const allRows = useMemo(() => {

    const data = query.data?.recommendations;

    if (!data) return [];

    return [...data.compute, ...data.storage, ...data.pricing, ...data.network].filter((row) => row.resourceType === "load_balancer");

  }, [query.data]);

  useEffect(() => {
    if (queryTab === "recommendations") {
      setActiveTab("recommendations");
    }
  }, [queryTab]);

  useEffect(() => {
    if (!queryIssueType) return;
    setIssueTypeFilter((current) => (current === queryIssueType ? current : queryIssueType));
    setActiveTab("recommendations");
  }, [queryIssueType]);



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

  const topRecommendationTypes = useMemo(() => {

    const counts = new Map<Ec2RecommendationType, number>();

    for (const row of allRows) {

      counts.set(row.type, (counts.get(row.type) ?? 0) + 1);

    }

    return Array.from(counts.entries())

      .map(([type, count]) => ({ type, count }))

      .sort((a, b) => (b.count - a.count) || typeLabel(a.type).localeCompare(typeLabel(b.type)))

      .slice(0, 6);

  }, [allRows]);

  const topRecommendationsBySavings = useMemo(

    () => [...allRows].sort((a, b) => (b.estimatedMonthlySaving ?? 0) - (a.estimatedMonthlySaving ?? 0)).slice(0, 5),

    [allRows],

  );



  const unifiedCols = useMemo<ColDef<Ec2RecommendationRecord>[]>(() => [

    { headerName: "Resource", field: "resourceName", minWidth: 170, flex: 1.1 },

    { headerName: "Category", valueGetter: (p) => toTitle(p.data?.category ?? "-"), minWidth: 140, flex: 0.8 },

    { headerName: "Issue Type", valueGetter: (p) => typeLabel((p.data?.type ?? "idle_load_balancer") as Ec2RecommendationType), minWidth: 150, flex: 1 },

    { headerName: "Severity", minWidth: 120, maxWidth: 130, flex: 0.7, cellRenderer: (p: { data?: Ec2RecommendationRecord }) => p.data ? <span className={`optimization-rightsizing-pill is-risk-${toRiskClassName(p.data.risk)}`}>{toTitle(p.data.risk)}</span> : null },

    { headerName: "Evidence Summary", valueGetter: (p) => p.data ? formatRecommendationEvidence(p.data.type, p.data.evidence).summary : "-", minWidth: 210, flex: 1.25 },

    { headerName: "Recommended Action", valueGetter: (p) => p.data?.action ?? "-", minWidth: 210, flex: 1.2 },

    { headerName: "Saving", valueGetter: (p) => formatCurrency(p.data?.estimatedMonthlySaving), minWidth: 112, maxWidth: 130, flex: 0.65 },

    { headerName: "Status", minWidth: 124, maxWidth: 136, flex: 0.7, cellRenderer: (p: { data?: Ec2RecommendationRecord }) => p.data ? <StatusBadge status={(statusOverrides[p.data.id] ?? p.data.status ?? "open") as Ec2RecommendationStatus} /> : null },

    {

      headerName: "Actions",

      width: 160,
      minWidth: 150,

      maxWidth: 170,
      flex: 0,

      cellRenderer: (p: { data?: Ec2RecommendationRecord }) => p.data ? (

        <RecommendationActions

          item={p.data}

          status={(statusOverrides[p.data.id] ?? p.data.status ?? "open") as Ec2RecommendationStatus}

          pending={pendingRecommendationId === p.data.id}

          onStatusChange={(item, status) => { void applyStatusUpdateForRow(item, status); }}

          onViewDetails={(item) => {

            setSelectedRecommendation(item);

            setSelectedDetailStatus((statusOverrides[item.id] ?? item.status ?? "open") as Ec2RecommendationStatus);

            setSelectedDetailReason(item.statusReason ?? "");

          }}

        />

      ) : null,

    },

  ], [statusOverrides, pendingRecommendationId]);



  const selectedStatus = selectedRecommendation ? (statusOverrides[selectedRecommendation.id] ?? selectedRecommendation.status ?? "open") : "open";

  const selectedEvidence = selectedRecommendation ? formatRecommendationEvidence(selectedRecommendation.type, selectedRecommendation.evidence) : null;

  const updateUrlIssueType = (nextIssueType: string) => {
    const nextParams = new URLSearchParams(location.search);
    nextParams.set("tab", "recommendations");
    if (!nextIssueType || nextIssueType === "all") nextParams.delete("issueType");
    else nextParams.set("issueType", nextIssueType);
    navigate({ pathname: location.pathname, search: nextParams.toString() }, { replace: true });
  };



  const applyStatusUpdate = async () => {

    if (!scope || !selectedRecommendation) return;

    setPendingRecommendationId(selectedRecommendation.id);

    setStatusOverrides((prev) => ({ ...prev, [selectedRecommendation.id]: selectedDetailStatus }));

    try {

      await dashboardApi.updateEc2RecommendationStatus(scope, selectedRecommendation.id, {

        status: selectedDetailStatus,

        reason: selectedDetailReason.trim() ? selectedDetailReason.trim() : undefined,

      });

      setStatusUpdatedAtOverrides((prev) => ({ ...prev, [selectedRecommendation.id]: new Date().toISOString() }));

      void query.refetch();

    } finally {

      setPendingRecommendationId(null);

    }

  };



  const applyStatusUpdateForRow = async (item: Ec2RecommendationRecord, nextStatus: Ec2RecommendationStatus) => {

    if (!scope) return;

    const previousStatus = statusOverrides[item.id] ?? item.status ?? "open";

    setPendingRecommendationId(item.id);

    setStatusOverrides((prev) => ({ ...prev, [item.id]: nextStatus }));

    try {

      await dashboardApi.updateEc2RecommendationStatus(scope, item.id, { status: nextStatus });

      setStatusUpdatedAtOverrides((prev) => ({ ...prev, [item.id]: new Date().toISOString() }));

      void query.refetch();

    } catch {

      setStatusOverrides((prev) => ({ ...prev, [item.id]: previousStatus }));

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

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">

              <article className="optimization-verified-item">

                <p className="optimization-overview-insight-item__title">Top Recommendation Types</p>

                <div className="mt-3 space-y-2">

                  {topRecommendationTypes.length > 0 ? topRecommendationTypes.map((item) => (

                    <button key={item.type} type="button" className="optimization-overview-nav-link flex w-full items-center justify-between text-sm gap-3 text-left" onClick={() => { setActiveTab("recommendations"); setIssueTypeFilter(item.type); }}>

                      <span className="truncate">{typeLabel(item.type)}</span>

                      <span>{item.count}</span>

                    </button>

                  )) : <p className="dashboard-note">No recommendation types available for the current scope.</p>}

                </div>

              </article>

              <article className="optimization-verified-item">

                <p className="optimization-overview-insight-item__title">Top 5 Recommendations by Savings</p>

                <div className="mt-3 space-y-2">

                  {topRecommendationsBySavings.length > 0 ? topRecommendationsBySavings.map((item) => (

                    <button key={item.id} type="button" className="optimization-overview-nav-link flex w-full items-center justify-between text-sm gap-3 text-left" onClick={() => { setActiveTab("recommendations"); setSearchFilter(item.resourceId); }}>

                      <span className="truncate">{`${truncateText(item.resourceName || item.resourceId, 44)}  ${typeLabel(item.type)}`}</span>

                      <span>{formatCurrency(item.estimatedMonthlySaving)}</span>

                    </button>

                  )) : <p className="dashboard-note">No recommendations available for the current scope.</p>}

                </div>

              </article>

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

              <FilterDropdown label="Issue Type" selected={issueTypeFilter} options={recommendationFilterOptions.issueTypes} isOpen={activeDropdown === "issueType"} onToggle={() => setActiveDropdown((v) => (v === "issueType" ? null : "issueType"))} onSelect={(key) => { setIssueTypeFilter(key); updateUrlIssueType(key); setActiveDropdown(null); }} />

              <FilterDropdown label="Status" selected={statusFilter} options={[{ key: "active", label: "Open + In Progress" }, { key: "open", label: "Open" }, { key: "in_progress", label: "In Progress" },  { key: "dismissed", label: "Dismissed" }, { key: "completed", label: "Resolved" }, { key: "all", label: "All" }]} isOpen={activeDropdown === "status"} onToggle={() => setActiveDropdown((v) => (v === "status" ? null : "status"))} onSelect={(key) => { setStatusFilter(key); setActiveDropdown(null); }} />

              <FilterDropdown label="Severity" selected={severityFilter} options={recommendationFilterOptions.severity} isOpen={activeDropdown === "severity"} onToggle={() => setActiveDropdown((v) => (v === "severity" ? null : "severity"))} onSelect={(key) => { setSeverityFilter(key); setActiveDropdown(null); }} />

              <div className="cost-explorer-toolbar-item"><label className="cost-explorer-toolbar-trigger ec2-instances-search-trigger"><span className="ec2-instances-search-trigger__icon-wrap" aria-hidden="true"><Search size={14} /></span><input type="search" value={searchFilter} onChange={(event) => setSearchFilter(event.target.value)} placeholder="Search recommendations" aria-label="Search recommendations" className="ec2-instances-search-trigger__input" /></label></div>

              <div className="cost-explorer-toolbar-item"><button type="button" className="cost-explorer-toolbar-trigger ec2-instances-toolbar-icon-trigger" onClick={() => { setCategoryFilter("all"); setIssueTypeFilter("all"); setStatusFilter("active"); setSeverityFilter("all"); setSearchFilter(""); setActiveDropdown(null); updateUrlIssueType("all"); }} aria-label="Reset recommendation filters" title="Reset recommendation filters"><span className="cost-explorer-toolbar-trigger__row ec2-instances-toolbar-icon-trigger__row"><RotateCcw size={14} /></span></button></div>

            </div>

            {issueTypeFilter !== "all" ? (
              <div className="cost-explorer-chip-bar" aria-label="Active recommendation filters">
                <div className="cost-explorer-chip-row">
                  <span className="cost-explorer-chip">
                    <span className="cost-explorer-chip__edit">Issue Type: {typeLabel(issueTypeFilter as Ec2RecommendationType)}</span>
                    <button type="button" className="cost-explorer-chip__remove" onClick={() => { setIssueTypeFilter("all"); updateUrlIssueType("all"); }} aria-label="Remove Issue Type filter">
                      <X size={13} aria-hidden="true" />
                    </button>
                  </span>
                </div>
              </div>
            ) : null}

            <BaseDataTable columnDefs={unifiedCols} rowData={filteredRecommendations} pagination paginationPageSize={10} autoHeight emptyMessage="No recommendations found" onRowClick={(row) => { setSelectedRecommendation(row); setSelectedDetailStatus((statusOverrides[row.id] ?? row.status ?? "open") as Ec2RecommendationStatus); setSelectedDetailReason(row.statusReason ?? ""); }} />

          </div>

        </section>

      ) : null}



      <Dialog open={Boolean(selectedRecommendation)} onOpenChange={(open) => { if (!open) setSelectedRecommendation(null); }}>

        <DialogContent className="optimization-recommendation-drawer lb-optimization-recommendation-drawer lb-optimization-recommendation-drawer--custom-close left-auto right-0 top-0 flex h-screen max-h-screen w-[min(100vw,40rem)] max-w-none -translate-x-0 -translate-y-0 flex-col rounded-none border-l border-[color:var(--border-light)] p-0 data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100">

          {selectedRecommendation ? (

            <>

              <DialogHeader className="optimization-drawer-header">

                <div className="optimization-drawer-title-row">

                  <DialogTitle className="optimization-drawer-title">{typeLabel(selectedRecommendation.type)}</DialogTitle>

                  <div className="lb-optimization-drawer-title-actions">

                    <StatusBadge status={selectedStatus as Ec2RecommendationStatus} />

                    <DialogClose type="button" className="lb-optimization-drawer-close" aria-label="Close details drawer">

                      <X size={16} aria-hidden="true" />

                    </DialogClose>

                  </div>

                </div>

                <div className="optimization-drawer-subtitle"><span className="font-mono">{selectedRecommendation.resourceName || selectedRecommendation.resourceId}</span></div>

              </DialogHeader>

              <div className="optimization-drawer-body">

                <section className="optimization-drawer-section lb-optimization-drawer-card">

                  <h3>Header</h3>

                  <dl className="optimization-drawer-evidence">

                    <div className="optimization-drawer-evidence__row"><dt>Issue Type</dt><dd>{typeLabel(selectedRecommendation.type)}</dd></div>

                    <div className="optimization-drawer-evidence__row"><dt>Resource Name</dt><dd>{selectedRecommendation.resourceName || selectedRecommendation.resourceId}</dd></div>

                    <div className="optimization-drawer-evidence__row"><dt>Status</dt><dd>{statusLabel(selectedStatus as Ec2RecommendationStatus)}</dd></div>

                    <div className="optimization-drawer-evidence__row"><dt>Severity</dt><dd>{toTitle(selectedRecommendation.risk)}</dd></div>

                    <div className="optimization-drawer-evidence__row"><dt>Estimated Monthly Savings</dt><dd>{formatCurrency(selectedRecommendation.estimatedMonthlySaving)}</dd></div>

                  </dl>

                </section>



                <section className="optimization-drawer-section lb-optimization-drawer-card">

                  <h3>Resource Context</h3>

                  {detailQuery.data ? (

                    <dl className="optimization-drawer-evidence">

                      <div className="optimization-drawer-evidence__row"><dt>Load Balancer Name</dt><dd>{detailQuery.data.name}</dd></div>

                      <div className="optimization-drawer-evidence__row"><dt>ARN</dt><dd className="break-all">{detailQuery.data.arn ?? "-"}</dd></div>

                      <div className="optimization-drawer-evidence__row"><dt>Type</dt><dd>{formatLoadBalancerType(detailQuery.data.type)}</dd></div>

                      <div className="optimization-drawer-evidence__row"><dt>Scheme</dt><dd>{formatLoadBalancerScheme(detailQuery.data.scheme)}</dd></div>

                      <div className="optimization-drawer-evidence__row"><dt>Region</dt><dd>{detailQuery.data.region ?? selectedRecommendation.region ?? "-"}</dd></div>

                      <div className="optimization-drawer-evidence__row"><dt>Account</dt><dd>{detailQuery.data.accountId ?? selectedRecommendation.accountId ?? "-"}</dd></div>

                      <div className="optimization-drawer-evidence__row"><dt>State</dt><dd>{detailQuery.data.state ?? "-"}</dd></div>

                    </dl>

                  ) : <p>{detailQuery.isLoading ? "Loading load balancer context..." : "Load balancer context unavailable."}</p>}

                </section>



                <section className="optimization-drawer-section lb-optimization-drawer-card">

                  <h3>Evidence</h3>

                  {selectedEvidence?.rows?.length ? (

                    <dl className="optimization-drawer-evidence">

                      {selectedEvidence.rows.map((row) => (

                        <div className="optimization-drawer-evidence__row" key={row.key}><dt>{formatEvidenceLabel(row.label)}</dt><dd>{formatEvidenceValue(formatEvidenceLabel(row.label), row.value)}</dd></div>

                      ))}

                    </dl>

                  ) : <p>No structured evidence available.</p>}

                </section>



                <section className="optimization-drawer-section lb-optimization-drawer-card">

                  <h3>Recommended Action</h3>

                  <div className="optimization-drawer-callout">{selectedRecommendation.action}</div>

                </section>



                <section className="optimization-drawer-section lb-optimization-drawer-card">

                  <h3>Why this matters</h3>

                  <p>{whyThisMatters(selectedRecommendation.type)}</p>

                </section>



                <section className="optimization-drawer-section lb-optimization-drawer-card">

                  <h3>Lifecycle / Status</h3>

                  <div className="flex gap-2 items-center mb-3">

                    <select value={selectedDetailStatus} onChange={(e) => setSelectedDetailStatus(e.target.value as Ec2RecommendationStatus)} className="dashboard-header-field__control">

                      <option value="open">Open</option>

                      <option value="in_progress">In Progress</option>

                      <option value="completed">Resolved</option>

                      <option value="dismissed">Dismissed</option>

                    </select>

                    <button type="button" className="optimization-drawer-action optimization-drawer-action--primary" disabled={pendingRecommendationId === selectedRecommendation.id} onClick={applyStatusUpdate}>Update Status</button>

                  </div>

                  <div className="mb-3">

                    <label className="block text-xs font-semibold text-text-secondary mb-1">Reason (optional)</label>

                    <input type="text" value={selectedDetailReason} onChange={(event) => setSelectedDetailReason(event.target.value)} className="dashboard-header-field__control w-full" placeholder="Add a status reason" />

                  </div>

                  <dl className="optimization-drawer-evidence">

                    <div className="optimization-drawer-evidence__row"><dt>Detected At</dt><dd>{formatReadableDate(selectedRecommendation.detectedAt)}</dd></div>

                    <div className="optimization-drawer-evidence__row"><dt>Last Seen At</dt><dd>{formatReadableDate(selectedRecommendation.lastSeenAt)}</dd></div>

                    <div className="optimization-drawer-evidence__row"><dt>Status Updated At</dt><dd>{formatReadableDate(statusUpdatedAtOverrides[selectedRecommendation.id] ?? selectedRecommendation.lastSeenAt)}</dd></div>

                    <div className="optimization-drawer-evidence__row"><dt>Status Reason</dt><dd>{selectedDetailReason.trim() || selectedRecommendation.statusReason || "-"}</dd></div>

                  </dl>

                </section>



                <section className="optimization-drawer-section lb-optimization-drawer-card">

                  <h3>Related actions</h3>

                  <div className="optimization-drawer-footer__actions lb-optimization-drawer-actions">

                    <button type="button" className="optimization-drawer-action lb-optimization-drawer-action-button" onClick={() => navigate({ pathname: `${LIST_PATH}/${encodeURIComponent(selectedRecommendation.resourceId)}`, search: new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(location.search)), loadBalancerName: selectedRecommendation.resourceName || selectedRecommendation.resourceId }).toString() })}>View Load Balancer Detail</button>

                    <button type="button" className="optimization-drawer-action lb-optimization-drawer-action-button" onClick={() => navigate({ pathname: EXPLORER_PATH, search: new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(location.search)), groupBy: "load_balancer", groupValues: selectedRecommendation.resourceId }).toString() })}>View in Explorer filtered by this load balancer</button>

                    <button type="button" className="optimization-drawer-action lb-optimization-drawer-action-button" onClick={() => setSelectedRecommendation(null)}>Close</button>

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

