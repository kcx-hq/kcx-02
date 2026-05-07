import { Check, ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { DatabaseExplorerGroupBy, DatabaseExplorerMetric } from "../../../api/dashboardTypes";
import {
  DATABASE_TYPE_OPTIONS,
  DATABASE_TYPE_TAXONOMY,
  resolveHierarchyFromEngine,
  type DatabaseTypeValue,
} from "../databaseExplorer.taxonomy";

type DatabaseExplorerFiltersProps = {
  metric: DatabaseExplorerMetric;
  groupBy: "auto" | DatabaseExplorerGroupBy;
  effectiveGroupBy: DatabaseExplorerGroupBy;
  databaseType: DatabaseTypeValue;
  dbService: string;
  dbEngine: string;
  onApplyGroupBy: (next: {
    groupBy: "auto" | DatabaseExplorerGroupBy;
    databaseType: DatabaseTypeValue;
    dbService: string;
    dbEngine: string;
  }) => void;
  onClearAll: () => void;
};

const metricOptions: Array<{ value: DatabaseExplorerMetric; label: string }> = [
  { value: "cost", label: "Cost" },
  { value: "usage", label: "Usage" },
];

const groupByOptions: Array<{ value: "auto" | DatabaseExplorerGroupBy; label: string }> = [
  { value: "auto", label: "Database Scope" },
  { value: "database_type", label: "Database Type" },
  { value: "db_service", label: "DB Service" },
  { value: "db_engine", label: "DB Engine" },
  { value: "region", label: "Region" },
  { value: "resource_type", label: "Resource Type" },
  { value: "instance_class", label: "Instance Class" },
  { value: "cluster", label: "Cluster" },
  { value: "cost_category", label: "Cost Category" },
];

const drawerDimensions: Array<{ key: "database_scope" | DatabaseExplorerGroupBy; label: string }> = [
  { key: "database_scope", label: "Database Scope" },
  { key: "region", label: "Region" },
  { key: "cost_category", label: "Cost Category" },
  { key: "resource_type", label: "Resource Type" },
  { key: "instance_class", label: "Instance Class" },
  { key: "cluster", label: "Cluster" },
];

const formatDbServiceLabel = (service: string): string => {
  switch (service) {
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
      return service;
  }
};

export function DatabaseExplorerFilters({
  metric,
  groupBy,
  effectiveGroupBy,
  databaseType,
  dbService,
  dbEngine,
  onApplyGroupBy,
  onClearAll,
}: DatabaseExplorerFiltersProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeDrawerDimension, setActiveDrawerDimension] = useState<"database_scope" | DatabaseExplorerGroupBy>("database_scope");
  const [draftGroupBy, setDraftGroupBy] = useState<"auto" | DatabaseExplorerGroupBy>(groupBy);
  const [draftDatabaseType, setDraftDatabaseType] = useState<DatabaseTypeValue>(databaseType);
  const [draftDbService, setDraftDbService] = useState(dbService);
  const [draftDbEngine, setDraftDbEngine] = useState(dbEngine);

  const scopeTypeLabel = useMemo(() => {
    if (databaseType === "all") return "All Databases";
    return DATABASE_TYPE_OPTIONS.find((option) => option.value === databaseType)?.label ?? "All Databases";
  }, [databaseType]);

  const scopeLabel = useMemo(() => {
    const segments: string[] = [];
    if (databaseType !== "all") {
      segments.push(scopeTypeLabel);
    }
    if (dbService.trim()) segments.push(formatDbServiceLabel(dbService));
    if (dbEngine.trim()) segments.push(dbEngine);
    return segments.length ? segments.join(" / ") : "All Databases";
  }, [databaseType, dbEngine, dbService, scopeTypeLabel]);

  const effectiveGroupByLabel = groupByOptions.find((option) => option.value === effectiveGroupBy)?.label ?? "Database Scope";
  const groupByLabel =
    groupBy === "auto"
      ? `Database Scope (${effectiveGroupByLabel})`
      : (groupByOptions.find((option) => option.value === groupBy)?.label ?? "Database Scope");

  const servicesForType = useMemo(() => {
    if (draftDatabaseType === "all") return [];
    return DATABASE_TYPE_TAXONOMY[draftDatabaseType].services;
  }, [draftDatabaseType]);

  const enginesForCurrent = useMemo(() => {
    if (draftDatabaseType === "all") return [];
    const typeTaxonomy = DATABASE_TYPE_TAXONOMY[draftDatabaseType];
    if (!draftDbService.trim()) return typeTaxonomy.engines;
    const service = typeTaxonomy.services.find((item) => item.canonical === draftDbService);
    return service?.engines ?? typeTaxonomy.engines;
  }, [draftDatabaseType, draftDbService]);

  const openDrawer = () => {
    setDraftGroupBy(groupBy);
    setDraftDatabaseType(databaseType);
    setDraftDbService(dbService);
    setDraftDbEngine(dbEngine);
    setActiveDrawerDimension(groupBy === "auto" ? "database_scope" : groupBy);
    setDrawerOpen(true);
  };

  const applyDrawer = () => {
    const safeGroupBy = metric === "usage" && draftGroupBy === "cost_category" ? "auto" : draftGroupBy;
    onApplyGroupBy({
      groupBy: safeGroupBy,
      databaseType: draftDatabaseType,
      dbService: draftDbService,
      dbEngine: draftDbEngine,
    });
    setDrawerOpen(false);
  };

  const chips = [
    { key: "metric", label: "Metric", value: metricOptions.find((option) => option.value === metric)?.label ?? metric },
    {
      key: "databaseScope",
      label: "Database Scope",
      value: scopeLabel,
    },
    {
      key: "groupBy",
      label: "Group By",
      value: groupByLabel,
    },
  ];

  return (
    <section className="cost-explorer-control-surface" aria-label="Database explorer controls">
      <div className="cost-explorer-toolbar-row">
        <div className="cost-explorer-toolbar-item">
          <button type="button" className="cost-explorer-toolbar-trigger" onClick={openDrawer}>
            <span className="cost-explorer-toolbar-trigger__label">Group By</span>
            <span className="cost-explorer-toolbar-trigger__row">
              <span className="cost-explorer-toolbar-trigger__value">{groupByLabel}</span>
              <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
            </span>
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
          <button type="button" className="cost-explorer-chip-bar__clear cost-explorer-chip-bar__clear--inline" onClick={onClearAll}>
            Clear all
          </button>
        </div>
      </div>

      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogContent className="left-auto right-0 top-0 h-screen max-h-screen w-[min(96vw,42rem)] max-w-none -translate-x-0 -translate-y-0 rounded-none border-l border-[color:var(--border-light)] p-6 data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-xl font-semibold text-text-primary">Group By</DialogTitle>
          </DialogHeader>
          <div className="mt-4 ec2-explorer-groupby-drawer database-explorer-groupby-drawer">
            <div className="ec2-explorer-groupby database-explorer-groupby" role="dialog" aria-label="Database group by options">
              <div className="ec2-explorer-groupby__body">
                <div className="cost-explorer-filter-popover__split ec2-explorer-groupby__split ec2-explorer-groupby__split--with-values database-explorer-groupby__split">
                  <div className="cost-explorer-filter-popover__split-pane">
                    <p className="cost-explorer-filter-popover__title">Dimensions</p>
                    <div className="cost-explorer-filter-popover__list cost-explorer-filter-popover__list--group-dimensions" role="listbox" aria-label="Database dimensions">
                      {drawerDimensions.map((dimension) => {
                        const selected = activeDrawerDimension === dimension.key;
                        const disabled = metric === "usage" && dimension.key === "cost_category";
                        return (
                          <button
                            key={dimension.key}
                            type="button"
                            className={`cost-explorer-filter-option${selected ? " is-active" : ""}`}
                            onClick={() => {
                              if (disabled) return;
                              setActiveDrawerDimension(dimension.key);
                              setDraftGroupBy(dimension.key === "database_scope" ? "auto" : dimension.key);
                            }}
                            role="option"
                            aria-selected={selected}
                            aria-disabled={disabled}
                            style={disabled ? { opacity: 0.55, cursor: "not-allowed" } : undefined}
                          >
                            <span className="cost-explorer-filter-option__label">{dimension.label}</span>
                            {selected ? <Check className="cost-explorer-filter-option__check" size={15} aria-hidden="true" /> : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="cost-explorer-filter-popover__split-pane cost-explorer-filter-popover__split-pane--right">
                    {activeDrawerDimension === "database_scope" ? (
                      <div className="database-explorer-groupby__panel">
                        <p className="cost-explorer-filter-popover__title">Database Scope</p>
                        <div className="database-explorer-groupby__panel-body">
                          <section className="database-explorer-groupby__section" aria-labelledby="database-groupby-type">
                            <p id="database-groupby-type" className="database-explorer-groupby__section-label">
                              Database Type
                            </p>
                            <div className="database-explorer-groupby__section-list" role="listbox" aria-label="Database types">
                              <button
                                type="button"
                                className={`cost-explorer-filter-option${draftDatabaseType === "all" ? " is-active" : ""}`}
                                onClick={() => {
                                  setDraftGroupBy("auto");
                                  setDraftDatabaseType("all");
                                  setDraftDbService("");
                                  setDraftDbEngine("");
                                }}
                                role="option"
                                aria-selected={draftDatabaseType === "all"}
                              >
                                <span className="cost-explorer-filter-option__label">All Databases</span>
                                {draftDatabaseType === "all" ? (
                                  <Check className="cost-explorer-filter-option__check" size={15} aria-hidden="true" />
                                ) : null}
                              </button>
                              {DATABASE_TYPE_OPTIONS.filter((option) => option.value !== "all").map((option) => {
                                const selected = draftDatabaseType === option.value;
                                return (
                                  <button
                                    key={option.value}
                                    type="button"
                                    className={`cost-explorer-filter-option${selected ? " is-active" : ""}`}
                                    onClick={() => {
                                      setDraftGroupBy("auto");
                                      setDraftDatabaseType(option.value as DatabaseTypeValue);
                                      setDraftDbService("");
                                      setDraftDbEngine("");
                                    }}
                                    role="option"
                                    aria-selected={selected}
                                  >
                                    <span className="cost-explorer-filter-option__label">{option.label}</span>
                                    {selected ? (
                                      <Check className="cost-explorer-filter-option__check" size={15} aria-hidden="true" />
                                    ) : null}
                                  </button>
                                );
                              })}
                            </div>
                          </section>

                          <section className="database-explorer-groupby__section" aria-labelledby="database-groupby-service">
                            <p id="database-groupby-service" className="database-explorer-groupby__section-label">
                              DB Service
                            </p>
                            {draftDatabaseType === "all" ? (
                              <p className="database-explorer-groupby__section-empty">Select a database type to narrow services.</p>
                            ) : (
                              <div className="database-explorer-groupby__section-list" role="listbox" aria-label="Database services">
                                {servicesForType.map((service) => {
                                  const selected = draftDbService === service.canonical;
                                  return (
                                    <button
                                      key={service.canonical}
                                      type="button"
                                      className={`cost-explorer-filter-option${selected ? " is-active" : ""}`}
                                      onClick={() => {
                                        setDraftGroupBy("auto");
                                        setDraftDbService(service.canonical);
                                        setDraftDbEngine("");
                                      }}
                                      role="option"
                                      aria-selected={selected}
                                    >
                                      <span className="cost-explorer-filter-option__label">{formatDbServiceLabel(service.canonical)}</span>
                                      {selected ? (
                                        <Check className="cost-explorer-filter-option__check" size={15} aria-hidden="true" />
                                      ) : null}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </section>

                          <section className="database-explorer-groupby__section" aria-labelledby="database-groupby-engine">
                            <p id="database-groupby-engine" className="database-explorer-groupby__section-label">
                              DB Engine
                            </p>
                            {draftDatabaseType === "all" ? (
                              <p className="database-explorer-groupby__section-empty">Select a database type to narrow engines.</p>
                            ) : (
                              <div className="database-explorer-groupby__section-list" role="listbox" aria-label="Database engines">
                                {enginesForCurrent.map((engine) => {
                                  const selected = draftDbEngine === engine;
                                  return (
                                    <button
                                      key={engine}
                                      type="button"
                                      className={`cost-explorer-filter-option${selected ? " is-active" : ""}`}
                                      onClick={() => {
                                        const resolvedHierarchy = resolveHierarchyFromEngine(engine);
                                        setDraftGroupBy("auto");
                                        if (resolvedHierarchy) {
                                          setDraftDatabaseType(resolvedHierarchy.databaseType);
                                          setDraftDbService(resolvedHierarchy.dbService);
                                        }
                                        setDraftDbEngine(engine);
                                      }}
                                      role="option"
                                      aria-selected={selected}
                                    >
                                      <span className="cost-explorer-filter-option__label">{engine}</span>
                                      {selected ? (
                                        <Check className="cost-explorer-filter-option__check" size={15} aria-hidden="true" />
                                      ) : null}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </section>
                        </div>
                      </div>
                    ) : (
                      <div className="database-explorer-groupby__panel">
                        <p className="cost-explorer-filter-popover__title">Values</p>
                        <div className="database-explorer-groupby__panel-body">
                          <section className="database-explorer-groupby__section" aria-labelledby="database-groupby-selection">
                            <p id="database-groupby-selection" className="database-explorer-groupby__section-label">
                              Selected Dimension
                            </p>
                            <div className="database-explorer-groupby__section-list">
                              <button
                                type="button"
                                className="cost-explorer-filter-option is-active"
                                onClick={() => setDraftGroupBy(activeDrawerDimension)}
                              >
                                <span className="cost-explorer-filter-option__label">
                                  {groupByOptions.find((option) => option.value === activeDrawerDimension)?.label ?? "Group"}
                                </span>
                                <Check className="cost-explorer-filter-option__check" size={15} aria-hidden="true" />
                              </button>
                            </div>
                            <p className="database-explorer-groupby__section-empty">
                              Apply to group the database chart and table by{" "}
                              {groupByOptions.find((option) => option.value === activeDrawerDimension)?.label ?? "this dimension"}.
                            </p>
                          </section>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="cost-explorer-filter-popover__actions">
                <button type="button" className="cost-explorer-filter-popover__apply" onClick={applyDrawer}>
                  Apply
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
