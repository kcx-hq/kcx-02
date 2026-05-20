import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { DashboardPageHeader } from "../../components/DashboardPageHeader";
import { useDashboardScope } from "../../hooks/useDashboardScope";
import { useDatabaseExplorerQuery } from "../../hooks/useDashboardQueries";
import type {
  DatabaseCapabilityAvailability,
  DatabaseExplorerAllowedGroupByByMetric,
  DatabaseExplorerCostBasis,
  DatabaseExplorerFilters as DatabaseExplorerFiltersQuery,
  DatabaseExplorerGroupBy,
  DatabaseExplorerMetric,
  DatabaseExplorerScopeValue,
  DatabaseUsageCapabilityFamily,
  DatabaseUsageMetric,
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
const DEFAULT_USAGE_CAPABILITY: DatabaseUsageCapabilityFamily = "compute_pressure";
const DEFAULT_USAGE_METRIC_BY_CAPABILITY: Record<DatabaseUsageCapabilityFamily, DatabaseUsageMetric> = {
  compute_pressure: "avg_cpu",
  connection_pressure: "avg_connections",
  io_activity: "total_iops",
  throughput_activity: "total_throughput",
  storage_pressure: "storage_used_gb",
};
const USAGE_METRIC_LABELS: Record<DatabaseUsageMetric, string> = {
  avg_cpu: "Avg CPU",
  peak_cpu: "Peak CPU",
  avg_connections: "Avg Connections",
  peak_connections: "Peak Connections",
  read_iops: "Read IOPS",
  write_iops: "Write IOPS",
  total_iops: "Total IOPS",
  read_throughput: "Read Throughput",
  write_throughput: "Write Throughput",
  total_throughput: "Total Throughput",
  storage_used_gb: "Storage Used",
  allocated_storage_gb: "Allocated Storage",
};

const FALLBACK_ALLOWED_GROUP_BY: Record<DatabaseExplorerMetric, DatabaseExplorerGroupBy[]> = {
  cost: ["db_service", "db_engine", "region", "cost_category", "resource_type"],
  usage: ["db_service", "db_engine", "region", "instance_class", "cluster"],
};

const metricOptions: Array<{ value: DatabaseExplorerMetric; label: string }> = [
  { value: "cost", label: "Cost" },
  { value: "usage", label: "Usage" },
];
const DEFAULT_COST_BASIS: DatabaseExplorerCostBasis = "billed_cost";
const ENABLED_DB_EXPLORER_COST_BASES: ReadonlySet<DatabaseExplorerCostBasis> = new Set(["billed_cost"]);

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
  const [resourceTypeValues, setResourceTypeValues] = useState<string[]>([]);
  const [costCategoryValues, setCostCategoryValues] = useState<string[]>([]);
  const [costBasis, setCostBasis] = useState<DatabaseExplorerCostBasis>(DEFAULT_COST_BASIS);
  const [capabilityFamily, setCapabilityFamily] = useState<DatabaseUsageCapabilityFamily>(DEFAULT_USAGE_CAPABILITY);
  const [usageMetric, setUsageMetric] = useState<DatabaseUsageMetric>(DEFAULT_USAGE_METRIC_BY_CAPABILITY[DEFAULT_USAGE_CAPABILITY]);
  const [databaseScope, setDatabaseScope] = useState<DatabaseExplorerScopeValue>("all");
  const [dbService, setDbService] = useState("");
  const [dbEngine, setDbEngine] = useState("");
  const effectiveGroupBy = groupBy;

  const filters = useMemo<DatabaseExplorerFiltersQuery>(
    () => ({
      metric,
      ...(metric === "usage" ? { capabilityFamily, usageMetric } : {}),
      ...(metric === "cost" ? { costBasis } : {}),
      groupBy: effectiveGroupBy,
      ...(groupValues.length > 0 ? { groupValues } : {}),
      ...(resourceTypeValues.length > 0 ? { resourceTypeValues } : {}),
      ...(costCategoryValues.length > 0 ? { costCategoryValues } : {}),
      ...(databaseScope !== "all" ? { databaseScope } : {}),
      ...(dbService.trim() ? { dbService: dbService.trim() } : {}),
      ...(dbEngine.trim() ? { dbEngine: dbEngine.trim() } : {}),
    }),
    [capabilityFamily, costBasis, costCategoryValues, databaseScope, dbEngine, dbService, effectiveGroupBy, groupValues, metric, resourceTypeValues, usageMetric],
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
    if (nextMetric === "usage") {
      setCapabilityFamily(DEFAULT_USAGE_CAPABILITY);
      setUsageMetric(DEFAULT_USAGE_METRIC_BY_CAPABILITY[DEFAULT_USAGE_CAPABILITY]);
    }
  };

  const capabilityOptions = useMemo(() => {
    const backend = data?.capabilityAvailability ?? [];
    if (backend.length === 0) {
      const fallback: Array<DatabaseCapabilityAvailability> = [
        { capabilityFamily: "compute_pressure", label: "Compute Pressure", maturity: "high", supportedServices: [], supportedMetrics: ["avg_cpu", "peak_cpu"], selectable: true, disabled: false, warnings: [], coverageSummary: { eligibleResources: 0, coveredResources: 0, coverageRate: null, confidence: "degraded", degraded: false, unavailable: false, unsupported: false } },
        { capabilityFamily: "connection_pressure", label: "Connection Pressure", maturity: "high", supportedServices: [], supportedMetrics: ["avg_connections", "peak_connections"], selectable: true, disabled: false, warnings: [], coverageSummary: { eligibleResources: 0, coveredResources: 0, coverageRate: null, confidence: "degraded", degraded: false, unavailable: false, unsupported: false } },
        { capabilityFamily: "io_activity", label: "IO Activity", maturity: "medium", supportedServices: [], supportedMetrics: ["read_iops", "write_iops", "total_iops"], selectable: true, disabled: false, warnings: [], coverageSummary: { eligibleResources: 0, coveredResources: 0, coverageRate: null, confidence: "degraded", degraded: false, unavailable: false, unsupported: false } },
        { capabilityFamily: "throughput_activity", label: "Throughput Activity", maturity: "medium", supportedServices: [], supportedMetrics: ["read_throughput", "write_throughput", "total_throughput"], selectable: true, disabled: false, warnings: [], coverageSummary: { eligibleResources: 0, coveredResources: 0, coverageRate: null, confidence: "degraded", degraded: false, unavailable: false, unsupported: false } },
        { capabilityFamily: "storage_pressure", label: "Storage Pressure", maturity: "high", supportedServices: [], supportedMetrics: ["storage_used_gb", "allocated_storage_gb"], selectable: true, disabled: false, warnings: [], coverageSummary: { eligibleResources: 0, coveredResources: 0, coverageRate: null, confidence: "degraded", degraded: false, unavailable: false, unsupported: false } },
      ];
      return fallback;
    }
    return backend;
  }, [data?.capabilityAvailability]);

  const usageMetricOptions = useMemo(() => {
    const selected = capabilityOptions.find((option) => option.capabilityFamily === capabilityFamily);
    const metrics = selected?.supportedMetrics ?? [];
    return metrics.map((value) => ({ value, label: USAGE_METRIC_LABELS[value] ?? value }));
  }, [capabilityFamily, capabilityOptions]);

  useEffect(() => {
    if (metric !== "usage") return;
    const selectedCapability = capabilityOptions.find((option) => option.capabilityFamily === capabilityFamily);
    if (!selectedCapability || selectedCapability.disabled) {
      const firstEnabled = capabilityOptions.find((option) => !option.disabled);
      if (firstEnabled) {
        setCapabilityFamily(firstEnabled.capabilityFamily);
      }
      return;
    }
    if (!selectedCapability.supportedMetrics.includes(usageMetric)) {
      setUsageMetric(selectedCapability.supportedMetrics[0] ?? DEFAULT_USAGE_METRIC_BY_CAPABILITY[selectedCapability.capabilityFamily]);
    }
  }, [capabilityFamily, capabilityOptions, metric, usageMetric]);

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

  useEffect(() => {
    if (ENABLED_DB_EXPLORER_COST_BASES.has(costBasis)) return;
    setCostBasis(DEFAULT_COST_BASIS);
  }, [costBasis]);

  const handleClearAll = () => {
    setGroupBy(DEFAULT_GROUP_BY[metric]);
    setGroupValues([]);
    setResourceTypeValues([]);
    setCostCategoryValues([]);
    setCostBasis(DEFAULT_COST_BASIS);
    setDatabaseScope("all");
    setDbService("");
    setDbEngine("");
    if (metric === "usage") {
      setCapabilityFamily(DEFAULT_USAGE_CAPABILITY);
      setUsageMetric(DEFAULT_USAGE_METRIC_BY_CAPABILITY[DEFAULT_USAGE_CAPABILITY]);
    }
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
        metric={metric}
        costBasis={costBasis}
        allowedGroupBy={resolveAllowedGroupBy(metric, allowedGroupByByMetric, allowedGroupBy)}
        databaseScope={databaseScope}
        dbService={dbService}
        dbEngine={dbEngine}
        groupBy={groupBy}
        effectiveGroupBy={effectiveGroupBy}
        groupValues={groupValues}
        resourceTypeValues={resourceTypeValues}
        costCategoryValues={costCategoryValues}
        availableDatabaseScopes={availableDatabaseScopes}
        backendServiceOptions={backendServiceOptions}
        backendEngineOptions={backendEngineOptions}
        groupedValuePreview={data?.filterOptions?.groupedValuePreview}
        capabilityFamily={capabilityFamily}
        usageMetric={usageMetric}
        capabilityOptions={capabilityOptions.map((option) => ({
          capabilityFamily: option.capabilityFamily,
          label: option.label,
          disabled: option.disabled,
          warnings: option.warnings,
          supportedMetrics: option.supportedMetrics,
        }))}
        usageMetricOptions={usageMetricOptions}
        onApplyScope={handleApplyScope}
        onApplyGroupBy={handleApplyGroupBy}
        onApplyCostBasis={setCostBasis}
        onApplyCapabilityFamily={(next) => {
          setCapabilityFamily(next);
          const target = capabilityOptions.find((option) => option.capabilityFamily === next);
          const nextMetric = target?.supportedMetrics?.[0] ?? DEFAULT_USAGE_METRIC_BY_CAPABILITY[next];
          setUsageMetric(nextMetric);
        }}
        onApplyUsageMetric={setUsageMetric}
        onApplyResourceTypeValues={setResourceTypeValues}
        onApplyCostCategoryValues={setCostCategoryValues}
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
            metric={metric}
            capabilityFamily={capabilityFamily}
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
