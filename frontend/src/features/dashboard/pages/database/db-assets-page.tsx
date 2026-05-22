import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useDatabaseAssetsQuery } from "../../hooks/useDashboardQueries";
import { useDashboardScope } from "../../hooks/useDashboardScope";
import type { DatabaseAssetsFilters as DatabaseAssetsQueryFilters } from "../../api/dashboardTypes";
import { DatabaseAssetsCards } from "./components/db-assets-cards";
import {
  DatabaseAssetsFilters,
  type DatabaseAssetsFiltersValue,
} from "./components/db-assets-filters";
import { DatabaseAssetsTable } from "./components/db-assets-table";

const DEFAULT_PAGE_SIZE = 20;

const buildFilterStateFromSearch = (search: string): DatabaseAssetsFiltersValue => {
  const params = new URLSearchParams(search);
  return {
    search: params.get("search") ?? "",
    regionKey: params.get("region_key") ?? params.get("regionKey") ?? "",
    dbService: params.get("db_service") ?? params.get("dbService") ?? "",
    dbEngine: params.get("db_engine") ?? params.get("dbEngine") ?? "",
    resourceType: params.get("resource_type") ?? params.get("resourceType") ?? "",
    instanceClass: params.get("instance_class") ?? params.get("instanceClass") ?? "",
    cluster: params.get("cluster") ?? params.get("clusterId") ?? "",
  };
};

export default function DatabaseAssetsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { scope } = useDashboardScope();
  const [filterState, setFilterState] = useState<DatabaseAssetsFiltersValue>(() => buildFilterStateFromSearch(location.search));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  useEffect(() => {
    setFilterState(buildFilterStateFromSearch(location.search));
    setPage(1);
  }, [location.search]);

  const filters = useMemo<DatabaseAssetsQueryFilters>(
    () => ({
      ...(filterState.regionKey ? { regionKey: filterState.regionKey } : {}),
      ...(filterState.dbService ? { dbService: filterState.dbService } : {}),
      ...(filterState.dbEngine ? { dbEngine: filterState.dbEngine } : {}),
      ...(filterState.resourceType ? { resourceType: filterState.resourceType } : {}),
      ...(filterState.instanceClass ? { instanceClass: filterState.instanceClass } : {}),
      ...(filterState.cluster ? { cluster: filterState.cluster } : {}),
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

  return (
    <div className="dashboard-page database-assets-page cost-explorer-page">
      <DatabaseAssetsFilters
        value={filterState}
        filterOptions={
          data?.filterOptions ?? {
            dbServices: [],
            dbEngines: [],
            classes: [],
            statuses: [],
            regions: [],
          }
        }
        onChange={(next) => {
          setFilterState(next);
          setPage(1);
        }}
        onClear={() => {
          setFilterState({ search: "", regionKey: "", dbService: "", dbEngine: "", resourceType: "", instanceClass: "", cluster: "" });
          setPage(1);
        }}
      />

      {pageLoading ? <p className="dashboard-note">Loading database assets...</p> : null}
      {showError ? <p className="dashboard-note">Failed to load database assets data. Please try again.</p> : null}

      {!showError ? (
        <>
          <DatabaseAssetsCards summary={summary} isLoading={pageLoading} />
          <DatabaseAssetsTable
            rows={data?.assets ?? []}
            onRowClick={(row) => {
              if (!row.resourceId || !row.cloudConnectionId) return;
              const next = new URLSearchParams(location.search);
              next.set("cloud_connection_id", row.cloudConnectionId);
              next.set("resourceId", row.resourceId);
              if (row.dbIdentifier?.trim()) {
                next.set("assetLabel", row.dbIdentifier.trim());
              } else {
                next.delete("assetLabel");
              }
              const startDate = next.get("start_date") ?? scope?.from ?? null;
              const endDate = next.get("end_date") ?? scope?.to ?? null;
              if (startDate) next.set("start_date", startDate);
              if (endDate) next.set("end_date", endDate);
              navigate({
                pathname: `/dashboard/services/database/assets/${encodeURIComponent(row.resourceId)}`,
                search: next.toString(),
              });
            }}
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
