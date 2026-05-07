import { Search, SlidersHorizontal, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { ColDef, ICellRendererParams, ValueFormatterParams } from "ag-grid-community";
import { useLocation, useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { InventoryLoadBalancerRow } from "@/features/client-home/api/inventory-load-balancers.api";
import { useInventoryLoadBalancers } from "@/features/client-home/hooks/useInventoryLoadBalancers";
import { EmptyStateBlock } from "../../common/components/EmptyStateBlock";
import { BaseDataTable } from "../../common/tables/BaseDataTable";

const PAGE_SIZE = 100;
const LIST_PATH = "/dashboard/inventory/aws/load-balancer/list";

type ListControls = {
  search: string;
  account: string;
  region: string;
  type: string;
  scheme: string;
  state: string;
  team: string;
  product: string;
  environment: string;
  tags: string;
  sortBy: "name" | "type" | "scheme" | "region" | "totalCost" | "fixedCost" | "lcuCost" | "dataProcessingCost";
  sortDirection: "asc" | "desc";
};

const DEFAULT_CONTROLS: ListControls = {
  search: "",
  account: "",
  region: "",
  type: "",
  scheme: "",
  state: "",
  team: "",
  product: "",
  environment: "",
  tags: "",
  sortBy: "name",
  sortDirection: "asc",
};

const CURRENCY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

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

const formatType = (value: string | null | undefined): string => {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "application") return "Application";
  if (normalized === "network") return "Network";
  return toTitle(value);
};

const formatScheme = (value: string | null | undefined): string => {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "internet-facing") return "Internet-facing";
  if (normalized === "internal") return "Internal";
  return toTitle(value);
};

const formatState = (value: string | null | undefined): string => {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "active") return "Active";
  if (normalized === "provisioning") return "Provisioning";
  if (normalized === "failed") return "Failed";
  return toTitle(value);
};

const parseCsv = (value: string): string[] =>
  value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

export default function LoadBalancerListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [controls, setControls] = useState<ListControls>({
    ...DEFAULT_CONTROLS,
    search: params.get("search") ?? "",
  });

  const startDate =
    params.get("startDate") ??
    params.get("from") ??
    params.get("billingPeriodStart") ??
    undefined;
  const endDate =
    params.get("endDate") ??
    params.get("to") ??
    params.get("billingPeriodEnd") ??
    undefined;

  const query = useInventoryLoadBalancers({
    startDate,
    endDate,
    search: controls.search.trim() || null,
    account: controls.account.trim() || null,
    region: controls.region.trim() || null,
    type: controls.type.trim() || null,
    scheme: controls.scheme.trim() || null,
    state: controls.state.trim() || null,
    team: controls.team.trim() || null,
    product: controls.product.trim() || null,
    environment: controls.environment.trim() || null,
    tags: parseCsv(controls.tags),
    sortBy: controls.sortBy,
    sortDirection: controls.sortDirection,
    page: 1,
    pageSize: PAGE_SIZE,
  });

  const rows = query.data?.items ?? [];

  const columnDefs = useMemo<ColDef<InventoryLoadBalancerRow>[]>(
    () => [
      {
        headerName: "Name",
        field: "name",
        minWidth: 240,
        cellRenderer: (params: ICellRendererParams<InventoryLoadBalancerRow>) => {
          const row = params.data;
          if (!row) return "-";
          return (
            <div className="ec2-instances-table__instance-cell">
              <strong>{row.name}</strong>
              <span>{row.arn ?? row.id}</span>
            </div>
          );
        },
      },
      { headerName: "Type", field: "type", minWidth: 120, valueFormatter: (p) => formatType(String(p.value ?? "")) },
      { headerName: "Scheme", field: "scheme", minWidth: 140, valueFormatter: (p) => formatScheme(String(p.value ?? "")) },
      { headerName: "State", field: "state", minWidth: 130, valueFormatter: (p) => formatState(String(p.value ?? "")) },
      { headerName: "Region", field: "region", minWidth: 120, valueFormatter: (p) => p.value ?? "-" },
      {
        headerName: "Total Cost",
        field: "totalCost",
        minWidth: 122,
        valueFormatter: (p: ValueFormatterParams<InventoryLoadBalancerRow, number>) => CURRENCY.format(Number(p.value ?? 0)),
      },
      {
        headerName: "Fixed Cost",
        field: "fixedCost",
        minWidth: 122,
        valueFormatter: (p: ValueFormatterParams<InventoryLoadBalancerRow, number>) => CURRENCY.format(Number(p.value ?? 0)),
      },
      {
        headerName: "LCU Cost",
        field: "lcuCost",
        minWidth: 118,
        valueFormatter: (p: ValueFormatterParams<InventoryLoadBalancerRow, number>) => CURRENCY.format(Number(p.value ?? 0)),
      },
      {
        headerName: "Data Processing Cost",
        field: "dataProcessingCost",
        minWidth: 160,
        valueFormatter: (p: ValueFormatterParams<InventoryLoadBalancerRow, number>) => CURRENCY.format(Number(p.value ?? 0)),
      },
    ],
    [],
  );

  const chips = useMemo(() => {
    const entries: Array<{ id: keyof ListControls; label: string; value: string }> = [];
    const push = (id: keyof ListControls, label: string, value: string) => {
      if (!value.trim()) return;
      entries.push({ id, label, value: value.trim() });
    };
    push("account", "Account", controls.account);
    push("region", "Region", controls.region);
    push("type", "Type", controls.type);
    push("scheme", "Scheme", controls.scheme);
    push("state", "State", controls.state);
    push("team", "Team", controls.team);
    push("product", "Product", controls.product);
    push("environment", "Environment", controls.environment);
    push("tags", "Tags", controls.tags);
    return entries;
  }, [controls]);

  return (
    <div className="dashboard-page cost-explorer-page">
      <section aria-label="Load balancer list">
        <section className="cost-explorer-control-surface ec2-explorer-controls">
          <div className="cost-explorer-toolbar-row ec2-explorer-toolbar-row--primary">
            <div className="ec2-instances-toolbar-main">
              <div className="cost-explorer-toolbar-item">
                <label className="cost-explorer-toolbar-trigger ec2-instances-search-trigger">
                  <span className="ec2-instances-search-trigger__icon-wrap" aria-hidden="true">
                    <Search size={14} />
                  </span>
                  <input
                    type="search"
                    value={controls.search}
                    onChange={(event) => {
                      setControls((current) => ({ ...current, search: event.target.value }));
                    }}
                    placeholder="Search by name/arn"
                    aria-label="Search load balancers"
                    className="ec2-instances-search-trigger__input"
                  />
                </label>
              </div>

              <div className="cost-explorer-toolbar-item">
                <button
                  type="button"
                  className="cost-explorer-toolbar-trigger ec2-instances-toolbar-icon-trigger"
                  onClick={() => setFiltersOpen(true)}
                  aria-label="Filters"
                  title="Filters"
                >
                  <span className="cost-explorer-toolbar-trigger__row ec2-instances-toolbar-icon-trigger__row">
                    <SlidersHorizontal className="ec2-instances-toolbar-icon-trigger__icon" size={16} aria-hidden="true" />
                  </span>
                </button>
              </div>

              <div className="cost-explorer-toolbar-item">
                <label className="cost-explorer-toolbar-trigger">
                  <span className="cost-explorer-toolbar-trigger__label">Sort</span>
                  <select
                    value={controls.sortBy}
                    onChange={(event) => {
                      setControls((current) => ({
                        ...current,
                        sortBy: event.target.value as ListControls["sortBy"],
                      }));
                    }}
                  >
                    <option value="name">Name</option>
                    <option value="type">Type</option>
                    <option value="scheme">Scheme</option>
                    <option value="region">Region</option>
                    <option value="totalCost">Total Cost</option>
                    <option value="fixedCost">Fixed Cost</option>
                    <option value="lcuCost">LCU Cost</option>
                    <option value="dataProcessingCost">Data Processing Cost</option>
                  </select>
                </label>
              </div>

              <div className="cost-explorer-toolbar-item">
                <label className="cost-explorer-toolbar-trigger">
                  <span className="cost-explorer-toolbar-trigger__label">Direction</span>
                  <select
                    value={controls.sortDirection}
                    onChange={(event) => {
                      setControls((current) => ({
                        ...current,
                        sortDirection: event.target.value as ListControls["sortDirection"],
                      }));
                    }}
                  >
                    <option value="asc">Ascending</option>
                    <option value="desc">Descending</option>
                  </select>
                </label>
              </div>
            </div>
          </div>

          <div className="cost-explorer-chip-bar" aria-label="Selected filter summary">
            <div className="cost-explorer-chip-row">
              {chips.map((chip) => (
                <span key={chip.id} className="cost-explorer-chip">
                  <span className="cost-explorer-chip__edit">
                    {chip.label}: {chip.value}
                  </span>
                  <button
                    type="button"
                    className="cost-explorer-chip__remove"
                    onClick={() => setControls((current) => ({ ...current, [chip.id]: "" }))}
                    aria-label={`Remove ${chip.label}`}
                  >
                    <X size={13} aria-hidden="true" />
                  </button>
                </span>
              ))}
              <button
                type="button"
                className="cost-explorer-chip-bar__clear cost-explorer-chip-bar__clear--inline"
                onClick={() => {
                  setControls(DEFAULT_CONTROLS);
                }}
              >
                Clear all
              </button>
            </div>
          </div>
        </section>

        <section className="ec2-explorer-table-panel" aria-label="Load balancer table">
          {query.isLoading ? (
            <div className="ec2-explorer-table__skeleton" aria-hidden="true" />
          ) : query.isError ? (
            <EmptyStateBlock
              title="Unable to load load balancers"
              message={query.error.message || "An unexpected error occurred."}
              actions={
                <button type="button" className="cost-explorer-state-btn" onClick={() => void query.refetch()}>
                  Retry
                </button>
              }
            />
          ) : rows.length === 0 ? (
            <EmptyStateBlock
              title="No load balancers found"
              message="No load balancers match the active filters. Try adjusting or clearing filters."
            />
          ) : (
            <section className="ec2-explorer-table ec2-instances-table" aria-label="Load balancers table">
              <BaseDataTable
                columnDefs={columnDefs}
                rowData={rows}
                pagination
                paginationPageSize={10}
                autoHeight
                onRowClick={(row) => {
                  const next = new URLSearchParams(location.search);
                  next.set("loadBalancerName", row.name);
                  const routeKey = row.arn ?? row.id;
                  navigate({ pathname: `${LIST_PATH}/${encodeURIComponent(routeKey)}`, search: next.toString() });
                }}
              />
            </section>
          )}
        </section>
      </section>

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="left-auto right-0 top-0 h-screen max-h-screen w-[min(96vw,44rem)] max-w-none -translate-x-0 -translate-y-0 rounded-none border-l border-[color:var(--border-light)] p-6 data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-xl font-semibold text-text-primary">Load Balancer Filters</DialogTitle>
          </DialogHeader>
          <div className="mt-4 ec2-explorer-thresholds">
            <div className="ec2-explorer-thresholds__grid">
              <label className="ec2-explorer-thresholds__field"><span>Account</span><input value={controls.account} onChange={(e) => setControls((c) => ({ ...c, account: e.target.value }))} /></label>
              <label className="ec2-explorer-thresholds__field"><span>Region</span><input value={controls.region} onChange={(e) => setControls((c) => ({ ...c, region: e.target.value }))} /></label>
              <label className="ec2-explorer-thresholds__field"><span>Type</span><input value={controls.type} onChange={(e) => setControls((c) => ({ ...c, type: e.target.value }))} /></label>
              <label className="ec2-explorer-thresholds__field"><span>Scheme</span><input value={controls.scheme} onChange={(e) => setControls((c) => ({ ...c, scheme: e.target.value }))} /></label>
              <label className="ec2-explorer-thresholds__field"><span>State</span><input value={controls.state} onChange={(e) => setControls((c) => ({ ...c, state: e.target.value }))} /></label>
              <label className="ec2-explorer-thresholds__field"><span>Team</span><input value={controls.team} onChange={(e) => setControls((c) => ({ ...c, team: e.target.value }))} /></label>
              <label className="ec2-explorer-thresholds__field"><span>Product</span><input value={controls.product} onChange={(e) => setControls((c) => ({ ...c, product: e.target.value }))} /></label>
              <label className="ec2-explorer-thresholds__field"><span>Environment</span><input value={controls.environment} onChange={(e) => setControls((c) => ({ ...c, environment: e.target.value }))} /></label>
              <label className="ec2-explorer-thresholds__field"><span>Tags</span><input placeholder="key:value, key2:value2" value={controls.tags} onChange={(e) => setControls((c) => ({ ...c, tags: e.target.value }))} /></label>
            </div>
            <div className="cost-explorer-filter-popover__actions">
              <button
                type="button"
                className="cost-explorer-filter-popover__apply"
                onClick={() => {
                  setFiltersOpen(false);
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
