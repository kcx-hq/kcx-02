import { useEffect, useMemo, useState } from "react";

import { DashboardPageHeader } from "../../components/DashboardPageHeader";
import { useDatabaseExplorerQuery } from "../../hooks/useDashboardQueries";
import type {
  DatabaseExplorerFilters as DatabaseExplorerFiltersQuery,
  DatabaseExplorerGroupBy,
  DatabaseExplorerMetric,
  DatabaseExplorerScopeValue,
} from "../../api/dashboardTypes";
import {
  DatabaseExplorerCards,
  DatabaseExplorerFilters,
  DatabaseExplorerGroupedTable,
  DatabaseExplorerTrend,
} from "./components";

const metricOptions: Array<{ value: DatabaseExplorerMetric; label: string }> = [
  { value: "cost", label: "Cost" },
  { value: "usage", label: "Usage" },
];

export default function DatabaseExplorerPage() {
  const [metric, setMetric] = useState<DatabaseExplorerMetric>("cost");
  const [groupBy, setGroupBy] = useState<DatabaseExplorerGroupBy>("db_service");
  const [databaseScope, setDatabaseScope] = useState<DatabaseExplorerScopeValue>("all");
  const [dbService, setDbService] = useState("");
  const [dbEngine, setDbEngine] = useState("");
  const [regionKey, setRegionKey] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [instanceClass, setInstanceClass] = useState("");
  const [cluster, setCluster] = useState("");

  const filters = useMemo<DatabaseExplorerFiltersQuery>(
    () => ({
      metric,
      groupBy,
      ...(databaseScope !== "all" ? { databaseScope } : {}),
      ...(regionKey.trim() ? { regionKey: regionKey.trim() } : {}),
      ...(dbService.trim() ? { dbService: dbService.trim() } : {}),
      ...(dbEngine.trim() ? { dbEngine: dbEngine.trim() } : {}),
      ...(resourceType.trim() ? { resourceType: resourceType.trim() } : {}),
      ...(instanceClass.trim() ? { instanceClass: instanceClass.trim() } : {}),
      ...(cluster.trim() ? { cluster: cluster.trim() } : {}),
    }),
    [cluster, databaseScope, dbEngine, dbService, groupBy, instanceClass, metric, regionKey, resourceType],
  );

  const query = useDatabaseExplorerQuery(filters);
  const data = query.data;

  const pageLoading = query.isLoading && !data;
  const showError = query.isError && !data;
  const handleMetricChange = (nextMetric: DatabaseExplorerMetric) => {
    setMetric(nextMetric);
    if (nextMetric === "usage" && groupBy === "cost_category") {
      setGroupBy("db_service");
    }
  };

  const handleClearAll = () => {
    setGroupBy("db_service");
    setDatabaseScope("all");
    setDbService("");
    setDbEngine("");
    setRegionKey("");
    setResourceType("");
    setInstanceClass("");
    setCluster("");
  };

  const handleFiltersChange = (
    next: Partial<{
      databaseScope: DatabaseExplorerScopeValue;
      dbService: string;
      dbEngine: string;
      regionKey: string;
      resourceType: string;
      instanceClass: string;
      cluster: string;
    }>,
  ) => {
    if (typeof next.databaseScope !== "undefined") setDatabaseScope(next.databaseScope);
    if (typeof next.dbService !== "undefined") setDbService(next.dbService);
    if (typeof next.dbEngine !== "undefined") setDbEngine(next.dbEngine);
    if (typeof next.regionKey !== "undefined") setRegionKey(next.regionKey);
    if (typeof next.resourceType !== "undefined") setResourceType(next.resourceType);
    if (typeof next.instanceClass !== "undefined") setInstanceClass(next.instanceClass);
    if (typeof next.cluster !== "undefined") setCluster(next.cluster);
  };

  const handleGroupByChange = (nextGroupBy: DatabaseExplorerGroupBy) => {
    setGroupBy(nextGroupBy);
    if (nextGroupBy !== "region") setRegionKey("");
    if (nextGroupBy !== "resource_type") setResourceType("");
    if (nextGroupBy !== "instance_class") setInstanceClass("");
    if (nextGroupBy !== "cluster") setCluster("");
  };

  const availableDatabaseScopes = data?.filterOptions?.availableDatabaseScopes ?? ["all"];
  const filterOptions = data?.filterOptions ?? {
    dbServices: [],
    dbEngines: [],
    regions: [],
    resourceTypes: [],
    instanceClasses: [],
    clusters: [],
    availableDatabaseScopes,
  };

  useEffect(() => {
    if (!data?.filterOptions) return;

    if (dbService && !data.filterOptions.dbServices.includes(dbService)) {
      setDbService("");
    }
    if (dbEngine && !data.filterOptions.dbEngines.includes(dbEngine)) {
      setDbEngine("");
    }
    if (regionKey && !data.filterOptions.regions.some((option) => option.value === regionKey)) {
      setRegionKey("");
    }
    if (resourceType && !data.filterOptions.resourceTypes.includes(resourceType)) {
      setResourceType("");
    }
    if (instanceClass && !data.filterOptions.instanceClasses.includes(instanceClass)) {
      setInstanceClass("");
    }
    if (cluster && !data.filterOptions.clusters.includes(cluster)) {
      setCluster("");
    }
  }, [cluster, data?.filterOptions, dbEngine, dbService, instanceClass, regionKey, resourceType]);

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
        databaseScope={databaseScope}
        dbService={dbService}
        dbEngine={dbEngine}
        regionKey={regionKey}
        resourceType={resourceType}
        instanceClass={instanceClass}
        cluster={cluster}
        groupBy={groupBy}
        availableDatabaseScopes={availableDatabaseScopes}
        filterOptions={filterOptions}
        onFiltersChange={handleFiltersChange}
        onGroupByChange={handleGroupByChange}
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
            groupBy={groupBy}
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
