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

const metricOptions: Array<{ value: DatabaseExplorerMetric; label: string }> = [
  { value: "cost", label: "Cost" },
  { value: "usage", label: "Usage" },
];

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

  const dbServiceOptions = useMemo(
    () => uniqueSorted(data?.filterOptions?.dbServices ?? []),
    [data?.filterOptions?.dbServices],
  );
  const dbEngineOptions = useMemo(
    () => uniqueSorted(data?.filterOptions?.dbEngines ?? []),
    [data?.filterOptions?.dbEngines],
  );

  const pageLoading = query.isLoading && !data;
  const showError = query.isError && !data;

  return (
    <div className="dashboard-page database-explorer-page cost-explorer-page">
      <DashboardPageHeader
        title={
          <div className="database-explorer-page__metric-title">
            <span className="cost-explorer-field__label">Metric</span>
            <div
              className="cost-explorer-segmented cost-explorer-segmented--tray database-explorer-page__metric-switch"
              role="group"
              aria-label="Database explorer metric"
              style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
            >
              {metricOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`cost-explorer-segmented__item${metric === option.value ? " is-active" : ""}`}
                  onClick={() => setMetric(option.value)}
                  aria-pressed={metric === option.value}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        }
      />

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
