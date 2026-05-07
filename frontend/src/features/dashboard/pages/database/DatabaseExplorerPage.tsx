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
import {
  deriveAutoGroupBy,
  type DatabaseTypeValue,
} from "./databaseExplorer.taxonomy";

const metricOptions: Array<{ value: DatabaseExplorerMetric; label: string }> = [
  { value: "cost", label: "Cost" },
  { value: "usage", label: "Usage" },
];

export default function DatabaseExplorerPage() {
  const [metric, setMetric] = useState<DatabaseExplorerMetric>("cost");
  const [groupBy, setGroupBy] = useState<"auto" | DatabaseExplorerGroupBy>("auto");
  const [databaseType, setDatabaseType] = useState<DatabaseTypeValue>("all");
  const [dbService, setDbService] = useState("");
  const [dbEngine, setDbEngine] = useState("");

  const effectiveGroupBy = useMemo<DatabaseExplorerGroupBy>(
    () => (groupBy === "auto" ? deriveAutoGroupBy(databaseType, dbService, dbEngine) : groupBy),
    [databaseType, dbEngine, dbService, groupBy],
  );

  const filters = useMemo<DatabaseExplorerFiltersQuery>(
    () => ({
      metric,
      groupBy: effectiveGroupBy,
      ...(databaseType !== "all" ? { databaseType } : {}),
      ...(dbService.trim() ? { dbService: dbService.trim() } : {}),
      ...(dbEngine.trim() ? { dbEngine: dbEngine.trim() } : {}),
    }),
    [databaseType, dbEngine, dbService, effectiveGroupBy, metric],
  );

  const query = useDatabaseExplorerQuery(filters);
  const data = query.data;

  const pageLoading = query.isLoading && !data;
  const showError = query.isError && !data;
  const handleMetricChange = (nextMetric: DatabaseExplorerMetric) => {
    setMetric(nextMetric);
    if (nextMetric === "usage" && groupBy === "cost_category") {
      setGroupBy("auto");
    }
  };

  const handleClearAll = () => {
    setGroupBy("auto");
    setDatabaseType("all");
    setDbService("");
    setDbEngine("");
  };

  const handleApplyGroupBy = (next: {
    groupBy: "auto" | DatabaseExplorerGroupBy;
    databaseType: DatabaseTypeValue;
    dbService: string;
    dbEngine: string;
  }) => {
    setGroupBy(next.groupBy);
    setDatabaseType(next.databaseType);
    setDbService(next.dbService);
    setDbEngine(next.dbEngine);
  };

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
                  onClick={() => handleMetricChange(option.value)}
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
        effectiveGroupBy={effectiveGroupBy}
        databaseType={databaseType}
        dbService={dbService}
        dbEngine={dbEngine}
        onApplyGroupBy={handleApplyGroupBy}
        onClearAll={handleClearAll}
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
          <DatabaseExplorerTrend
            metric={metric}
            groupBy={effectiveGroupBy}
            trend={data?.trend ?? []}
            trendGrouped={data?.trendGrouped}
            isLoading={pageLoading}
          />
          <DatabaseExplorerGroupedTable rows={data?.table ?? []} isLoading={pageLoading} />
        </>
      ) : null}
    </div>
  );
}
