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

type ExplorerDrilldownPayload = {
  rawValue: string;
  clickedLabel: string;
};

type CostCtaPayload = {
  groupKey: string;
  groupLabel: string;
  filters: Partial<Record<"db_service" | "db_engine" | "region_key" | "resource_type", string>>;
};

type UsageCtaPayload = {
  groupKey: string;
  groupLabel: string;
  filters: Partial<Record<"db_service" | "db_engine" | "region_key" | "instance_class" | "cluster", string>>;
};

const COST_CTA_SUPPORTED_GROUP_BY = new Set<DatabaseExplorerGroupBy>([
  "db_service",
  "db_engine",
  "region",
  "resource_type",
]);

const USAGE_CTA_SUPPORTED_GROUP_BY = new Set<DatabaseExplorerGroupBy>([
  "db_service",
  "db_engine",
  "region",
  "instance_class",
  "cluster",
]);

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
    setGroupBy(next.groupBy);
    setGroupValues(next.groupValues);
  };

  const availableDatabaseScopes = data?.filterOptions?.availableDatabaseScopes ?? ["all"];
  const backendServiceOptions = data?.filterOptions?.dbServices ?? [];
  const backendEngineOptions = data?.filterOptions?.dbEngines ?? [];
  const nestedServiceEngineLabel = useMemo(() => {
    const service = dbService.trim();
    const engine = dbEngine.trim();
    if (!service || !engine) return "";
    return `${service} - ${engine}`;
  }, [dbEngine, dbService]);

  const displayTrendGrouped = useMemo(() => {
    const base = data?.trendGrouped;
    if (!base) return base;
    if (metric === "cost" && effectiveGroupBy === "db_engine") {
      const filteredSeries = base.series.filter((series) => {
        const key = String(series.key ?? "").trim().toLowerCase();
        const label = String(series.label ?? "").trim().toLowerCase();
        return !key.startsWith("unknown") && !label.startsWith("unknown");
      });
      return {
        ...base,
        series: filteredSeries,
      };
    }
    if (!nestedServiceEngineLabel) return base;
    if (effectiveGroupBy !== "db_service") return base;

    return {
      ...base,
      series: base.series.map((series) => ({
        ...series,
        label: nestedServiceEngineLabel,
      })),
    };
  }, [data?.trendGrouped, effectiveGroupBy, metric, nestedServiceEngineLabel]);

  const displayTableRows = useMemo(() => {
    const rows = data?.table ?? [];
    if (metric === "cost" && effectiveGroupBy === "db_engine") {
      return rows.filter((row) => {
        const key = String(row.groupKey ?? "").trim().toLowerCase();
        const label = String(row.groupLabel ?? row.group ?? "").trim().toLowerCase();
        return !key.startsWith("unknown") && !label.startsWith("unknown");
      });
    }
    if (!nestedServiceEngineLabel) return rows;
    if (effectiveGroupBy !== "db_service") return rows;
    return rows.map((row) => ({
      ...row,
      group: nestedServiceEngineLabel,
      groupLabel: nestedServiceEngineLabel,
    }));
  }, [data?.table, effectiveGroupBy, metric, nestedServiceEngineLabel]);

  const buildCostCtaPayload = (payload: ExplorerDrilldownPayload): CostCtaPayload | null => {
    if (!COST_CTA_SUPPORTED_GROUP_BY.has(effectiveGroupBy)) return null;

    const groupKey = payload.rawValue.trim();
    const groupLabel = payload.clickedLabel.trim();
    const fallbackValue = groupKey || groupLabel;
    const filters: CostCtaPayload["filters"] = {};

    if (effectiveGroupBy === "db_service") {
      // Keep group_key for context/debug, but use label-first concrete filter value
      // so graph and table clicks resolve to the same service value.
      const serviceValue = groupLabel || fallbackValue;
      if (!serviceValue) return null;
      filters.db_service = serviceValue;
    } else if (effectiveGroupBy === "db_engine") {
      // Keep group_key for context/debug, but use label-first concrete filter value
      // so graph and table clicks resolve to the same engine value.
      const engineValue = groupLabel || fallbackValue;
      if (!engineValue) return null;
      filters.db_engine = engineValue;
    } else if (effectiveGroupBy === "region") {
      const candidate = groupKey || fallbackValue;
      if (!candidate) return null;
      filters.region_key = candidate;
    } else if (effectiveGroupBy === "resource_type") {
      const candidate = groupKey || fallbackValue;
      if (!candidate) return null;
      filters.resource_type = candidate;
    }

    return {
      groupKey: groupKey || fallbackValue,
      groupLabel: groupLabel || fallbackValue,
      filters,
    };
  };

  const buildUsageCtaPayload = (payload: ExplorerDrilldownPayload): UsageCtaPayload | null => {
    if (!USAGE_CTA_SUPPORTED_GROUP_BY.has(effectiveGroupBy)) return null;

    const groupKey = payload.rawValue.trim();
    const groupLabel = payload.clickedLabel.trim();
    const fallbackValue = groupKey || groupLabel;
    const filters: UsageCtaPayload["filters"] = {};

    if (effectiveGroupBy === "db_service") {
      const serviceValue = groupLabel || fallbackValue;
      if (!serviceValue) return null;
      filters.db_service = serviceValue;
    } else if (effectiveGroupBy === "db_engine") {
      const engineValue = groupLabel || fallbackValue;
      if (!engineValue) return null;
      filters.db_engine = engineValue;
    } else if (effectiveGroupBy === "region") {
      const candidate = groupKey || fallbackValue;
      if (!candidate) return null;
      filters.region_key = candidate;
    } else if (effectiveGroupBy === "instance_class") {
      const candidate = groupLabel || fallbackValue;
      if (!candidate) return null;
      filters.instance_class = candidate;
    } else if (effectiveGroupBy === "cluster") {
      const candidate = groupKey || groupLabel;
      if (!candidate) return null;
      const normalized = candidate.trim().toLowerCase();
      if (
        normalized === "unknown"
        || normalized.startsWith("unknown ")
        || normalized === "standalone-no-cluster"
      ) {
        return null;
      }
      filters.cluster = candidate;
    }

    return {
      groupKey: groupKey || fallbackValue,
      groupLabel: groupLabel || fallbackValue,
      filters,
    };
  };

  const navigateToAssets = (payload: ExplorerDrilldownPayload) => {
    const next = new URLSearchParams(location.search);

    if (metric === "cost") {
      const cta = buildCostCtaPayload(payload);
      if (!cta) return;

      if (!cta.groupKey && !cta.groupLabel) return;

      next.set("source", "database_explorer");
      next.set("metric", "cost");
      next.set("group_by", effectiveGroupBy);
      next.set("group_key", cta.groupKey);
      next.set("group_label", cta.groupLabel);
      next.delete("groupValue");
      next.delete("clickedLabel");

      if (costBasis) {
        next.set("cost_basis", costBasis);
      } else {
        next.delete("cost_basis");
      }
    } else {
      const usageCta = buildUsageCtaPayload(payload);
      if (!usageCta) return;

      if (!usageCta.groupKey && !usageCta.groupLabel) return;

      next.set("source", "database_explorer");
      next.set("metric", "usage");
      next.set("group_by", effectiveGroupBy);
      next.set("group_key", usageCta.groupKey);
      next.set("group_label", usageCta.groupLabel);
      next.delete("groupValue");
      next.delete("clickedLabel");
      next.set("capability_family", capabilityFamily);
      next.set("usage_metric", usageMetric);
    }

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

    if (metric === "cost") {
      const cta = buildCostCtaPayload(payload);
      if (!cta) return;
      next.delete("instance_class");
      next.delete("region_key");
      next.delete("resource_type");
      next.delete("cluster");

      if (typeof cta.filters.db_service === "string") {
        next.set("db_service", cta.filters.db_service);
      } else if (effectiveGroupBy === "db_service") {
        next.delete("db_service");
      }

      if (typeof cta.filters.db_engine === "string") {
        next.set("db_engine", cta.filters.db_engine);
      } else if (effectiveGroupBy === "db_engine") {
        next.delete("db_engine");
      }

      if (typeof cta.filters.region_key === "string") {
        next.set("region_key", cta.filters.region_key);
      }

      if (typeof cta.filters.resource_type === "string") {
        next.set("resource_type", cta.filters.resource_type);
      }
    } else {
      const usageCta = buildUsageCtaPayload(payload);
      if (!usageCta) return;

      next.delete("instance_class");
      next.delete("region_key");
      next.delete("cluster");

      if (typeof usageCta.filters.db_service === "string") {
        next.set("db_service", usageCta.filters.db_service);
      } else if (effectiveGroupBy === "db_service") {
        next.delete("db_service");
      }

      if (typeof usageCta.filters.db_engine === "string") {
        next.set("db_engine", usageCta.filters.db_engine);
      } else if (effectiveGroupBy === "db_engine") {
        next.delete("db_engine");
      }

      if (typeof usageCta.filters.region_key === "string") {
        next.set("region_key", usageCta.filters.region_key);
      }

      if (typeof usageCta.filters.instance_class === "string") {
        next.set("instance_class", usageCta.filters.instance_class);
      }

      if (typeof usageCta.filters.cluster === "string") {
        next.set("cluster", usageCta.filters.cluster);
      }
    }

    navigate({ pathname: DATABASE_ASSETS_PATH, search: next.toString() });
  };

  return (
    <div className="dashboard-page database-explorer-page cost-explorer-page">
      <DashboardPageHeader
        title={
          <div className="database-explorer-page__metric-title">
            <div
              className="ec2-explorer-metric-segmented database-explorer-page__metric-switch"
              role="group"
              aria-label="Database explorer metric"
            >
              {metricOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`ec2-explorer-metric-segmented__item${metric === option.value ? " is-active" : ""}`}
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
            trendGrouped={displayTrendGrouped}
            isLoading={pageLoading}
            onDrilldown={({ rawValue, clickedLabel }) => {
              navigateToAssets({ rawValue, clickedLabel });
            }}
          />
          <DatabaseExplorerGroupedTable
            metric={metric}
            groupBy={effectiveGroupBy}
            capabilityFamily={capabilityFamily}
            rows={displayTableRows}
            isLoading={pageLoading}
            onRowClick={(row) => {
              navigateToAssets({
                rawValue: row.groupKey ?? row.group,
                clickedLabel: row.groupLabel ?? row.group,
              });
            }}
          />
        </>
      ) : null}
    </div>
  );
}
