import { useMemo, useState } from "react";

import { DashboardPageHeader } from "../../components/DashboardPageHeader";
import { useDashboardScope } from "../../hooks/useDashboardScope";
import { useDatabaseAssetsQuery } from "../../hooks/useDashboardQueries";
import type { DatabaseAssetsFilters as DatabaseAssetsQueryFilters } from "../../api/dashboardTypes";
import { DatabaseAssetsCards } from "./components/db-assets-cards";
import {
  DatabaseAssetsFilters,
  type DatabaseAssetsFiltersValue,
} from "./components/db-assets-filters";
import { DatabaseAssetsTable } from "./components/db-assets-table";

const DEFAULT_PAGE_SIZE = 20;

export default function DatabaseAssetsPage() {
  const { scope } = useDashboardScope();
  const [filterState, setFilterState] = useState<DatabaseAssetsFiltersValue>({
    search: "",
    regionKey: "",
    dbEngine: "",
    instanceClass: "",
    status: "",
    subAccountKey: "",
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const filters = useMemo<DatabaseAssetsQueryFilters>(
    () => ({
      ...(filterState.regionKey ? { regionKey: filterState.regionKey } : {}),
      ...(filterState.dbEngine ? { dbEngine: filterState.dbEngine } : {}),
      ...(filterState.instanceClass ? { instanceClass: filterState.instanceClass } : {}),
      ...(filterState.status ? { status: filterState.status } : {}),
      ...(filterState.subAccountKey ? { subAccountKey: filterState.subAccountKey } : {}),
      ...(filterState.search.trim() ? { search: filterState.search.trim() } : {}),
      page,
      pageSize,
    }),
    [filterState, page, pageSize],
  );

  const query = useDatabaseAssetsQuery(filters);
  const data = query.data;

  const pageLoading = query.isLoading && !data;
  const showError = query.isError && !data;

  const summary = data?.summary ?? {
    totalAssets: 0,
    totalCost: 0,
    avgCpu: null,
    totalStorageGb: null,
    recommendationCount: 0,
  };

  const scopeLabel = scope?.from && scope?.to ? `${scope.from} to ${scope.to}` : scope?.title ?? "";

  return (
    <div className="dashboard-page database-assets-page cost-explorer-page">
      <DashboardPageHeader
        title={
          <div>
            <h1 className="dashboard-page-header__title">Assets</h1>
            <p className="dashboard-note" style={{ margin: "6px 0 0" }}>
              Unified view of database assets across active database services
              {scopeLabel ? ` (${scopeLabel})` : ""}
            </p>
          </div>
        }
      />

      <DatabaseAssetsFilters
        value={filterState}
        filterOptions={
          data?.filterOptions ?? {
            dbServices: [],
            dbEngines: [],
            classes: [],
            statuses: [],
            regions: [],
            accounts: [],
          }
        }
        onChange={(next) => {
          setFilterState(next);
          setPage(1);
        }}
        onClear={() => {
          setFilterState({ search: "", regionKey: "", dbEngine: "", instanceClass: "", status: "", subAccountKey: "" });
          setPage(1);
          setPageSize(DEFAULT_PAGE_SIZE);
        }}
      />

      {pageLoading ? <p className="dashboard-note">Loading database assets...</p> : null}
      {showError ? <p className="dashboard-note">Failed to load database assets data. Please try again.</p> : null}

      {!showError ? (
        <>
          <DatabaseAssetsCards summary={summary} isLoading={pageLoading} />
          <DatabaseAssetsTable
            rows={data?.assets ?? []}
            pagination={
              data?.pagination ?? {
                page,
                pageSize,
                total: 0,
                totalPages: 1,
              }
            }
            isLoading={query.isFetching && !pageLoading}
            onFirstPage={() => setPage(1)}
            onPrevPage={() => setPage((current) => Math.max(1, current - 1))}
            onNextPage={() => {
              const totalPages = Math.max(1, data?.pagination?.totalPages ?? 1);
              setPage((current) => Math.min(totalPages, current + 1));
            }}
            onLastPage={() => {
              const totalPages = Math.max(1, data?.pagination?.totalPages ?? 1);
              setPage(totalPages);
            }}
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize);
              setPage(1);
            }}
          />
        </>
      ) : null}
    </div>
  );
}
