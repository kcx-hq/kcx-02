import { Check, ChevronDown, Filter, RotateCcw, Search, X } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import type { ColDef } from "ag-grid-community";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ApiError } from "@/lib/api";
import { dashboardApi } from "../../api/dashboardApi";
import type { Ec2RecommendationRecord, Ec2RecommendationStatus, Ec2RecommendationType } from "../../api/dashboardTypes";

import { BaseDataTable } from "../../common/tables/BaseDataTable";
import { useEc2RecommendationsQuery } from "../../hooks/useDashboardQueries";
import { useDashboardScope } from "../../hooks/useDashboardScope";
import { EC2ExplorerScopeFilters } from "./components/EC2ExplorerScopeFilters";
import { formatRecommendationEvidence } from "./components/recommendationEvidence";
import type { EC2ScopeFilters } from "./ec2ExplorerControls.types";

const INSTANCES_PAGE_PATH = "/dashboard/inventory/aws/ec2/instances";
const VOLUMES_PAGE_PATH = "/dashboard/inventory/aws/ec2/volumes";
type MainTab = "overview" | "recommendations";
type RecommendationsFilterKey = "category" | "issueType" | "status" | "severity";
type FilterOption = { key: string; label: string };
type ResourceRoute = { pathname: string; search: string } | null;
type StatusAction = { label: string; status?: Ec2RecommendationStatus; kind?: "details" | "resource" };

const MAIN_TABS: Array<{ key: MainTab; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "recommendations", label: "Recommendations" },
];
const GLOBAL_SCOPE_DEFAULTS: EC2ScopeFilters = { region: [], tags: [] };

const CURRENCY_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const toIsoDate = (value: Date): string => value.toISOString().slice(0, 10);
const getDefaultDateRange = (): { start: string; end: string } => {
  const today = new Date();
  const startOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  return { start: toIsoDate(startOfMonth), end: toIsoDate(today) };
};
const parseCsvParam = (value: string | null): string[] =>
  value ? value.split(",").map((entry) => entry.trim()).filter(Boolean) : [];
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
  if (value === "idle_instance") return "Idle Instance";
  if (value === "underutilized_instance") return "Underutilized Instance";
  if (value === "overutilized_instance") return "Overutilized Instance";
  if (value === "unattached_volume") return "Unattached Volume";
  if (value === "old_snapshot") return "Old Snapshot";
  if (value === "orphaned_snapshot") return "Orphaned Snapshot";
  if (value === "uncovered_on_demand") return "Uncovered On-Demand";
  if (value === "high_internet_data_transfer") return "High Internet Data Transfer";
  if (value === "high_inter_region_data_transfer") return "High Inter-Region Data Transfer";
  if (value === "high_inter_az_data_transfer") return "High Inter-AZ Data Transfer";
  if (value === "low_cpu_high_network") return "Low CPU / High Network";
  if (value === "high_nat_gateway_cost") return "High NAT Gateway Cost";
  if (value === "idle_load_balancer") return "Idle Load Balancer";
  if (value === "low_traffic_load_balancer") return "Low Traffic Load Balancer";
  if (value === "unhealthy_targets") return "Unhealthy Targets";
  if (value === "high_error_rate") return "High Error Rate";
  if (value === "high_data_processing_cost") return "High Data Processing Cost";
  return "Unattached Elastic IP";
};
const truncateText = (value: string | null | undefined, max: number = 90): string => {
  const raw = (value ?? "").trim();
  if (!raw) return "-";
  return raw.length > max ? `${raw.slice(0, max - 1)}...` : raw;
};
const toInstanceDetailFocus = (type: Ec2RecommendationType): string | null => {
  if (
    type === "high_internet_data_transfer" ||
    type === "high_inter_az_data_transfer" ||
    type === "high_inter_region_data_transfer" ||
    type === "high_nat_gateway_cost" ||
    type === "low_cpu_high_network"
  ) return "network";
  if (type === "idle_instance" || type === "underutilized_instance" || type === "overutilized_instance") return "performance";
  if (type === "uncovered_on_demand") return "pricing";
  if ((type as string) === "storage_heavy_instance") return "storage";
  return null;
};
const normalizeFilterValue = (value: string | null): string => (value ?? "").trim();
const normalizeStatus = (value: Ec2RecommendationStatus | null | undefined): Ec2RecommendationStatus => value ?? "open";
const toRiskClassName = (risk: Ec2RecommendationRecord["risk"]): string => {
  const normalized = (risk ?? "").toString().trim().toUpperCase();
  if (normalized === "LOW" || normalized === "MEDIUM" || normalized === "HIGH") return normalized;
  return "LOW";
};
const statusLabel = (value: Ec2RecommendationStatus): string =>
  value === "in_progress" ? "In Progress" : toTitle(value);
const activeStatuses: Ec2RecommendationStatus[] = ["open", "in_progress"];
const statusSortRank: Record<Ec2RecommendationStatus, number> = {
  open: 0,
  in_progress: 1,
  snoozed: 2,
  dismissed: 3,
  completed: 4,
};
const riskSortRank: Record<Ec2RecommendationRecord["risk"], number> = { high: 3, medium: 2, low: 1 };
const effortSortRank: Record<Ec2RecommendationRecord["effort"], number> = { low: 1, medium: 2, high: 3 };
const statusBadgeClassName = (status: Ec2RecommendationStatus): string => {
  if (status === "open") return "is-status-open";
  if (status === "in_progress") return "is-status-in-progress";
  if (status === "snoozed") return "is-status-snoozed";
  if (status === "dismissed") return "is-status-dismissed";
  return "is-status-completed";
};
const getMetadataValue = (item: Ec2RecommendationRecord, key: string): string | null => {
  const value = item.metadata?.[key];
  if (value === null || typeof value === "undefined") return null;
  const text = String(value).trim();
  return text || null;
};
function FilterDropdown({
  label,
  selected,
  options,
  isOpen,
  onToggle,
  onSelect,
}: {
  label: string;
  selected: string;
  options: FilterOption[];
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (key: string) => void;
}) {
  const selectedLabel =
    options.find((option) => option.key === selected)?.label
    ?? (selected !== "all" ? toTitle(selected) : "All");
  return (
    <div className="cost-explorer-toolbar-item">
      <button
        type="button"
        className={`cost-explorer-toolbar-trigger${isOpen ? " is-active" : ""}`}
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
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
                <button
                  key={option.key}
                  type="button"
                  className={`cost-explorer-filter-option${active ? " is-active" : ""}`}
                  onClick={() => onSelect(option.key)}
                  role="option"
                  aria-selected={active}
                >
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
  return (
    <span className={`optimization-rightsizing-pill ${statusBadgeClassName(status)}`}>
      {statusLabel(status)}
    </span>
  );
}

function getStatusActions(status: Ec2RecommendationStatus): StatusAction[] {
  if (status === "open") {
    return [
      { label: "Mark In Progress", status: "in_progress" },
      { label: "Snooze", status: "snoozed" },
      { label: "Dismiss", status: "dismissed" },
      { label: "Mark Completed", status: "completed" },
      { label: "View Details", kind: "details" },
      { label: "Open Resource", kind: "resource" },
    ];
  }
  if (status === "in_progress") {
    return [
      { label: "Mark Open", status: "open" },
      { label: "Snooze", status: "snoozed" },
      { label: "Dismiss", status: "dismissed" },
      { label: "Mark Completed", status: "completed" },
      { label: "View Details", kind: "details" },
      { label: "Open Resource", kind: "resource" },
    ];
  }
  if (status === "snoozed") {
    return [
      { label: "Reopen", status: "open" },
      { label: "Mark In Progress", status: "in_progress" },
      { label: "View Details", kind: "details" },
      { label: "Open Resource", kind: "resource" },
    ];
  }
  if (status === "dismissed") {
    return [
      { label: "Reopen", status: "open" },
      { label: "View Details", kind: "details" },
      { label: "Open Resource", kind: "resource" },
    ];
  }
  return [
    { label: "Reopen", status: "open" },
    { label: "View Details", kind: "details" },
    { label: "Open Resource", kind: "resource" },
  ];
}

function getWorkflowActions(status: Ec2RecommendationStatus): { primary: StatusAction; secondary: StatusAction[] } {
  if (status === "open") {
    return {
      primary: { label: "Mark In Progress", status: "in_progress" },
      secondary: [
        { label: "Snooze", status: "snoozed" },
        { label: "Dismiss", status: "dismissed" },
        { label: "Mark Completed", status: "completed" },
      ],
    };
  }
  if (status === "in_progress") {
    return {
      primary: { label: "Mark Completed", status: "completed" },
      secondary: [
        { label: "Snooze", status: "snoozed" },
        { label: "Dismiss", status: "dismissed" },
        { label: "Mark Open", status: "open" },
      ],
    };
  }
  if (status === "snoozed") {
    return {
      primary: { label: "Reopen", status: "open" },
      secondary: [{ label: "Mark In Progress", status: "in_progress" }],
    };
  }
  return { primary: { label: "Reopen", status: "open" }, secondary: [] };
}

function RecommendationActions({
  item,
  status,
  pending,
  canOpenResource,
  onStatusChange,
  onViewDetails,
  onOpenResource,
}: {
  item: Ec2RecommendationRecord;
  status: Ec2RecommendationStatus;
  pending: boolean;
  canOpenResource: boolean;
  onStatusChange: (item: Ec2RecommendationRecord, status: Ec2RecommendationStatus) => void;
  onViewDetails: (item: Ec2RecommendationRecord) => void;
  onOpenResource: (item: Ec2RecommendationRecord) => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const options = getStatusActions(status);

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (event.target instanceof Element && event.target.closest("[data-ec2-actions-menu='true']")) return;
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
      setMenuPosition({
        top: rect.bottom + 6,
        left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)),
      });
    }
    setOpen((value) => !value);
  };

  return (
    <div
      className="relative inline-flex"
      data-stop-row-click="true"
      data-ec2-actions-menu="true"
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
      {open ? createPortal(
        <div
          className="optimization-action-menu__content"
          role="menu"
          style={menuPosition ? { position: "fixed", top: menuPosition.top, left: menuPosition.left } : undefined}
          data-ec2-actions-menu="true"
        >
          {options.map((option) => (
            <button
              key={`${option.kind ?? option.status}-${option.label}`}
              type="button"
              className="optimization-action-menu__item"
              disabled={option.kind === "resource" && !canOpenResource}
              onClick={() => {
                if (option.kind === "resource" && !canOpenResource) return;
                setOpen(false);
                if (option.kind === "details") {
                  onViewDetails(item);
                  return;
                }
                if (option.kind === "resource") {
                  onOpenResource(item);
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
      ) : null}
    </div>
  );
}

export default function EC2OptimizationPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { scope } = useDashboardScope();
  const pageTitle = "EC2 Optimization";
  const defaults = getDefaultDateRange();
  const rootRef = useRef<HTMLDivElement | null>(null);

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const dateFrom = searchParams.get("billingPeriodStart") ?? searchParams.get("from") ?? scope?.from ?? defaults.start;
  const dateTo = searchParams.get("billingPeriodEnd") ?? searchParams.get("to") ?? scope?.to ?? defaults.end;

  const [activeTab, setActiveTab] = useState<MainTab>("overview");
  const [activeDropdown, setActiveDropdown] = useState<RecommendationsFilterKey | null>(null);
  const [scopeFiltersOpen, setScopeFiltersOpen] = useState(false);
  const [globalScopeFilters, setGlobalScopeFilters] = useState<EC2ScopeFilters>(GLOBAL_SCOPE_DEFAULTS);

  const [categoryFilter, setCategoryFilter] = useState("all");
  const [issueTypeFilter, setIssueTypeFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [searchFilter, setSearchFilter] = useState("");
  const [statusOverrides, setStatusOverrides] = useState<Record<number, Ec2RecommendationStatus>>({});
  const [snoozeUntilOverrides, setSnoozeUntilOverrides] = useState<Record<number, string | null>>({});
  const [pendingRecommendationId, setPendingRecommendationId] = useState<number | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [selectedRecommendation, setSelectedRecommendation] = useState<Ec2RecommendationRecord | null>(null);
  const [snoozeTarget, setSnoozeTarget] = useState<Ec2RecommendationRecord | null>(null);
  const [snoozePreset, setSnoozePreset] = useState<"7" | "30" | "custom">("7");
  const [customSnoozeDate, setCustomSnoozeDate] = useState("");
  const deferredSearchFilter = useDeferredValue(searchFilter);
  const queryResourceId = normalizeFilterValue(searchParams.get("resourceId") ?? searchParams.get("instanceId"));
  const queryCategory = normalizeFilterValue(searchParams.get("category"));
  const queryIssueType = normalizeFilterValue(searchParams.get("issueType"));
  const querySearch = normalizeFilterValue(searchParams.get("search"));
  const queryTab = normalizeFilterValue(searchParams.get("tab"));
  const snapshotPrefill = useMemo(() => {
    const stateValue = location.state as
      | {
          snapshotOptimizationPrefill?: {
            resourceId?: string;
            category?: string;
            issueType?: string;
          };
        }
      | null;
    return stateValue?.snapshotOptimizationPrefill ?? null;
  }, [location.state]);

  useEffect(() => {
    if (queryTab === "recommendations") {
      setActiveTab("recommendations");
    }
  }, [queryTab]);

  useEffect(() => {
    const stateCategory = normalizeFilterValue(snapshotPrefill?.category ?? null);
    const stateIssueType = normalizeFilterValue(snapshotPrefill?.issueType ?? null);
    const stateResourceId = normalizeFilterValue(snapshotPrefill?.resourceId ?? null);
    const nextCategory = stateCategory || queryCategory || "all";
    const nextIssueType = stateIssueType || queryIssueType || "all";
    const nextSearch = stateResourceId || querySearch || queryResourceId || "";

    setCategoryFilter((prev) => (prev === nextCategory ? prev : nextCategory));
    setIssueTypeFilter((prev) => (prev === nextIssueType ? prev : nextIssueType));
    setSearchFilter((prev) => (prev === nextSearch ? prev : nextSearch));
    if (nextCategory !== "all" || nextIssueType !== "all" || nextSearch) {
      setActiveTab("recommendations");
    }
  }, [queryCategory, queryIssueType, queryResourceId, querySearch, snapshotPrefill]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (rootRef.current.contains(event.target as Node)) return;
      setActiveDropdown(null);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveDropdown(null);
    };
    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const recommendationsQueryFilters = useMemo(
    () => ({
      dateFrom,
      dateTo,
      region: searchParams.get("region") ?? undefined,
      account: searchParams.get("account") ?? undefined,
      team: searchParams.get("team") ?? undefined,
      product: searchParams.get("product") ?? undefined,
      environment: searchParams.get("environment") ?? searchParams.get("env") ?? undefined,
      tags: parseCsvParam(searchParams.get("tags")),
    }),
    [dateFrom, dateTo, searchParams],
  );
  const query = useEc2RecommendationsQuery({ ...recommendationsQueryFilters, service: "ec2" });
  const orphanedRefreshKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!scope) return;
    if (queryIssueType !== "orphaned_snapshot") return;

    const refreshKey = `${scope.tenantId}:${dateFrom}:${dateTo}:${queryIssueType}`;
    if (orphanedRefreshKeyRef.current === refreshKey) return;
    orphanedRefreshKeyRef.current = refreshKey;

    void (async () => {
      try {
        await dashboardApi.refreshEc2Recommendations(scope, { dateFrom, dateTo });
      } finally {
        await query.refetch();
      }
    })();
  }, [scope, queryIssueType, dateFrom, dateTo, query]);

  const getResourceRoute = (item: Ec2RecommendationRecord): ResourceRoute => {
    if (item.resourceType === "instance") {
      const next = new URLSearchParams(searchParams.toString());
      const focus = toInstanceDetailFocus(item.type);
      if (!focus) return null;
      next.set("focus", focus);
      next.set("issue", item.type);
      next.set("recommendationId", String(item.id));
      return { pathname: `${INSTANCES_PAGE_PATH}/${item.resourceId}`, search: next.toString() };
    }
    if (item.resourceType === "volume" && item.type === "unattached_volume") {
      return { pathname: `${VOLUMES_PAGE_PATH}/${item.resourceId}`, search: searchParams.toString() };
    }
    return null;
  };

  const openResource = (item: Ec2RecommendationRecord) => {
    const route = getResourceRoute(item);
    if (!route) return;
    navigate(route);
  };

  const navigateToOptimizationRecommendations = (updates: { issueType?: string; resourceId?: string }) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("issueType");
    nextParams.delete("resourceId");
    nextParams.delete("instanceId");
    nextParams.delete("search");

    if (updates.issueType) nextParams.set("issueType", updates.issueType);
    if (updates.resourceId) nextParams.set("resourceId", updates.resourceId);

    navigate({ pathname: location.pathname, search: nextParams.toString() });
  };

  const allRows = useMemo(() => {
    const data = query.data?.recommendations;
    if (!data) return [];
    return [...data.compute, ...data.storage, ...data.pricing, ...data.network];
  }, [query.data]);

  const scopedRows = useMemo(() => {
    return allRows.filter((item) => {
      const resourcePass = item.resourceType !== "load_balancer";
      if (!resourcePass) return false;
      const regionPass =
        globalScopeFilters.region.length === 0 ||
        (item.region !== null && globalScopeFilters.region.includes(item.region));
      const tagPass =
        globalScopeFilters.tags.length === 0 ||
        globalScopeFilters.tags.some((tag) => {
          const text = JSON.stringify(item.metadata ?? {}).toLowerCase();
          return text.includes(tag.toLowerCase());
        });
      return regionPass && tagPass;
    });
  }, [allRows, globalScopeFilters]);

  const totalSavings = (rows: Ec2RecommendationRecord[]) =>
    rows.reduce((sum, row) => sum + (row.estimatedMonthlySaving || 0), 0);

  const recommendationFilterOptions = useMemo(() => {
    const categories: FilterOption[] = [
      { key: "all", label: "All" },
      { key: "compute", label: "Compute" },
      { key: "storage", label: "Storage" },
      { key: "pricing", label: "Pricing" },
      { key: "network", label: "Network" },
    ];

    const issueTypes = Array.from(new Set(scopedRows.map((item) => item.type))).sort();
    return {
      categories,
      issueTypes: [{ key: "all", label: "All" }, ...issueTypes.map((type) => ({ key: type, label: typeLabel(type as Ec2RecommendationType) }))],
      severity: [
        { key: "all", label: "All" },
        { key: "low", label: "Low" },
        { key: "medium", label: "Medium" },
        { key: "high", label: "High" },
      ],
    };
  }, [scopedRows]);

  const filteredRecommendations = useMemo(
    () => {
      const rows = scopedRows.filter((item) => {
        const effectiveStatus = normalizeStatus(statusOverrides[item.id] ?? item.status);
        if (statusFilter === "active" && !activeStatuses.includes(effectiveStatus)) return false;
        if (statusFilter !== "active" && statusFilter !== "all" && effectiveStatus !== statusFilter) return false;
        if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
        if (issueTypeFilter !== "all" && item.type !== issueTypeFilter) return false;
        if (severityFilter !== "all" && item.risk !== severityFilter) return false;
        const query = deferredSearchFilter.trim().toLowerCase();
        if (query.length > 0) {
          const haystack = [
            item.resourceName,
            item.resourceId,
            item.type,
            item.category,
            item.action,
          ]
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(query)) return false;
        }
        return true;
      });
      return rows.sort((a, b) => {
        const statusDelta = statusSortRank[normalizeStatus(statusOverrides[a.id] ?? a.status)] - statusSortRank[normalizeStatus(statusOverrides[b.id] ?? b.status)];
        if (statusDelta !== 0) return statusDelta;
        const savingsDelta = (b.estimatedMonthlySaving ?? 0) - (a.estimatedMonthlySaving ?? 0);
        if (savingsDelta !== 0) return savingsDelta;
        const riskDelta = riskSortRank[b.risk] - riskSortRank[a.risk];
        if (riskDelta !== 0) return riskDelta;
        return effortSortRank[a.effort] - effortSortRank[b.effort];
      });
    },
    [scopedRows, statusOverrides, statusFilter, categoryFilter, issueTypeFilter, severityFilter, deferredSearchFilter],
  );

  const updateRecommendationStatus = async (
    item: Ec2RecommendationRecord,
    nextStatus: Ec2RecommendationStatus,
    options?: { snoozedUntil?: string | null },
  ) => {
    if (!scope) return;
    const previousStatus = normalizeStatus(statusOverrides[item.id] ?? item.status);
    const previousSnoozedUntil = snoozeUntilOverrides[item.id] ?? item.snoozedUntil ?? null;
    const reason = (nextStatus === "dismissed" || nextStatus === "completed")
      ? window.prompt("Optional reason/note", "")?.trim() || null
      : null;
    const snoozed_until = nextStatus === "snoozed" ? options?.snoozedUntil ?? null : null;
    setPendingRecommendationId(item.id);
    setStatusOverrides((prev) => ({ ...prev, [item.id]: nextStatus }));
    setSnoozeUntilOverrides((prev) => ({ ...prev, [item.id]: snoozed_until }));
    try {
      await dashboardApi.updateEc2RecommendationStatus(scope, item.id, { status: nextStatus, reason, snoozed_until });
      setActionMessage(nextStatus === "snoozed" && snoozed_until ? `Snoozed until ${snoozed_until}` : "Recommendation updated");
      void query.refetch();
    } catch {
      setStatusOverrides((prev) => ({ ...prev, [item.id]: previousStatus }));
      setSnoozeUntilOverrides((prev) => ({ ...prev, [item.id]: previousSnoozedUntil }));
      setActionMessage("Failed to update recommendation");
    } finally {
      setPendingRecommendationId(null);
      window.setTimeout(() => setActionMessage(null), 3000);
    }
  };

  const requestStatusChange = (item: Ec2RecommendationRecord, nextStatus: Ec2RecommendationStatus) => {
    if (nextStatus === "snoozed") {
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + 7);
      setSnoozeTarget(item);
      setSnoozePreset("7");
      setCustomSnoozeDate(toIsoDate(nextDate));
      return;
    }
    void updateRecommendationStatus(item, nextStatus);
  };

  const submitSnooze = () => {
    if (!snoozeTarget) return;
    let snoozedUntil = customSnoozeDate;
    if (snoozePreset === "7" || snoozePreset === "30") {
      const date = new Date();
      date.setDate(date.getDate() + Number(snoozePreset));
      snoozedUntil = toIsoDate(date);
    }
    if (!snoozedUntil) return;
    const item = snoozeTarget;
    setSnoozeTarget(null);
    void updateRecommendationStatus(item, "snoozed", { snoozedUntil });
  };

  const topTypeSummary = useMemo(() => {
    const byType = new Map<Ec2RecommendationType, { count: number; saving: number; risk: Ec2RecommendationRecord["risk"] }>();
    for (const row of scopedRows) {
      const current = byType.get(row.type) ?? { count: 0, saving: 0, risk: row.risk };
      byType.set(row.type, {
        count: current.count + 1,
        saving: current.saving + (row.estimatedMonthlySaving || 0),
        risk: current.risk,
      });
    }
    return Array.from(byType.entries())
      .map(([type, metrics]) => ({ type, ...metrics }))
      .sort((a, b) => b.saving - a.saving)
      .slice(0, 5);
  }, [scopedRows]);

  const topRecommendationsBySavings = useMemo(
    () => [...scopedRows].sort((a, b) => b.estimatedMonthlySaving - a.estimatedMonthlySaving).slice(0, 5),
    [scopedRows],
  );

  const unifiedCols = useMemo<ColDef<Ec2RecommendationRecord>[]>(
    () => [
      {
        headerName: "Resource",
        field: "resourceName",
        minWidth: 170,
        cellRenderer: (p: { data?: Ec2RecommendationRecord }) => {
          if (!p.data) return null;
          const row = p.data;
          const label = row.resourceName || row.resourceId;
          const route = getResourceRoute(row);
          if (!route) return <span className="optimization-resource-text">{label}</span>;
          const href = `${route.pathname}${route.search ? `?${route.search}` : ""}`;
          return (
            <a
              href={href}
              className="optimization-resource-link"
              data-stop-row-click="true"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                openResource(row);
              }}
            >
              {label}
            </a>
          );
        },
      },
      { headerName: "Category", valueGetter: (p) => toTitle(p.data?.category ?? "-"), minWidth: 110, maxWidth: 125 },
      {
        headerName: "Issue Type",
        valueGetter: (p) => typeLabel((p.data?.type ?? "idle_instance") as Ec2RecommendationType),
        minWidth: 165,
      },
      {
        headerName: "Evidence Summary",
        valueGetter: (p) => p.data ? formatRecommendationEvidence(p.data.type, p.data.evidence).summary : "-",
        minWidth: 220,
      },
      { headerName: "Recommended Action", valueGetter: (p) => truncateText(p.data?.action, 78), minWidth: 210, tooltipField: "action" },
      { headerName: "Saving", valueGetter: (p) => formatCurrency(p.data?.estimatedMonthlySaving), minWidth: 115, maxWidth: 130 },
      {
        headerName: "Risk",
        maxWidth: 110,
        cellRenderer: (p: { data?: Ec2RecommendationRecord }) =>
          p.data ? <span className={`optimization-rightsizing-pill is-risk-${toRiskClassName(p.data.risk)}`}>{toTitle(p.data.risk)}</span> : null,
      },
      {
        headerName: "Effort",
        maxWidth: 115,
        cellRenderer: (p: { data?: Ec2RecommendationRecord }) =>
          p.data ? <span className={`optimization-rightsizing-pill is-effort-${toRiskClassName(p.data.effort)}`}>{toTitle(p.data.effort)}</span> : null,
      },
      {
        headerName: "Status",
        maxWidth: 140,
        cellRenderer: (p: { data?: Ec2RecommendationRecord }) =>
          p.data ? <StatusBadge status={normalizeStatus(statusOverrides[p.data.id] ?? p.data.status)} /> : null,
      },
      {
        headerName: "Actions",
        minWidth: 150,
        maxWidth: 170,
        pinned: "right",
        cellRenderer: (p: { data?: Ec2RecommendationRecord }) => {
          if (!p.data) return null;
          const row = p.data;
          return (
            <RecommendationActions
              item={row}
              status={normalizeStatus(statusOverrides[row.id] ?? row.status)}
              pending={pendingRecommendationId === row.id}
              canOpenResource={Boolean(getResourceRoute(row))}
              onStatusChange={requestStatusChange}
              onViewDetails={setSelectedRecommendation}
              onOpenResource={openResource}
            />
          );
        },
      },
    ],
    [statusOverrides, pendingRecommendationId, searchParams],
  );

  const errorMessage =
    query.error instanceof ApiError
      ? query.error.message
      : query.error instanceof Error
        ? query.error.message
        : null;

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ id: string; label: string; value: string; onRemove: () => void }> = [];
    const resourceId = queryResourceId;
    if (resourceId) {
      chips.push({
        id: "resourceId",
        label: "Resource",
        value: resourceId,
        onRemove: () => {
          if (searchFilter.trim() === resourceId) setSearchFilter("");
        },
      });
    }
    if (categoryFilter !== "all") {
      chips.push({ id: "category", label: "Category", value: toTitle(categoryFilter), onRemove: () => setCategoryFilter("all") });
    }
    if (issueTypeFilter !== "all") {
      chips.push({ id: "issueType", label: "Issue Type", value: typeLabel(issueTypeFilter as Ec2RecommendationType), onRemove: () => setIssueTypeFilter("all") });
    }
    if (searchFilter.trim()) {
      chips.push({ id: "search", label: "Search", value: searchFilter.trim(), onRemove: () => setSearchFilter("") });
    }
    return chips;
  }, [categoryFilter, issueTypeFilter, searchFilter, queryResourceId]);

  const clearRecommendationFilters = () => {
    setCategoryFilter("all");
    setIssueTypeFilter("all");
    setStatusFilter("active");
    setSeverityFilter("all");
    setSearchFilter("");
    setActiveDropdown(null);
  };

  const selectedStatus = selectedRecommendation
    ? normalizeStatus(statusOverrides[selectedRecommendation.id] ?? selectedRecommendation.status)
    : "open";
  const selectedEvidence = selectedRecommendation
    ? formatRecommendationEvidence(selectedRecommendation.type, selectedRecommendation.evidence)
    : null;
  const selectedResourceRoute = selectedRecommendation ? getResourceRoute(selectedRecommendation) : null;
  const selectedConfidence = selectedRecommendation
    ? getMetadataValue(selectedRecommendation, "confidence") ?? getMetadataValue(selectedRecommendation, "confidence_score")
    : null;
  const selectedSnoozedUntil = selectedRecommendation
    ? snoozeUntilOverrides[selectedRecommendation.id] ?? selectedRecommendation.snoozedUntil
    : null;
  const selectedWorkflow = getWorkflowActions(selectedStatus);

  return (
    <div className="dashboard-page optimization-page" ref={rootRef}>
      <div className="optimization-header-shell">
        <div className="optimization-header-tabs" role="tablist" aria-label={`${pageTitle} sections`}>
          {MAIN_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`optimization-header-tab ${activeTab === tab.key ? "is-active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
              role="tab"
              aria-selected={activeTab === tab.key}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {query.isLoading ? <p className="dashboard-note">Loading optimization data...</p> : null}
      {errorMessage ? <p className="dashboard-note">{errorMessage}</p> : null}

      {activeTab === "overview" ? (
        <section className="dashboard-widget-shell">
          <div className="dashboard-widget-shell__body optimization-tab-body">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <article className="optimization-verified-item">
                <p className="optimization-overview-insight-item__title">Total Potential Savings</p>
                <p className="optimization-overview-insight-item__value">{formatCurrency(totalSavings(scopedRows))}</p>
              </article>
              <article className="optimization-verified-item">
                <p className="optimization-overview-insight-item__title">Compute Savings</p>
                <p className="optimization-overview-insight-item__value">
                  {formatCurrency(totalSavings(scopedRows.filter((x) => x.category === "compute")))}
                </p>
              </article>
              <article className="optimization-verified-item">
                <p className="optimization-overview-insight-item__title">Storage Savings</p>
                <p className="optimization-overview-insight-item__value">
                  {formatCurrency(totalSavings(scopedRows.filter((x) => x.category === "storage")))}
                </p>
              </article>
              <article className="optimization-verified-item">
                <p className="optimization-overview-insight-item__title">Network Savings</p>
                <p className="optimization-overview-insight-item__value">
                  {formatCurrency(totalSavings(scopedRows.filter((x) => x.category === "network")))}
                </p>
              </article>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <article className="optimization-verified-item">
                <p className="optimization-overview-insight-item__title">Top Recommendation Types</p>
                <div className="mt-3 space-y-2">
                  {topTypeSummary.map((item) => (
                    <button
                      key={item.type}
                      type="button"
                      className="optimization-overview-nav-link flex w-full items-center justify-between text-sm text-left"
                      onClick={() => navigateToOptimizationRecommendations({ issueType: item.type })}
                    >
                      <span>{`${typeLabel(item.type)} \u2014 ${formatCurrency(item.saving)} (${item.count} ${item.count === 1 ? "resource" : "resources"})`}</span>
                      <span className={`optimization-rightsizing-pill is-risk-${toRiskClassName(item.risk)}`}>
                        {`${toTitle(item.risk ?? "-")} Risk`}
                      </span>
                    </button>
                  ))}
                </div>
              </article>

              <article className="optimization-verified-item">
                <p className="optimization-overview-insight-item__title">Top 5 Recommendations by Savings</p>
                <div className="mt-3 space-y-2">
                  {topRecommendationsBySavings.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="optimization-overview-nav-link flex w-full items-center justify-between text-sm gap-3 text-left"
                      onClick={() => navigateToOptimizationRecommendations({ resourceId: item.resourceId })}
                    >
                      <span className="truncate">{item.resourceName || item.resourceId}</span>
                      <span>{formatCurrency(item.estimatedMonthlySaving)}</span>
                    </button>
                  ))}
                </div>
              </article>
            </div>
            <div className="mt-4">
              <button
                type="button"
                className="optimization-overview-nav-link cost-explorer-chip-bar__clear cost-explorer-chip-bar__clear--inline"
                onClick={() => {
                  const nextParams = new URLSearchParams(searchParams.toString());
                  nextParams.set("tab", "recommendations");
                  navigate({
                    pathname: "/dashboard/ec2/optimization",
                    search: nextParams.toString(),
                  });
                }}
              >
                View All Recommendations 
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "recommendations" ? (
        <section className="dashboard-widget-shell">
          <div className="dashboard-widget-shell__body optimization-tab-body">
            <div className="cost-explorer-toolbar-row ec2-explorer-toolbar-row--primary">
              <div className="cost-explorer-toolbar-item">
                <button
                  type="button"
                  className="cost-explorer-toolbar-trigger"
                  onClick={() => {
                    setActiveDropdown(null);
                    setScopeFiltersOpen(true);
                  }}
                >
                  <span className="cost-explorer-toolbar-trigger__row">
                    <span className="cost-explorer-toolbar-trigger__value">Filters</span>
                    <Filter className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
                  </span>
                </button>
              </div>
              <FilterDropdown
                label="Category"
                selected={categoryFilter}
                options={recommendationFilterOptions.categories}
                isOpen={activeDropdown === "category"}
                onToggle={() => setActiveDropdown((v) => (v === "category" ? null : "category"))}
                onSelect={(key) => {
                  setCategoryFilter(key);
                  setActiveDropdown(null);
                }}
              />
              <FilterDropdown
                label="Issue Type"
                selected={issueTypeFilter}
                options={recommendationFilterOptions.issueTypes}
                isOpen={activeDropdown === "issueType"}
                onToggle={() => setActiveDropdown((v) => (v === "issueType" ? null : "issueType"))}
                onSelect={(key) => {
                  setIssueTypeFilter(key);
                  setActiveDropdown(null);
                }}
              />
              <FilterDropdown
                label="Status"
                selected={statusFilter}
                options={[
                  { key: "active", label: "Open + In Progress" },
                  { key: "open", label: "Open" },
                  { key: "in_progress", label: "In Progress" },
                  { key: "snoozed", label: "Snoozed" },
                  { key: "dismissed", label: "Dismissed" },
                  { key: "completed", label: "Completed" },
                  { key: "all", label: "All" },
                ]}
                isOpen={activeDropdown === "status"}
                onToggle={() => setActiveDropdown((v) => (v === "status" ? null : "status"))}
                onSelect={(key) => {
                  setStatusFilter(key);
                  setActiveDropdown(null);
                }}
              />
              <FilterDropdown
                label="Severity"
                selected={severityFilter}
                options={recommendationFilterOptions.severity}
                isOpen={activeDropdown === "severity"}
                onToggle={() => setActiveDropdown((v) => (v === "severity" ? null : "severity"))}
                onSelect={(key) => {
                  setSeverityFilter(key);
                  setActiveDropdown(null);
                }}
              />
              <div className="cost-explorer-toolbar-item">
                <label className="cost-explorer-toolbar-trigger ec2-instances-search-trigger">
                  <span className="ec2-instances-search-trigger__icon-wrap" aria-hidden="true">
                    <Search size={14} />
                  </span>
                  <input
                    type="search"
                    value={searchFilter}
                    onChange={(event) => setSearchFilter(event.target.value)}
                    placeholder="Search recommendations"
                    aria-label="Search recommendations"
                    className="ec2-instances-search-trigger__input"
                  />
                </label>
              </div>
              <div className="cost-explorer-toolbar-item">
                <button
                  type="button"
                  className="cost-explorer-toolbar-trigger ec2-instances-toolbar-icon-trigger"
                  onClick={clearRecommendationFilters}
                  aria-label="Reset recommendation filters"
                  title="Reset recommendation filters"
                >
                  <span className="cost-explorer-toolbar-trigger__row ec2-instances-toolbar-icon-trigger__row">
                    <RotateCcw size={14} />
                  </span>
                </button>
              </div>
            </div>
            {actionMessage ? <p className="dashboard-note">{actionMessage}</p> : null}
            {activeFilterChips.length > 0 ? (
              <div className="cost-explorer-chip-bar" aria-label="Active recommendation filters">
                <div className="cost-explorer-chip-row">
                  {activeFilterChips.map((chip) => (
                    <span key={chip.id} className="cost-explorer-chip">
                      <span className="cost-explorer-chip__edit">
                        {chip.label}: {chip.value}
                      </span>
                      <button type="button" className="cost-explorer-chip__remove" onClick={chip.onRemove} aria-label={`Remove ${chip.label}`}>
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  <button type="button" className="cost-explorer-chip-bar__clear cost-explorer-chip-bar__clear--inline" onClick={clearRecommendationFilters}>
                    Clear all
                  </button>
                </div>
              </div>
            ) : null}

            <BaseDataTable
              columnDefs={unifiedCols}
              rowData={filteredRecommendations}
              pagination
              paginationPageSize={10}
              autoHeight
              onRowClick={setSelectedRecommendation}
              emptyMessage="No recommendations found"
            />
          </div>
        </section>
      ) : null}

      <Dialog open={Boolean(selectedRecommendation)} onOpenChange={(open) => {
        if (!open) setSelectedRecommendation(null);
      }}>
        <DialogContent className="optimization-recommendation-drawer left-auto right-0 top-0 flex h-screen max-h-screen w-[min(100vw,40rem)] max-w-none -translate-x-0 -translate-y-0 flex-col rounded-none border-l border-[color:var(--border-light)] p-0 data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100">
          {selectedRecommendation ? (
            <>
              <DialogHeader className="optimization-drawer-header">
                <div className="optimization-drawer-title-row">
                  <DialogTitle className="optimization-drawer-title">
                    {typeLabel(selectedRecommendation.type)}
                  </DialogTitle>
                  <StatusBadge status={selectedStatus} />
                </div>
                <div className="optimization-drawer-subtitle">
                  <span>{toTitle(selectedRecommendation.category)}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">{selectedRecommendation.resourceName || selectedRecommendation.resourceId}</span>
                </div>
                {selectedStatus === "snoozed" && selectedSnoozedUntil ? (
                  <p className="optimization-drawer-snooze-note">Snoozed until {selectedSnoozedUntil}</p>
                ) : null}
              </DialogHeader>

              <div className="optimization-drawer-body">
                <div className="optimization-drawer-metric-grid">
                  <article className="optimization-drawer-metric-card">
                  <p className="optimization-overview-insight-item__title">Estimated savings</p>
                  <p className="optimization-overview-insight-item__value text-base">{formatCurrency(selectedRecommendation.estimatedMonthlySaving)}</p>
                </article>
                  <article className="optimization-drawer-metric-card">
                  <p className="optimization-overview-insight-item__title">Risk</p>
                  <p className="mt-2"><span className={`optimization-rightsizing-pill is-risk-${toRiskClassName(selectedRecommendation.risk)}`}>{toTitle(selectedRecommendation.risk)}</span></p>
                </article>
                  <article className="optimization-drawer-metric-card">
                  <p className="optimization-overview-insight-item__title">Effort</p>
                  <p className="mt-2"><span className={`optimization-rightsizing-pill is-effort-${toRiskClassName(selectedRecommendation.effort)}`}>{toTitle(selectedRecommendation.effort)}</span></p>
                </article>
                  <article className="optimization-drawer-metric-card">
                  <p className="optimization-overview-insight-item__title">Status</p>
                  <p className="mt-2"><StatusBadge status={selectedStatus} /></p>
                </article>
                {selectedConfidence ? (
                    <article className="optimization-drawer-metric-card">
                    <p className="optimization-overview-insight-item__title">Confidence</p>
                    <p className="optimization-overview-insight-item__value text-base">{selectedConfidence}</p>
                  </article>
                ) : null}
                </div>

                <section className="optimization-drawer-section">
                  <h3>Summary</h3>
                  <p>{selectedRecommendation.problem || "This recommendation may reduce waste, improve reliability, or make ownership clearer for the resource."}</p>
                </section>

                <section className="optimization-drawer-section">
                  <h3>Evidence</h3>
                  {selectedEvidence && selectedEvidence.rows.length > 0 ? (
                    <dl className="optimization-drawer-evidence">
                      {selectedEvidence.rows.map((row) => (
                        <div key={row.key} className="optimization-drawer-evidence__row">
                          <dt>{row.label}</dt>
                          <dd>{row.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p>{selectedEvidence?.summary ?? "No structured evidence available."}</p>
                  )}
                </section>

                <section className="optimization-drawer-section">
                  <h3>Recommended action</h3>
                  <div className="optimization-drawer-callout">
                    {selectedRecommendation.action || "Review this resource and choose the next workflow action."}
                  </div>
                </section>

                <section className="optimization-drawer-section">
                  <h3>Resource context</h3>
                  <dl className="optimization-drawer-evidence">
                    <div className="optimization-drawer-evidence__row">
                      <dt>Resource</dt>
                      <dd>{selectedRecommendation.resourceName || selectedRecommendation.resourceId}</dd>
                    </div>
                    <div className="optimization-drawer-evidence__row">
                      <dt>Resource ID</dt>
                      <dd>{selectedRecommendation.resourceId}</dd>
                    </div>
                    <div className="optimization-drawer-evidence__row">
                      <dt>Category</dt>
                      <dd>{toTitle(selectedRecommendation.category)}</dd>
                    </div>
                    <div className="optimization-drawer-evidence__row">
                      <dt>Account</dt>
                      <dd>{selectedRecommendation.accountId ?? "-"}</dd>
                    </div>
                    <div className="optimization-drawer-evidence__row">
                      <dt>Region</dt>
                      <dd>{selectedRecommendation.region ?? "-"}</dd>
                    </div>
                    <div className="optimization-drawer-evidence__row">
                      <dt>Team</dt>
                      <dd>{getMetadataValue(selectedRecommendation, "team") ?? "-"}</dd>
                    </div>
                  </dl>
                </section>
              </div>

              <div className="optimization-drawer-footer">
                <div className="optimization-drawer-footer__label">Workflow</div>
                <div className="optimization-drawer-footer__actions">
                  <button
                    type="button"
                    className="optimization-drawer-action optimization-drawer-action--primary"
                    disabled={pendingRecommendationId === selectedRecommendation.id}
                    onClick={() => {
                      if (selectedWorkflow.primary.status) requestStatusChange(selectedRecommendation, selectedWorkflow.primary.status);
                    }}
                  >
                    {selectedWorkflow.primary.label}
                  </button>
                  {selectedWorkflow.secondary.map((option) => (
                    <button
                      key={option.label}
                      type="button"
                      className="optimization-drawer-action"
                      disabled={pendingRecommendationId === selectedRecommendation.id}
                      onClick={() => {
                        if (option.status) requestStatusChange(selectedRecommendation, option.status);
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="optimization-drawer-action"
                    disabled={!selectedResourceRoute}
                    onClick={() => openResource(selectedRecommendation)}
                  >
                    Open Resource
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(snoozeTarget)} onOpenChange={(open) => {
        if (!open) setSnoozeTarget(null);
      }}>
        <DialogContent
          className="optimization-snooze-dialog"
          onClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base font-semibold text-text-primary">Snooze recommendation</DialogTitle>
          </DialogHeader>
          <div className="optimization-snooze-dialog__body">
            <p className="optimization-snooze-dialog__text">
              Temporarily hide this recommendation until a follow-up date.
            </p>
            <div className="optimization-snooze-options">
              {[
                { key: "7", label: "Snooze 7 days" },
                { key: "30", label: "Snooze 30 days" },
                { key: "custom", label: "Custom date" },
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={`optimization-snooze-option${snoozePreset === option.key ? " is-active" : ""}`}
                  onClick={() => setSnoozePreset(option.key as "7" | "30" | "custom")}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {snoozePreset === "custom" ? (
              <label className="optimization-snooze-date">
                <span>Resume on</span>
                <input
                  type="date"
                  value={customSnoozeDate}
                  onChange={(event) => setCustomSnoozeDate(event.target.value)}
                />
              </label>
            ) : null}
          </div>
          <div className="optimization-snooze-dialog__actions">
            <button type="button" className="optimization-drawer-action" onClick={() => setSnoozeTarget(null)}>
              Cancel
            </button>
            <button type="button" className="optimization-drawer-action optimization-drawer-action--primary" onClick={submitSnooze}>
              Snooze
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={scopeFiltersOpen} onOpenChange={setScopeFiltersOpen}>
        <DialogContent className="left-auto right-0 top-0 h-screen max-h-screen w-[min(96vw,44rem)] max-w-none -translate-x-0 -translate-y-0 rounded-none border-l border-[color:var(--border-light)] p-6 data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-xl font-semibold text-text-primary">Scope Filters</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <EC2ExplorerScopeFilters
              value={globalScopeFilters}
              onChange={setGlobalScopeFilters}
              onApply={() => setScopeFiltersOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

