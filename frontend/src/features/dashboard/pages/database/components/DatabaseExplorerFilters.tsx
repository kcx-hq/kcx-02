import { useMemo } from "react";

import type {
  DatabaseExplorerFilterOptions,
  DatabaseExplorerGroupBy,
  DatabaseExplorerMetric,
  DatabaseExplorerScopeValue,
} from "../../../api/dashboardTypes";
import {
  DATABASE_SCOPE_UI_ROWS,
  formatDatabaseScopePrimaryLabel,
  isDatabaseScopeAvailable,
} from "../databaseExplorer.scope";

type DatabaseExplorerFiltersProps = {
  metric: DatabaseExplorerMetric;
  databaseScope: DatabaseExplorerScopeValue;
  dbService: string;
  dbEngine: string;
  regionKey: string;
  resourceType: string;
  instanceClass: string;
  cluster: string;
  groupBy: DatabaseExplorerGroupBy;
  availableDatabaseScopes: DatabaseExplorerScopeValue[];
  filterOptions: DatabaseExplorerFilterOptions;
  onFiltersChange: (
    next: Partial<{
      databaseScope: DatabaseExplorerScopeValue;
      dbService: string;
      dbEngine: string;
      regionKey: string;
      resourceType: string;
      instanceClass: string;
      cluster: string;
    }>,
  ) => void;
  onGroupByChange: (next: DatabaseExplorerGroupBy) => void;
  onClearAll: () => void;
};

const groupByOptions: Array<{ value: DatabaseExplorerGroupBy; label: string }> = [
  { value: "db_service", label: "DB Service" },
  { value: "db_engine", label: "DB Engine" },
  { value: "region", label: "Region" },
  { value: "resource_type", label: "Resource Type" },
  { value: "instance_class", label: "Instance Class" },
  { value: "cluster", label: "Cluster" },
  { value: "cost_category", label: "Cost Category" },
];

const serviceLabel = (value: string): string => {
  switch (value) {
    case "AmazonRDS":
      return "Amazon RDS";
    case "Aurora":
      return "Amazon Aurora";
    case "DynamoDB":
      return "Amazon DynamoDB";
    case "ElastiCache":
      return "Amazon ElastiCache";
    case "MemoryDB":
      return "Amazon MemoryDB";
    case "DocumentDB":
      return "Amazon DocumentDB";
    case "Neptune":
      return "Amazon Neptune";
    case "Keyspaces":
      return "Amazon Keyspaces";
    case "Timestream":
      return "Amazon Timestream";
    default:
      return value;
  }
};

const formatChipValue = (value: string, fallback: string): string => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

export function DatabaseExplorerFilters({
  metric,
  databaseScope,
  dbService,
  dbEngine,
  regionKey,
  resourceType,
  instanceClass,
  cluster,
  groupBy,
  availableDatabaseScopes,
  filterOptions,
  onFiltersChange,
  onGroupByChange,
  onClearAll,
}: DatabaseExplorerFiltersProps) {
  const dynamicFilter = useMemo(() => {
    if (groupBy === "region") {
      return {
        key: "regionKey" as const,
        label: "Region",
        value: regionKey,
        emptyLabel: "All Regions",
        options: filterOptions.regions.map((option) => ({ value: option.value, label: option.label })),
      };
    }
    if (groupBy === "resource_type") {
      return {
        key: "resourceType" as const,
        label: "Resource Type",
        value: resourceType,
        emptyLabel: "All Resource Types",
        options: filterOptions.resourceTypes.map((option) => ({ value: option, label: option })),
      };
    }
    if (groupBy === "instance_class") {
      return {
        key: "instanceClass" as const,
        label: "Instance Class",
        value: instanceClass,
        emptyLabel: "All Instance Classes",
        options: filterOptions.instanceClasses.map((option) => ({ value: option, label: option })),
      };
    }
    if (groupBy === "cluster") {
      return {
        key: "cluster" as const,
        label: "Cluster",
        value: cluster,
        emptyLabel: "All Clusters",
        options: filterOptions.clusters.map((option) => ({ value: option, label: option })),
      };
    }
    return null;
  }, [cluster, filterOptions.clusters, filterOptions.instanceClasses, filterOptions.regions, filterOptions.resourceTypes, groupBy, instanceClass, regionKey, resourceType]);

  const chips = [
    { key: "metric", label: "Metric", value: metric === "usage" ? "Usage" : "Cost" },
    { key: "scope", label: "Database Scope", value: formatDatabaseScopePrimaryLabel(databaseScope) },
    { key: "groupBy", label: "Group By", value: groupByOptions.find((option) => option.value === groupBy)?.label ?? "DB Service" },
    { key: "dbService", label: "DB Service", value: formatChipValue(serviceLabel(dbService), "All Services") },
    { key: "dbEngine", label: "DB Engine", value: formatChipValue(dbEngine, "All Engines") },
  ];

  if (dynamicFilter) {
    chips.push({
      key: dynamicFilter.key,
      label: dynamicFilter.label,
      value: formatChipValue(dynamicFilter.options.find((option) => option.value === dynamicFilter.value)?.label ?? dynamicFilter.value, dynamicFilter.emptyLabel),
    });
  }

  return (
    <section className="cost-explorer-control-surface" aria-label="Database explorer controls">
      <div className="cost-explorer-toolbar-row database-explorer-filters-row">
        <label className="cost-explorer-toolbar-item cost-explorer-field">
          <span className="cost-explorer-field__label">Database Scope</span>
          <select
            className="cost-explorer-field__control"
            value={databaseScope}
            onChange={(event) => onFiltersChange({ databaseScope: event.target.value as DatabaseExplorerScopeValue })}
          >
            {DATABASE_SCOPE_UI_ROWS.filter((row) => row.value === "all" || isDatabaseScopeAvailable(row.value, availableDatabaseScopes)).map((row) => (
              <option key={row.value} value={row.value}>
                {row.depth === 1 ? `   ${row.label}` : row.label}
              </option>
            ))}
          </select>
        </label>

        <label className="cost-explorer-toolbar-item cost-explorer-field">
          <span className="cost-explorer-field__label">Group By</span>
          <select
            className="cost-explorer-field__control"
            value={groupBy}
            onChange={(event) => onGroupByChange(event.target.value as DatabaseExplorerGroupBy)}
          >
            {groupByOptions
              .filter((option) => metric === "cost" || option.value !== "cost_category")
              .map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
          </select>
        </label>

        <label className="cost-explorer-toolbar-item cost-explorer-field">
          <span className="cost-explorer-field__label">DB Service</span>
          <select className="cost-explorer-field__control" value={dbService} onChange={(event) => onFiltersChange({ dbService: event.target.value })}>
            <option value="">All Services</option>
            {filterOptions.dbServices.map((option) => (
              <option key={option} value={option}>
                {serviceLabel(option)}
              </option>
            ))}
          </select>
        </label>

        <label className="cost-explorer-toolbar-item cost-explorer-field">
          <span className="cost-explorer-field__label">DB Engine</span>
          <select className="cost-explorer-field__control" value={dbEngine} onChange={(event) => onFiltersChange({ dbEngine: event.target.value })}>
            <option value="">All Engines</option>
            {filterOptions.dbEngines.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        {dynamicFilter ? (
          <label className="cost-explorer-toolbar-item cost-explorer-field">
            <span className="cost-explorer-field__label">{dynamicFilter.label}</span>
            <select
              className="cost-explorer-field__control"
              value={dynamicFilter.value}
              onChange={(event) => onFiltersChange({ [dynamicFilter.key]: event.target.value })}
            >
              <option value="">{dynamicFilter.emptyLabel}</option>
              {dynamicFilter.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="database-explorer-filters-row__clear-wrap">
          <button type="button" className="cost-explorer-chip-bar__clear cost-explorer-chip-bar__clear--inline" onClick={onClearAll}>
            Clear filters
          </button>
        </div>
      </div>

      <div className="cost-explorer-chip-bar" aria-label="Selected filter summary">
        <div className="cost-explorer-chip-row">
          {chips.map((chip) => (
            <span key={chip.key} className="cost-explorer-chip">
              <span className="cost-explorer-chip__edit">
                {chip.label}: {chip.value}
              </span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
