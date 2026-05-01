import { Check, ChevronDown, Filter, RotateCcw, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { ColDef } from "ag-grid-community";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ApiError } from "@/lib/api";

import { BaseDataTable } from "../../common/tables/BaseDataTable";
import {
  type Ec2RecommendationRecord,
  type Ec2RecommendationType,
  useEc2RecommendationsQuery,
} from "../../hooks/useDashboardQueries";
import { useDashboardScope } from "../../hooks/useDashboardScope";
import { EC2ExplorerScopeFilters } from "./components/EC2ExplorerScopeFilters";
import type { EC2ScopeFilters } from "./ec2ExplorerControls.types";

const INSTANCES_PAGE_PATH = "/dashboard/inventory/aws/ec2/instances";
const VOLUMES_PAGE_PATH = "/dashboard/inventory/aws/ec2/volumes";
type MainTab = "overview" | "recommendations";
type RecommendationsFilterKey = "category" | "issueType" | "severity";
type FilterOption = { key: string; label: string };

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
  if (value === "uncovered_on_demand") return "Uncovered On-Demand";
  if (value === "high_internet_data_transfer") return "High Internet Data Transfer";
  if (value === "high_inter_region_data_transfer") return "High Inter-Region Data Transfer";
  if (value === "high_inter_az_data_transfer") return "High Inter-AZ Data Transfer";
  if (value === "low_cpu_high_network") return "Low CPU / High Network";
  if (value === "high_nat_gateway_cost") return "High NAT Gateway Cost";
  return "Unattached Elastic IP";
};
const truncateText = (value: string | null | undefined, max: number = 90): string => {
  const raw = (value ?? "").trim();
  if (!raw) return "-";
  return raw.length > max ? `${raw.slice(0, max - 1)}...` : raw;
};
const normalizeFilterValue = (value: string | null): string => (value ?? "").trim();
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
  const selectedLabel = options.find((option) => option.key === selected)?.label ?? "All";
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

export default function EC2OptimizationPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { scope } = useDashboardScope();
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
  const [searchFilter, setSearchFilter] = useState("");
  const queryResourceId = normalizeFilterValue(searchParams.get("resourceId") ?? searchParams.get("instanceId"));
  const queryCategory = normalizeFilterValue(searchParams.get("category"));
  const queryIssueType = normalizeFilterValue(searchParams.get("issueType"));
  const querySearch = normalizeFilterValue(searchParams.get("search"));

  useEffect(() => {
    const nextCategory = queryCategory || "all";
    const nextIssueType = queryIssueType || "all";
    const nextSearch = querySearch || queryResourceId || "";

    setCategoryFilter((prev) => (prev === nextCategory ? prev : nextCategory));
    setIssueTypeFilter((prev) => (prev === nextIssueType ? prev : nextIssueType));
    setSearchFilter((prev) => (prev === nextSearch ? prev : nextSearch));
    if (nextCategory !== "all" || nextIssueType !== "all" || nextSearch) {
      setActiveTab("recommendations");
    }
  }, [queryCategory, queryIssueType, queryResourceId, querySearch]);

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

  const query = useEc2RecommendationsQuery({
    dateFrom,
    dateTo,
    region: searchParams.get("region") ?? undefined,
    account: searchParams.get("account") ?? undefined,
    team: searchParams.get("team") ?? undefined,
    product: searchParams.get("product") ?? undefined,
    environment: searchParams.get("environment") ?? searchParams.get("env") ?? undefined,
    tags: parseCsvParam(searchParams.get("tags")),
  });

  const openResource = (item: Ec2RecommendationRecord) => {
    if (item.resourceType === "instance") {
      navigate({ pathname: `${INSTANCES_PAGE_PATH}/${item.resourceId}`, search: searchParams.toString() });
      return;
    }
    if (item.resourceType === "volume") {
      navigate({ pathname: `${VOLUMES_PAGE_PATH}/${item.resourceId}`, search: searchParams.toString() });
    }
  };

  const allRows = useMemo(() => {
    const data = query.data?.recommendations;
    if (!data) return [];
    return [...data.compute, ...data.storage, ...data.pricing, ...data.network];
  }, [query.data]);

  const scopedRows = useMemo(() => {
    return allRows.filter((item) => {
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
    () =>
      scopedRows.filter((item) => {
        if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
        if (issueTypeFilter !== "all" && item.type !== issueTypeFilter) return false;
        if (severityFilter !== "all" && item.risk !== severityFilter) return false;
        const query = searchFilter.trim().toLowerCase();
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
      }),
    [scopedRows, categoryFilter, issueTypeFilter, severityFilter, searchFilter],
  );

  useEffect(() => {
    const desiredCategory = categoryFilter === "all" ? "" : categoryFilter;
    const desiredIssueType = issueTypeFilter === "all" ? "" : issueTypeFilter;
    const desiredSearch = searchFilter.trim();
    const currentCategory = normalizeFilterValue(searchParams.get("category"));
    const currentIssueType = normalizeFilterValue(searchParams.get("issueType"));
    const currentSearch = normalizeFilterValue(searchParams.get("search"));

    if (
      desiredCategory === currentCategory &&
      desiredIssueType === currentIssueType &&
      desiredSearch === currentSearch
    ) {
      return;
    }

    const next = new URLSearchParams(location.search);
    if (desiredCategory) next.set("category", desiredCategory);
    else next.delete("category");
    if (desiredIssueType) next.set("issueType", desiredIssueType);
    else next.delete("issueType");
    if (desiredSearch) next.set("search", desiredSearch);
    else next.delete("search");
    navigate({ pathname: location.pathname, search: next.toString() }, { replace: true });
  }, [categoryFilter, issueTypeFilter, location.pathname, location.search, navigate, searchFilter, searchParams]);

  const topTypeSummary = useMemo(() => {
    const byType = new Map<Ec2RecommendationType, { count: number; saving: number }>();
    for (const row of scopedRows) {
      const current = byType.get(row.type) ?? { count: 0, saving: 0 };
      byType.set(row.type, {
        count: current.count + 1,
        saving: current.saving + (row.estimatedMonthlySaving || 0),
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
      { headerName: "Resource", field: "resourceName", minWidth: 180 },
      { headerName: "Category", valueGetter: (p) => toTitle(p.data?.category ?? "-"), minWidth: 120 },
      {
        headerName: "Issue Type",
        valueGetter: (p) => typeLabel((p.data?.type ?? "idle_instance") as Ec2RecommendationType),
        minWidth: 180,
      },
      { headerName: "Evidence", valueGetter: (p) => truncateText(p.data?.evidence), minWidth: 220, tooltipField: "evidence" },
      { headerName: "Action", valueGetter: (p) => truncateText(p.data?.action), minWidth: 220, tooltipField: "action" },
      { headerName: "Saving", valueGetter: (p) => formatCurrency(p.data?.estimatedMonthlySaving), minWidth: 130 },
      { headerName: "Risk", valueGetter: (p) => toTitle(p.data?.risk ?? "-"), maxWidth: 110 },
      { headerName: "Effort", valueGetter: (p) => toTitle(p.data?.effort ?? "-"), maxWidth: 110 },
      { headerName: "Status", valueGetter: (p) => toTitle(p.data?.status ?? "-"), maxWidth: 120 },
    ],
    [],
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
  }, [categoryFilter, issueTypeFilter, searchFilter, searchParams]);

  const clearRecommendationFilters = () => {
    setCategoryFilter("all");
    setIssueTypeFilter("all");
    setSeverityFilter("all");
    setSearchFilter("");
    setActiveDropdown(null);
  };

  return (
    <div className="dashboard-page optimization-page" ref={rootRef}>
      <div className="optimization-header-shell">
        <div className="optimization-header-tabs" role="tablist" aria-label="EC2 optimization sections">
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
                    <div key={item.type} className="flex items-center justify-between text-sm">
                      <span>{typeLabel(item.type)}</span>
                      <span>{formatCurrency(item.saving)}</span>
                    </div>
                  ))}
                </div>
              </article>

              <article className="optimization-verified-item">
                <p className="optimization-overview-insight-item__title">Top 5 Recommendations by Savings</p>
                <div className="mt-3 space-y-2">
                  {topRecommendationsBySavings.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-sm gap-3">
                      <span className="truncate">{item.resourceName || item.resourceId}</span>
                      <span>{formatCurrency(item.estimatedMonthlySaving)}</span>
                    </div>
                  ))}
                </div>
              </article>
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
              onRowClick={openResource}
              emptyMessage="No recommendations found"
            />
          </div>
        </section>
      ) : null}

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
