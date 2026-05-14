import { useEffect, useMemo, useState } from "react";
import { DashboardPageHeader } from "../../components/DashboardPageHeader";
import {
  useDatabaseRecommendations,
  useDatabaseRecommendationsSummary,
  useDatabaseRecommendationDetail,
  useGenerateDatabaseRecommendations,
} from "../../hooks/useDashboardQueries";
import type { DatabaseRecommendationFilters, DatabaseRecommendationType } from "../../api/dashboardTypes";
import { useLocation, useNavigate } from "react-router-dom";
import type { DatabaseRecommendationsFiltersValue } from "./components/db-recommendations-filters";
import { DatabaseRecommendationDetailDrawer } from "./components/DatabaseRecommendationDetailDrawer";
import {
  DATABASE_RECOMMENDATION_FAMILY_TABS,
  DatabaseRecommendationsHeaderTabs,
  type DatabaseRecommendationsTabKey,
} from "./components/DatabaseRecommendationsHeaderTabs";
import { DatabaseRecommendationsOverviewTab } from "./components/DatabaseRecommendationsOverviewTab";
import { DatabaseRecommendationFamilyTab } from "./components/DatabaseRecommendationFamilyTab";

const DEFAULT_LIMIT = 20;

const parseSearch = (search: string): DatabaseRecommendationsFiltersValue => {
  const params = new URLSearchParams(search);
  return {
    search: params.get("search") ?? "",
    status: params.get("status") ?? "",
    region: params.get("region") ?? "",
    engine: params.get("engine") ?? "",
  };
};

const parsePositiveInt = (value: string | null, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const parseTab = (search: string): DatabaseRecommendationsTabKey => {
  const raw = (new URLSearchParams(search).get("tab") ?? "overview").trim().toLowerCase();
  if (
    raw === "overview" ||
    raw === "storage-optimization" ||
    raw === "idle-candidates" ||
    raw === "ha-cost-review" ||
    raw === "engine-deployment-review"
  ) {
    return raw;
  }
  return "overview";
};

export default function DatabaseRecommendationsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [filtersState, setFiltersState] = useState<DatabaseRecommendationsFiltersValue>(() => parseSearch(location.search));
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

  const activeFamilyTab = useMemo(
    () => DATABASE_RECOMMENDATION_FAMILY_TABS.find((tab) => tab.key === activeTab) ?? null,
    [activeTab],
  );

  const fixedRecommendationType = activeFamilyTab?.recommendationType;

  const filters = useMemo<DatabaseRecommendationFilters>(
    () => ({
      ...(filtersState.status ? { status: filtersState.status } : {}),
      ...(fixedRecommendationType ? { recommendationType: fixedRecommendationType as DatabaseRecommendationType } : {}),
      ...(filtersState.region ? { region: filtersState.region } : {}),
      ...(filtersState.engine ? { engine: filtersState.engine } : {}),
      ...(filtersState.search.trim() ? { search: filtersState.search.trim() } : {}),
      page,
      limit,
      sortBy: "updated_at",
      sortOrder: "desc",
    }),
    [filtersState, fixedRecommendationType, page, limit],
  );

  const recommendationsQuery = useDatabaseRecommendations(activeTab === "overview" ? undefined : filters);
  const summaryQuery = useDatabaseRecommendationsSummary();
  const generateMutation = useGenerateDatabaseRecommendations();
  const detailQuery = useDatabaseRecommendationDetail(drawerOpen && selectedRecommendationId ? selectedRecommendationId : null);

  const listData = recommendationsQuery.data;
  const summary = summaryQuery.data;
  const pageLoading = recommendationsQuery.isLoading && !listData;
  const showError = recommendationsQuery.isError && !listData;
  const rows = listData?.items ?? [];

  const syncSearchParams = (next: {
    nextFilters?: DatabaseRecommendationsFiltersValue;
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
    params.set("page", String(nextPage));
    params.set("limit", String(nextLimit));
    params.set("tab", nextTab);

    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
  };

  return (
    <div className="dashboard-page database-assets-page cost-explorer-page">
      <DashboardPageHeader
        title={<h1 className="dashboard-page-header__title">Recommendations</h1>}
        actions={(
          <button
            type="button"
            className="cost-explorer-state-btn"
            onClick={() => generateMutation.mutate(undefined)}
            disabled={generateMutation.isPending}
          >
            {generateMutation.isPending ? "Refreshing..." : "Refresh recommendations"}
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
          onOpenSection={(tab) => {
            setActiveTab(tab);
            setPage(1);
            setSelectedRecommendationId(null);
            syncSearchParams({ nextTab: tab, nextPage: 1 });
          }}
        />
      ) : null}

      {activeFamilyTab ? (
        <DatabaseRecommendationFamilyTab
          tabLabel={activeFamilyTab.label}
          rows={rows}
          listData={listData}
          filtersState={filtersState}
          page={page}
          limit={limit}
          pageLoading={pageLoading}
          showError={showError}
          isRefreshing={recommendationsQuery.isFetching}
          isGenerating={generateMutation.isPending}
          actionLabel={activeFamilyTab.actionLabel}
          tablePreset={activeFamilyTab.tablePreset}
          emptyStateMessage={activeFamilyTab.emptyStateMessage}
          onFiltersChange={(next) => {
            setFiltersState(next);
            setPage(1);
            syncSearchParams({ nextFilters: next, nextPage: 1 });
          }}
          onClearFilters={() => {
            const emptyState: DatabaseRecommendationsFiltersValue = {
              search: "",
              status: "",
              region: "",
              engine: "",
            };
            setFiltersState(emptyState);
            setPage(1);
            syncSearchParams({ nextFilters: emptyState, nextPage: 1 });
          }}
          onOpenRow={(row) => {
            setSelectedRecommendationId(row.id);
            setDrawerOpen(true);
          }}
          onLimitChange={(nextLimit) => {
            setLimit(nextLimit);
            setPage(1);
            syncSearchParams({ nextLimit, nextPage: 1 });
          }}
          onPrevPage={() => {
            const nextPage = Math.max(1, (listData?.pagination.page ?? page) - 1);
            setPage(nextPage);
            syncSearchParams({ nextPage });
          }}
          onNextPage={() => {
            const nextPage = Math.min(
              Math.max(1, listData?.pagination.totalPages ?? 1),
              (listData?.pagination.page ?? page) + 1,
            );
            setPage(nextPage);
            syncSearchParams({ nextPage });
          }}
          onRefresh={() => generateMutation.mutate(undefined)}
        />
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
