import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { DashboardPageHeader } from "../../components/DashboardPageHeader";
import { useDashboardScope } from "../../hooks/useDashboardScope";
import { useDatabaseExplorerQuery } from "../../hooks/useDashboardQueries";
import type {
  DatabaseExplorerAllowedGroupByByMetric,
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

const DEFAULT_GROUP_BY: Record<DatabaseExplorerMetric, DatabaseExplorerGroupBy> = {
  cost: "db_service",
  usage: "db_engine",
};

const FALLBACK_ALLOWED_GROUP_BY: Record<DatabaseExplorerMetric, DatabaseExplorerGroupBy[]> = {
  cost: ["db_service", "db_engine", "region", "cost_category", "resource_type"],
  usage: ["db_service", "db_engine", "region", "instance_class", "cluster"],
};

const metricOptions: Array<{ value: DatabaseExplorerMetric; label: string }> = [
  { value: "cost", label: "Cost" },
  { value: "usage", label: "Usage" },
];

const DATABASE_ASSETS_PATH = "/dashboard/services/database/assets";

type DrilldownSource = "database-explorer-chart" | "database-explorer-table";

type ExplorerDrilldownPayload = {
  rawValue: string;
  clickedLabel: string;
};

export default function DatabaseExplorerPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { scope } = useDashboardScope();
  const [metric, setMetric] = useState<DatabaseExplorerMetric>("cost");
  const [groupBy, setGroupBy] = useState<DatabaseExplorerGroupBy>("db_service");
  const [groupValues, setGroupValues] = useState<string[]>([]);
  const [databaseScope, setDatabaseScope] = useState<DatabaseExplorerScopeValue>("all");
  const [dbService, setDbService] = useState("");
  const [dbEngine, setDbEngine] = useState("");
  const effectiveGroupBy = groupBy;

  const filters = useMemo<DatabaseExplorerFiltersQuery>(
    () => ({
      metric,
      groupBy: effectiveGroupBy,
      ...(groupValues.length > 0 ? { groupValues } : {}),
      ...(databaseScope !== "all" ? { databaseScope } : {}),
      ...(dbService.trim() ? { dbService: dbService.trim() } : {}),
      ...(dbEngine.trim() ? { dbEngine: dbEngine.trim() } : {}),
    }),
    [databaseScope, dbEngine, dbService, effectiveGroupBy, groupValues, metric],
  );

  const query = useDatabaseExplorerQuery(filters);
  const data = query.data;
  const allowedGroupByByMetric = data?.allowedGroupByByMetric;
  const allowedGroupBy = data?.allowedGroupBy ?? [];

  const pageLoading = query.isLoading && !data;
  const showError = query.isError && !data;

  const resolveAllowedGroupBy = (
    targetMetric: DatabaseExplorerMetric,
    byMetric?: DatabaseExplorerAllowedGroupByByMetric,
    currentAllowed?: DatabaseExplorerGroupBy[],
  ): DatabaseExplorerGroupBy[] => {
    const fromMap = byMetric?.[targetMetric];
    if (Array.isArray(fromMap) && fromMap.length > 0) return fromMap;
    if (targetMetric === metric && Array.isArray(currentAllowed) && currentAllowed.length > 0) return currentAllowed;
    return FALLBACK_ALLOWED_GROUP_BY[targetMetric];
  };

  const resolveDefaultGroupBy = (
    targetMetric: DatabaseExplorerMetric,
    byMetric?: DatabaseExplorerAllowedGroupByByMetric,
    currentAllowed?: DatabaseExplorerGroupBy[],
  ): DatabaseExplorerGroupBy => {
    const allowed = resolveAllowedGroupBy(targetMetric, byMetric, currentAllowed);
    if (allowed.includes(DEFAULT_GROUP_BY[targetMetric])) return DEFAULT_GROUP_BY[targetMetric];
    return allowed[0] ?? DEFAULT_GROUP_BY[targetMetric];
  };

  const handleMetricChange = (nextMetric: DatabaseExplorerMetric) => {
    const allowed = new Set(resolveAllowedGroupBy(nextMetric, allowedGroupByByMetric, allowedGroupBy));
    setMetric(nextMetric);
    setGroupValues([]);
    if (!allowed.has(groupBy)) {
      setGroupBy(resolveDefaultGroupBy(nextMetric, allowedGroupByByMetric, allowedGroupBy));
    }
  };

  useEffect(() => {
    if (metric !== "usage" || groupBy !== "db_engine") return;
    const engineOptions = data?.filterOptions?.groupedValuePreview?.db_engine ?? [];
    if (engineOptions.length === 0) {
      setGroupBy("db_service");
      setGroupValues([]);
    }
  }, [data?.filterOptions?.groupedValuePreview?.db_engine, groupBy, metric]);

  useEffect(() => {
    const values = data?.filterOptions?.groupedValuePreview?.[groupBy] ?? [];
    if (groupValues.length === 0 || values.length === 0) return;
    const available = new Set(values);
    const filtered = groupValues.filter((value) => available.has(value));
    if (filtered.length !== groupValues.length) {
      setGroupValues(filtered);
    }
  }, [data?.filterOptions?.groupedValuePreview, groupBy, groupValues]);

  useEffect(() => {
    const allowed = new Set(resolveAllowedGroupBy(metric, allowedGroupByByMetric, allowedGroupBy));
    if (allowed.has(groupBy)) return;
    setGroupBy(resolveDefaultGroupBy(metric, allowedGroupByByMetric, allowedGroupBy));
    setGroupValues([]);
  }, [allowedGroupBy, allowedGroupByByMetric, groupBy, metric]);

  const handleClearAll = () => {
    setGroupBy(DEFAULT_GROUP_BY[metric]);
    setGroupValues([]);
    setDatabaseScope("all");
    setDbService("");
    setDbEngine("");
  };

  const handleApplyScope = (next: { databaseScope: DatabaseExplorerScopeValue; dbService: string; dbEngine: string }) => {
    setDatabaseScope(next.databaseScope);
    setDbService(next.dbService);
    setDbEngine(next.dbEngine);
  };

  const handleApplyGroupBy = (next: { groupBy: DatabaseExplorerGroupBy; groupValues: string[] }) => {
    if (next.groupBy !== groupBy) {
      setGroupBy(next.groupBy);
      setGroupValues([]);
      return;
    }
    setGroupBy(next.groupBy);
    setGroupValues(next.groupValues);
  };

  const availableDatabaseScopes = data?.filterOptions?.availableDatabaseScopes ?? ["all"];
  const backendServiceOptions = data?.filterOptions?.dbServices ?? [];
  const backendEngineOptions = data?.filterOptions?.dbEngines ?? [];

  const navigateToAssets = (source: DrilldownSource, payload: ExplorerDrilldownPayload) => {
    const next = new URLSearchParams(location.search);
    const rawValue = payload.rawValue.trim();
    const clickedLabel = payload.clickedLabel.trim();

    next.set("source", source);
    next.set("metric", metric);
    next.set("group_by", effectiveGroupBy);
    next.set("groupValue", rawValue || clickedLabel);
    next.set("clickedLabel", clickedLabel || rawValue);

    if (scope?.from) {
      next.set("from", scope.from);
      next.set("start_date", scope.from);
    }
    if (scope?.to) {
      next.set("to", scope.to);
      next.set("end_date", scope.to);
    }

    if (databaseScope !== "all") {
      next.set("database_scope", databaseScope);
    } else {
      next.delete("database_scope");
    }

    if (dbService.trim().length > 0) {
      next.set("db_service", dbService.trim());
    } else if (effectiveGroupBy !== "db_service") {
      next.delete("db_service");
    }

    if (dbEngine.trim().length > 0) {
      next.set("db_engine", dbEngine.trim());
    } else if (effectiveGroupBy !== "db_engine") {
      next.delete("db_engine");
    }

    if (effectiveGroupBy === "db_service" && rawValue.length > 0) {
      next.set("db_service", rawValue);
    }
    if (effectiveGroupBy === "db_engine" && rawValue.length > 0) {
      next.set("db_engine", rawValue);
    }
    if (effectiveGroupBy === "instance_class" && rawValue.length > 0) {
      next.set("instance_class", rawValue);
    } else if (effectiveGroupBy !== "instance_class") {
      next.delete("instance_class");
    }

    if (effectiveGroupBy !== "region") {
      next.delete("region_key");
    }

    navigate({ pathname: DATABASE_ASSETS_PATH, search: next.toString() });
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
        allowedGroupBy={resolveAllowedGroupBy(metric, allowedGroupByByMetric, allowedGroupBy)}
        databaseScope={databaseScope}
        dbService={dbService}
        dbEngine={dbEngine}
        groupBy={groupBy}
        effectiveGroupBy={effectiveGroupBy}
        groupValues={groupValues}
        availableDatabaseScopes={availableDatabaseScopes}
        backendServiceOptions={backendServiceOptions}
        backendEngineOptions={backendEngineOptions}
        groupedValuePreview={data?.filterOptions?.groupedValuePreview}
        onApplyScope={handleApplyScope}
        onApplyGroupBy={handleApplyGroupBy}
        onClearAll={handleClearAll}
      />

      {pageLoading ? <p className="dashboard-note">Loading database explorer...</p> : null}
      {showError ? <p className="dashboard-note">Failed to load database explorer data. Please try again.</p> : null}

      {!showError ? (
        <>
          <DatabaseExplorerCards
            cards={data?.cards ?? []}
            isLoading={pageLoading}
          />
          <DatabaseExplorerTrend
            metric={metric}
            groupBy={effectiveGroupBy}
            trend={data?.trend ?? []}
            trendGrouped={data?.trendGrouped}
            isLoading={pageLoading}
            onDrilldown={({ rawValue, clickedLabel }) => {
              navigateToAssets("database-explorer-chart", { rawValue, clickedLabel });
            }}
          />
          <DatabaseExplorerGroupedTable
            rows={data?.table ?? []}
            isLoading={pageLoading}
            onRowClick={(row) => {
              navigateToAssets("database-explorer-table", {
                rawValue: row.group,
                clickedLabel: row.group,
              });
            }}
          />
        </>
      ) : null}
    </div>
  );
}
