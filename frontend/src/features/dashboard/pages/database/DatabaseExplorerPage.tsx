import { useMemo, useState } from "react";

import { DashboardPageHeader } from "../../components/DashboardPageHeader";
import { useDatabaseExplorerQuery } from "../../hooks/useDashboardQueries";
import type {
  DatabaseExplorerFilters as DatabaseExplorerFiltersQuery,
  DatabaseExplorerGroupBy,
  DatabaseExplorerMetric,
} from "../../api/dashboardTypes";
import {
  DatabaseExplorerCards,
  DatabaseExplorerFilters,
  DatabaseExplorerGroupedTable,
  DatabaseExplorerTrend,
} from "./components";

const uniqueSorted = (values: string[]): string[] =>
  [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right),
  );

export default function DatabaseExplorerPage() {
  const [metric, setMetric] = useState<DatabaseExplorerMetric>("cost");
  const [groupBy, setGroupBy] = useState<DatabaseExplorerGroupBy>("db_service");
  const [dbService, setDbService] = useState("");
  const [dbEngine, setDbEngine] = useState("");

  const filters = useMemo<DatabaseExplorerFiltersQuery>(
    () => ({
      metric,
      groupBy,
      ...(dbService.trim() ? { dbService: dbService.trim() } : {}),
      ...(dbEngine.trim() ? { dbEngine: dbEngine.trim() } : {}),
    }),
    [dbEngine, dbService, groupBy, metric],
  );

  const query = useDatabaseExplorerQuery(filters);
  const data = query.data;

  const groupedValues = useMemo(() => uniqueSorted(data?.table.map((row) => row.group) ?? []), [data?.table]);
  const dbServiceOptions = useMemo(
    () => uniqueSorted([...(groupBy === "db_service" ? groupedValues : []), dbService]),
    [dbService, groupBy, groupedValues],
  );
  const dbEngineOptions = useMemo(
    () => uniqueSorted([...(groupBy === "db_engine" ? groupedValues : []), dbEngine]),
    [dbEngine, groupBy, groupedValues],
  );

  const pageLoading = query.isLoading && !data;
  const showError = query.isError && !data;

  return (
    <div className="dashboard-page database-explorer-page cost-explorer-page">
      <DashboardPageHeader title="Database" />

      <DatabaseExplorerFilters
        metric={metric}
        groupBy={groupBy}
        dbService={dbService}
        dbEngine={dbEngine}
        dbServiceOptions={dbServiceOptions}
        dbEngineOptions={dbEngineOptions}
        onMetricChange={setMetric}
        onGroupByChange={setGroupBy}
        onDbServiceChange={setDbService}
        onDbEngineChange={setDbEngine}
      />

      {pageLoading ? <p className="dashboard-note">Loading database explorer...</p> : null}
      {showError ? <p className="dashboard-note">Failed to load database explorer data. Please try again.</p> : null}

      {!showError ? (
        <>
          <DatabaseExplorerCards
            cards={
              data?.cards ?? {
                totalCost: 0,
                costTrendPct: null,
                activeResources: 0,
                dataFootprintGb: 0,
                avgLoad: null,
                connections: null,
              }
            }
            isLoading={pageLoading}
          />
          <DatabaseExplorerTrend metric={metric} trend={data?.trend ?? []} isLoading={pageLoading} />
          <DatabaseExplorerGroupedTable rows={data?.table ?? []} isLoading={pageLoading} />
        </>
      ) : null}
    </div>
  );
}
