import { useEffect, useMemo, useState } from "react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { DashboardPageHeader } from "../../components/DashboardPageHeader";
import {
  useDatabaseOptimizationActionsQuery,
  useDatabaseRecommendationsSummary,
  useDatabaseRecommendationDetail,
  useGenerateDatabaseRecommendations,
} from "../../hooks/useDashboardQueries";
import type {
  DatabaseOptimizationActionRow,
  DatabaseOptimizationActionsFilters,
} from "../../api/dashboardTypes";
import { useLocation, useNavigate } from "react-router-dom";
import { DatabaseRecommendationDetailDrawer } from "./components/DatabaseRecommendationDetailDrawer";
import {
  DatabaseRecommendationsHeaderTabs,
  type DatabaseRecommendationsTabKey,
} from "./components/DatabaseRecommendationsHeaderTabs";
import { DatabaseRecommendationsOverviewTab } from "./components/DatabaseRecommendationsOverviewTab";
import { BaseDataTable } from "../../common/tables/BaseDataTable";
import { formatCurrency, formatInteger, formatPercent } from "./components/db-assets.formatters";

const DEFAULT_LIMIT = 20;

type OptimizationActionsFiltersState = {
  search: string;
  status: string;
  region: string;
  engine: string;
  hasActions: "all" | "with_actions" | "without_actions";
  recommendationType: string;
};

const parseSearch = (search: string): OptimizationActionsFiltersState => {
  const params = new URLSearchParams(search);
  return {
    search: params.get("search") ?? "",
    status: params.get("status") ?? "",
    region: params.get("region") ?? "",
    engine: params.get("engine") ?? "",
    hasActions: (params.get("has_actions") as OptimizationActionsFiltersState["hasActions"]) ?? "all",
    recommendationType: params.get("recommendation_type") ?? "",
  };
};

const parsePositiveInt = (value: string | null, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const parseTab = (search: string): DatabaseRecommendationsTabKey => {
  const raw = (new URLSearchParams(search).get("tab") ?? "overview").trim().toLowerCase();
  if (raw === "overview" || raw === "actions") return raw;
  if (raw === "storage-optimization" || raw === "idle-candidates" || raw === "ha-cost-review" || raw === "engine-deployment-review") return "actions";
  return "overview";
};

export default function DatabaseOptimizationPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [filtersState, setFiltersState] = useState<OptimizationActionsFiltersState>(() => parseSearch(location.search));
  const [activeTab, setActiveTab] = useState<DatabaseRecommendationsTabKey>(() => parseTab(location.search));
  const [page, setPage] = useState<number>(() => parsePositiveInt(new URLSearchParams(location.search).get("page"), 1));
  const [limit, setLimit] = useState<number>(() => parsePositiveInt(new URLSearchParams(location.search).get("limit"), DEFAULT_LIMIT));
  const [selectedRecommendationId, setSelectedRecommendationId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setFiltersState(parseSearch(location.search));
    setActiveTab(parseTab(location.search));
    const params = new URLSearchParams(location.search);
    setPage(parsePositiveInt(params.get("page"), 1));
    setLimit(parsePositiveInt(params.get("limit"), DEFAULT_LIMIT));
  }, [location.search]);

  const filters = useMemo<DatabaseOptimizationActionsFilters>(
    () => ({
      ...(filtersState.status ? { status: filtersState.status } : {}),
      ...(filtersState.region ? { regionKey: filtersState.region } : {}),
      ...(filtersState.engine ? { dbEngine: filtersState.engine } : {}),
      ...(filtersState.search.trim() ? { search: filtersState.search.trim() } : {}),
      ...(filtersState.recommendationType.trim() ? { recommendationType: filtersState.recommendationType.trim() } : {}),
      ...(filtersState.hasActions === "with_actions" ? { hasActions: true } : {}),
      ...(filtersState.hasActions === "without_actions" ? { hasActions: false } : {}),
      page,
      pageSize: limit,
    }),
    [filtersState, page, limit],
  );

  const actionsQuery = useDatabaseOptimizationActionsQuery(activeTab === "actions" ? filters : undefined);
  const summaryQuery = useDatabaseRecommendationsSummary();
  const generateMutation = useGenerateDatabaseRecommendations();
  const detailQuery = useDatabaseRecommendationDetail(drawerOpen && selectedRecommendationId ? selectedRecommendationId : null);

  const listData = actionsQuery.data;
  const summary = summaryQuery.data;
  const pageLoading = actionsQuery.isLoading && !listData;
  const showError = actionsQuery.isError && !listData;
  const rows = listData?.items ?? [];

  const syncSearchParams = (next: {
    nextFilters?: OptimizationActionsFiltersState;
    nextPage?: number;
    nextLimit?: number;
    nextTab?: DatabaseRecommendationsTabKey;
  }) => {
    const nextFilters = next.nextFilters ?? filtersState;
    const nextPage = next.nextPage ?? page;
    const nextLimit = next.nextLimit ?? limit;
    const nextTab = next.nextTab ?? activeTab;
    const params = new URLSearchParams(location.search);

    const setOrDelete = (key: string, value: string) => {
      if (value.trim().length > 0) params.set(key, value.trim());
      else params.delete(key);
    };

    setOrDelete("search", nextFilters.search);
    setOrDelete("status", nextFilters.status);
    setOrDelete("region", nextFilters.region);
    setOrDelete("engine", nextFilters.engine);
    if (nextFilters.hasActions !== "all") params.set("has_actions", nextFilters.hasActions);
    else params.delete("has_actions");
    setOrDelete("recommendation_type", nextFilters.recommendationType);
    params.set("page", String(nextPage));
    params.set("limit", String(nextLimit));
    params.set("tab", nextTab);

    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
  };

  const actionTypeOptions = useMemo(() => {
    const options = new Set<string>();
    for (const row of rows) {
      for (const t of row.actionSummary.types) options.add(t);
    }
    return [...options].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const actionColumnDefs = useMemo<ColDef<DatabaseOptimizationActionRow>[]>(() => [
    {
      headerName: "Resource",
      minWidth: 260,
      cellRenderer: (params: ICellRendererParams<DatabaseOptimizationActionRow>) => {
        const row = params.data;
        if (!row) return "-";
        return (
          <div>
            <div>{row.dbIdentifier || row.resourceName || row.resourceId}</div>
            <small style={{ opacity: 0.75 }}>{row.resourceId}</small>
          </div>
        );
      },
    },
    {
      headerName: "Service / Engine",
      minWidth: 190,
      cellRenderer: (params: ICellRendererParams<DatabaseOptimizationActionRow>) => {
        const row = params.data;
        if (!row) return "-";
        return (
          <div>
            <div>{row.dbService}</div>
            <small style={{ opacity: 0.75 }}>{row.dbEngine || "-"}</small>
          </div>
        );
      },
    },
    {
      headerName: "Region / Account",
      minWidth: 200,
      cellRenderer: (params: ICellRendererParams<DatabaseOptimizationActionRow>) => {
        const row = params.data;
        if (!row) return "-";
        return (
          <div>
            <div>{row.regionName || row.regionId || "-"}</div>
            <small style={{ opacity: 0.75 }}>{row.subAccountName || row.subAccountId || "-"}</small>
          </div>
        );
      },
    },
    { headerName: "Status", minWidth: 120, valueGetter: (p) => p.data?.status || "-" },
    {
      headerName: "Current Cost",
      minWidth: 130,
      valueGetter: (p) => formatCurrency(p.data?.totalCost),
    },
    {
      headerName: "Utilization",
      minWidth: 170,
      cellRenderer: (params: ICellRendererParams<DatabaseOptimizationActionRow>) => {
        const row = params.data;
        if (!row) return "-";
        return (
          <div>
            <div>CPU {formatPercent(row.avgCpu)}</div>
            <small style={{ opacity: 0.75 }}>Conn {formatInteger(row.avgConnections)}</small>
          </div>
        );
      },
    },
    {
      headerName: "Storage",
      minWidth: 160,
      cellRenderer: (params: ICellRendererParams<DatabaseOptimizationActionRow>) => {
        const row = params.data;
        if (!row) return "-";
        return (
          <div>
            <div>Allocated {formatInteger(row.allocatedStorageGb)}</div>
            <small style={{ opacity: 0.75 }}>Used {formatInteger(row.storageUsedGb)}</small>
          </div>
        );
      },
    },
    {
      headerName: "Active Signals",
      minWidth: 210,
      cellRenderer: (params: ICellRendererParams<DatabaseOptimizationActionRow>) => {
        const row = params.data;
        if (!row) return "-";
        if (row.actionSummary.activeCount <= 0) return <span style={{ opacity: 0.75 }}>No active signals</span>;
        return (
          <div>
            <div>{formatInteger(row.actionSummary.activeCount)} active</div>
            <small style={{ opacity: 0.75 }}>{row.actionSummary.types.slice(0, 2).join(", ") || "-"}</small>
          </div>
        );
      },
    },
    {
      headerName: "Estimated Opportunity",
      minWidth: 165,
      valueGetter: (p) => formatCurrency(p.data?.actionSummary.estimatedMonthlySavingsTotal),
    },
    {
      headerName: "Actions",
      minWidth: 190,
      sortable: false,
      filter: false,
      cellRenderer: (params: ICellRendererParams<DatabaseOptimizationActionRow>) => {
        const row = params.data;
        if (!row) return "-";
        const hasTopAction = row.actionSummary.topActions.length > 0;
        return (
          <div className="flex gap-2">
            <button
              type="button"
              className="cost-explorer-state-btn"
              onClick={(event) => {
                event.stopPropagation();
                if (hasTopAction) {
                  setSelectedRecommendationId(row.actionSummary.topActions[0].id);
                  setDrawerOpen(true);
                }
              }}
              disabled={!hasTopAction}
            >
              View evidence
            </button>
            <button
              type="button"
              className="cost-explorer-state-btn"
              onClick={(event) => {
                event.stopPropagation();
                if (!row.cloudConnectionId) return;
                const params = new URLSearchParams(location.search);
                params.set("cloud_connection_id", row.cloudConnectionId);
                params.set("resourceId", row.resourceId);
                params.set("assetLabel", row.dbIdentifier || row.resourceName || row.resourceId);
                navigate({
                  pathname: `/dashboard/services/database/assets/${encodeURIComponent(row.resourceId)}`,
                  search: params.toString(),
                });
              }}
              disabled={!row.cloudConnectionId}
            >
              Open asset
            </button>
          </div>
        );
      },
    },
  ], [location.search, navigate]);

  return (
    <div className="dashboard-page database-assets-page cost-explorer-page">
      <DashboardPageHeader
        title={<h1 className="dashboard-page-header__title">Database Optimization</h1>}
        actions={(
          <button
            type="button"
            className="cost-explorer-state-btn"
            onClick={() => generateMutation.mutate(undefined)}
            disabled={generateMutation.isPending}
          >
            {generateMutation.isPending ? "Refreshing..." : "Refresh actions"}
          </button>
        )}
      />

      <DatabaseRecommendationsHeaderTabs
        activeTab={activeTab}
        onChange={(nextTab) => {
          setActiveTab(nextTab);
          setPage(1);
          setSelectedRecommendationId(null);
          syncSearchParams({ nextTab, nextPage: 1 });
        }}
      />

      {generateMutation.isError ? <p className="dashboard-note">Unable to refresh recommendations right now.</p> : null}

      {activeTab === "overview" ? (
        <DatabaseRecommendationsOverviewTab
          summary={summary}
          isLoading={summaryQuery.isLoading}
          isError={summaryQuery.isError}
          onOpenSection={() => {
            setActiveTab("actions");
            setPage(1);
            setSelectedRecommendationId(null);
            syncSearchParams({ nextTab: "actions", nextPage: 1 });
          }}
        />
      ) : null}

      {activeTab === "actions" ? (
        <section className="dashboard-table-shell">
          <div className="dashboard-table-shell__body">
            <div className="cost-explorer-toolbar-row db-assets-filters-row">
              <label className="cost-explorer-toolbar-item cost-explorer-field">
                <span className="cost-explorer-field__label">Search</span>
                <input
                  className="cost-explorer-field__control"
                  value={filtersState.search}
                  placeholder="Search resource"
                  onChange={(event) => {
                    const next = { ...filtersState, search: event.target.value };
                    setFiltersState(next);
                    setPage(1);
                    syncSearchParams({ nextFilters: next, nextPage: 1 });
                  }}
                />
              </label>
              <label className="cost-explorer-toolbar-item cost-explorer-field">
                <span className="cost-explorer-field__label">Status</span>
                <input
                  className="cost-explorer-field__control"
                  value={filtersState.status}
                  placeholder="available / stopped ..."
                  onChange={(event) => {
                    const next = { ...filtersState, status: event.target.value };
                    setFiltersState(next);
                    setPage(1);
                    syncSearchParams({ nextFilters: next, nextPage: 1 });
                  }}
                />
              </label>
              <label className="cost-explorer-toolbar-item cost-explorer-field">
                <span className="cost-explorer-field__label">Region</span>
                <input
                  className="cost-explorer-field__control"
                  value={filtersState.region}
                  placeholder="region key/id/name"
                  onChange={(event) => {
                    const next = { ...filtersState, region: event.target.value };
                    setFiltersState(next);
                    setPage(1);
                    syncSearchParams({ nextFilters: next, nextPage: 1 });
                  }}
                />
              </label>
              <label className="cost-explorer-toolbar-item cost-explorer-field">
                <span className="cost-explorer-field__label">Engine</span>
                <input
                  className="cost-explorer-field__control"
                  value={filtersState.engine}
                  placeholder="mysql / postgres ..."
                  onChange={(event) => {
                    const next = { ...filtersState, engine: event.target.value };
                    setFiltersState(next);
                    setPage(1);
                    syncSearchParams({ nextFilters: next, nextPage: 1 });
                  }}
                />
              </label>
              <label className="cost-explorer-toolbar-item cost-explorer-field">
                <span className="cost-explorer-field__label">Has Actions</span>
                <select
                  className="cost-explorer-field__control"
                  value={filtersState.hasActions}
                  onChange={(event) => {
                    const next = { ...filtersState, hasActions: event.target.value as OptimizationActionsFiltersState["hasActions"] };
                    setFiltersState(next);
                    setPage(1);
                    syncSearchParams({ nextFilters: next, nextPage: 1 });
                  }}
                >
                  <option value="all">All</option>
                  <option value="with_actions">With Actions</option>
                  <option value="without_actions">Without Actions</option>
                </select>
              </label>
              <label className="cost-explorer-toolbar-item cost-explorer-field">
                <span className="cost-explorer-field__label">Recommendation Type</span>
                <select
                  className="cost-explorer-field__control"
                  value={filtersState.recommendationType}
                  onChange={(event) => {
                    const next = { ...filtersState, recommendationType: event.target.value };
                    setFiltersState(next);
                    setPage(1);
                    syncSearchParams({ nextFilters: next, nextPage: 1 });
                  }}
                >
                  <option value="">All Types</option>
                  {actionTypeOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <div className="db-assets-filters-row__clear-wrap">
                <button
                  type="button"
                  className="cost-explorer-chip-bar__clear cost-explorer-chip-bar__clear--inline"
                  onClick={() => {
                    const emptyState: OptimizationActionsFiltersState = {
                      search: "",
                      status: "",
                      region: "",
                      engine: "",
                      hasActions: "all",
                      recommendationType: "",
                    };
                    setFiltersState(emptyState);
                    setPage(1);
                    syncSearchParams({ nextFilters: emptyState, nextPage: 1 });
                  }}
                >
                  Clear filters
                </button>
              </div>
            </div>

            {pageLoading ? <p className="dashboard-note">Loading database optimization actions...</p> : null}
            {showError ? <p className="dashboard-note">Unable to load database optimization actions.</p> : null}

            {!showError ? (
              <>
                <BaseDataTable
                  columnDefs={actionColumnDefs}
                  rowData={rows}
                  emptyMessage="No database resources found."
                  onRowClick={(row) => {
                    const first = row.actionSummary.topActions[0];
                    if (!first) return;
                    setSelectedRecommendationId(first.id);
                    setDrawerOpen(true);
                  }}
                />
                <div className="db-assets-pagination">
                  <div className="db-assets-pagination__left">
                    <span className="db-assets-pagination__label">Page Size:</span>
                    <label className="cost-explorer-field db-assets-pagination__size-field">
                      <select
                        className="cost-explorer-field__control"
                        aria-label="Page size"
                        value={limit}
                        onChange={(event) => {
                          const nextLimit = Number(event.target.value);
                          setLimit(nextLimit);
                          setPage(1);
                          syncSearchParams({ nextLimit, nextPage: 1 });
                        }}
                      >
                        {[10, 20, 50].map((size) => (
                          <option key={size} value={size}>
                            {size}
                          </option>
                        ))}
                      </select>
                    </label>
                    <span className="db-assets-pagination__meta">
                      Page {listData?.page ?? page} of {Math.max(1, Math.ceil((listData?.total ?? 0) / (listData?.pageSize ?? limit)))}
                    </span>
                  </div>
                  <div className="db-assets-pagination__right">
                    <button
                      type="button"
                      className="db-assets-pagination__icon-btn"
                      disabled={(listData?.page ?? page) <= 1}
                      onClick={() => {
                        const nextPage = Math.max(1, (listData?.page ?? page) - 1);
                        setPage(nextPage);
                        syncSearchParams({ nextPage });
                      }}
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      className="db-assets-pagination__icon-btn"
                      disabled={(listData?.page ?? page) >= Math.max(1, Math.ceil((listData?.total ?? 0) / (listData?.pageSize ?? limit)))}
                      onClick={() => {
                        const totalPages = Math.max(1, Math.ceil((listData?.total ?? 0) / (listData?.pageSize ?? limit)));
                        const nextPage = Math.min(totalPages, (listData?.page ?? page) + 1);
                        setPage(nextPage);
                        syncSearchParams({ nextPage });
                      }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </section>
      ) : null}

      <DatabaseRecommendationDetailDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) setSelectedRecommendationId(null);
        }}
        selectedId={selectedRecommendationId}
        detail={detailQuery.data ?? null}
        isLoading={detailQuery.isLoading}
        isError={detailQuery.isError}
      />
    </div>
  );
}
