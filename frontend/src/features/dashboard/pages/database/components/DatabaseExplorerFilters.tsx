import { Check, ChevronDown } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type {
  DatabaseExplorerGroupBy,
  DatabaseExplorerScopeValue,
} from "../../../api/dashboardTypes";
import { isDatabaseScopeAvailable } from "../databaseExplorer.scope";

type DatabaseExplorerFiltersProps = {
  allowedGroupBy: DatabaseExplorerGroupBy[];
  databaseScope: DatabaseExplorerScopeValue;
  dbService: string;
  dbEngine: string;
  groupBy: DatabaseExplorerGroupBy;
  effectiveGroupBy: DatabaseExplorerGroupBy;
  groupValues: string[];
  availableDatabaseScopes: DatabaseExplorerScopeValue[];
  backendServiceOptions: string[];
  backendEngineOptions: string[];
  groupedValuePreview?: Partial<Record<DatabaseExplorerGroupBy, string[]>>;
  onApplyScope: (next: { databaseScope: DatabaseExplorerScopeValue; dbService: string; dbEngine: string }) => void;
  onApplyGroupBy: (next: { groupBy: DatabaseExplorerGroupBy; groupValues: string[] }) => void;
  onClearAll: () => void;
};

const groupByOptions: Array<{ value: DatabaseExplorerGroupBy; label: string; allLabel: string }> = [
  { value: "db_service", label: "DB Service", allLabel: "DB Services" },
  { value: "db_engine", label: "DB Engine", allLabel: "DB Engines" },
  { value: "region", label: "Region", allLabel: "Regions" },
  { value: "resource_type", label: "Resource Type", allLabel: "Resource Types" },
  { value: "instance_class", label: "Instance Class", allLabel: "Instance Classes" },
  { value: "cluster", label: "Cluster", allLabel: "Clusters" },
  { value: "cost_category", label: "Cost Category", allLabel: "Cost Categories" },
];

const groupByDimensions = groupByOptions.map((option) => ({ key: option.value, label: option.label }));

const serviceMatchesScope = (service: string, scope: DatabaseExplorerScopeValue): boolean => {
  const key = service.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!key) return false;
  if (scope === "relational_rds") return ["amazonrds", "amazonrelationaldatabaseservice", "rds"].includes(key);
  if (scope === "relational_aurora") return ["aurora", "amazonaurora"].includes(key);
  if (scope === "key_value_dynamodb") return ["amazondynamodb", "dynamodb"].includes(key);
  if (scope === "in_memory_elasticache") return ["amazonelasticache", "elasticache"].includes(key);
  if (scope === "in_memory_memorydb") return ["amazonmemorydb", "memorydb"].includes(key);
  if (scope === "document") return ["amazondocdb", "docdb", "amazondocumentdb", "documentdb"].includes(key);
  if (scope === "graph") return ["amazonneptune", "neptune"].includes(key);
  if (scope === "wide_column") return ["amazonkeyspaces", "keyspaces"].includes(key);
  if (scope === "time_series") return ["amazontimestream", "timestream"].includes(key);
  return false;
};

const uniqueSorted = (values: string[]): string[] =>
  [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right));

const serviceToScope = (service: string): DatabaseExplorerScopeValue => {
  const key = service.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (key.includes("aurora")) return "relational_aurora";
  if (key.includes("elasticache")) return "in_memory_elasticache";
  if (key.includes("memorydb")) return "in_memory_memorydb";
  if (key.includes("rds")) return "relational_rds";
  if (key.includes("dynamodb")) return "key_value_dynamodb";
  if (key.includes("docdb") || key.includes("documentdb")) return "document";
  if (key.includes("neptune")) return "graph";
  if (key.includes("keyspaces")) return "wide_column";
  if (key.includes("timestream")) return "time_series";
  return "all";
};

const engineBelongsToService = (engine: string, service: string): boolean => {
  const ek = engine.trim().toLowerCase();
  const sk = service.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!ek || !sk) return false;
  if (sk.includes("aurora")) return ek.includes("aurora");
  if (sk.includes("elasticache")) return ek.includes("redis") || ek.includes("memcached") || ek.includes("valkey");
  if (sk.includes("memorydb")) return ek.includes("redis") || ek.includes("valkey");
  if (sk.includes("rds")) return !ek.includes("aurora") && (ek.includes("mysql") || ek.includes("postgres") || ek.includes("maria") || ek.includes("oracle") || ek.includes("sql"));
  return false;
};

export function DatabaseExplorerFilters({
  allowedGroupBy,
  databaseScope,
  dbService,
  dbEngine,
  groupBy,
  effectiveGroupBy,
  groupValues,
  availableDatabaseScopes,
  backendServiceOptions,
  backendEngineOptions,
  groupedValuePreview,
  onApplyScope,
  onApplyGroupBy,
  onClearAll,
}: DatabaseExplorerFiltersProps) {
  const groupBySelectedStyle = {
    backgroundColor: "rgba(35, 162, 130, 0.14)",
    borderLeft: "2px solid rgba(35, 162, 130, 0.5)",
    boxShadow: "inset 0 0 0 1px rgba(35, 162, 130, 0.24)",
    outline: "1px solid rgba(35, 162, 130, 0.18)",
  } as const;
  const groupByValuePreviewStyle = {
    backgroundColor: "rgba(35, 162, 130, 0.07)",
    borderLeft: "2px solid rgba(35, 162, 130, 0.28)",
    boxShadow: "inset 0 0 0 1px rgba(35, 162, 130, 0.14)",
    outline: "1px solid rgba(35, 162, 130, 0.1)",
  } as const;

  const [databaseMenuOpen, setDatabaseMenuOpen] = useState(false);
  const [groupDrawerOpen, setGroupDrawerOpen] = useState(false);
  const [hoveredServiceScope, setHoveredServiceScope] = useState<DatabaseExplorerScopeValue | null>(null);
  const [engineFlyoutPosition, setEngineFlyoutPosition] = useState<{ top: number; left: number } | null>(null);
  const [draftGroupBy, setDraftGroupBy] = useState<DatabaseExplorerGroupBy>(groupBy);
  const [draftGroupValues, setDraftGroupValues] = useState<string[]>(groupValues);
  const flyoutHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFlyoutHideTimer = () => {
    if (!flyoutHideTimerRef.current) return;
    clearTimeout(flyoutHideTimerRef.current);
    flyoutHideTimerRef.current = null;
  };

  const scheduleFlyoutHide = () => {
    clearFlyoutHideTimer();
    flyoutHideTimerRef.current = setTimeout(() => {
      setHoveredServiceScope(null);
      setEngineFlyoutPosition(null);
    }, 120);
  };

  const availableServices = useMemo(() => uniqueSorted(backendServiceOptions), [backendServiceOptions]);
  const availableEngines = useMemo(() => uniqueSorted(backendEngineOptions), [backendEngineOptions]);
  const serviceEntries = useMemo(
    () =>
      availableServices
        .map((service) => {
          const scope = serviceToScope(service);
          return {
            service,
            scope,
            engines: availableEngines.filter((engine) => engineBelongsToService(engine, service)),
          };
        })
        .filter((entry) => entry.scope !== "all" && isDatabaseScopeAvailable(entry.scope, availableDatabaseScopes)),
    [availableDatabaseScopes, availableEngines, availableServices],
  );
  const allowedDimensionSet = useMemo(() => new Set(allowedGroupBy), [allowedGroupBy]);
  const visibleGroupByDimensions = useMemo(
    () => groupByDimensions.filter((dimension) => allowedDimensionSet.has(dimension.key)),
    [allowedDimensionSet],
  );
  const activeGroupByOption = groupByOptions.find((option) => option.value === effectiveGroupBy) ?? groupByOptions[0];
  const groupByLabel = activeGroupByOption.label;
  const groupByAllLabel = activeGroupByOption.allLabel;
  const scopedFiltersLabel = `Filters for ${groupByLabel}`;
  const filtersChipLabel =
    groupValues.length === 0 ? `Filters: All ${groupByAllLabel}` : `Filters: ${groupValues.length} selected`;

  const databaseLabel = useMemo(() => {
    if (!dbService.trim() && !dbEngine.trim()) return "All Databases";
    if (!dbService.trim() && dbEngine.trim()) return dbEngine.trim();
    return dbEngine.trim() ? `${dbService.trim()} - ${dbEngine.trim()}` : dbService.trim();
  }, [dbEngine, dbService]);

  const chips = [
    { key: "database", label: "Database", value: databaseLabel },
    { key: "groupBy", label: "Group By", value: groupByLabel },
    { key: "groupValues", label: "Filters", value: filtersChipLabel.replace(/^Filters:\s*/, "") },
  ];

  const openGroupDrawer = () => {
    setDraftGroupBy(groupBy);
    setDraftGroupValues(groupValues);
    setGroupDrawerOpen(true);
  };

  const groupedValuesPreview = useMemo(() => {
    const preview = groupedValuePreview?.[draftGroupBy];
    if (!Array.isArray(preview)) return [];
    return uniqueSorted(preview);
  }, [draftGroupBy, groupedValuePreview]);

  const applyGroupDrawer = () => {
    const safeGroupBy = allowedDimensionSet.has(draftGroupBy) ? draftGroupBy : (allowedGroupBy[0] ?? "db_service");
    const available = new Set(groupedValuesPreview);
    const safeValues = draftGroupValues.filter((value) => available.has(value));
    onApplyGroupBy({ groupBy: safeGroupBy, groupValues: safeValues });
    setGroupDrawerOpen(false);
  };

  return (
    <section className="cost-explorer-control-surface" aria-label="Database explorer controls">
      <div className="cost-explorer-toolbar-row">
        <div className="cost-explorer-toolbar-item" style={{ position: "relative" }}>
          <button
            type="button"
            className={`cost-explorer-toolbar-trigger${databaseMenuOpen ? " is-active" : ""}`}
            onClick={() => {
              setDatabaseMenuOpen((prev) => {
                if (prev) {
                  clearFlyoutHideTimer();
                  setHoveredServiceScope(null);
                  setEngineFlyoutPosition(null);
                }
                return !prev;
              });
            }}
            title={databaseLabel}
          >
            <span className="cost-explorer-toolbar-trigger__label">Database</span>
            <span className="cost-explorer-toolbar-trigger__row">
              <span className="cost-explorer-toolbar-trigger__value">{databaseLabel}</span>
              <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
            </span>
          </button>
          {databaseMenuOpen ? (
            <div className="cost-explorer-filter-popover" role="dialog" aria-label="Database service and engine">
              <p className="cost-explorer-filter-popover__title">Database Service</p>
              <div className="cost-explorer-filter-popover__list" role="listbox" style={{ maxHeight: 360, overflowY: "auto" }}>
                <button
                  type="button"
                  className={`cost-explorer-filter-option${!dbService.trim() && !dbEngine.trim() ? " is-active" : ""}`}
                  onClick={() => {
                    onApplyScope({ databaseScope: "all", dbService: "", dbEngine: "" });
                    setDatabaseMenuOpen(false);
                  }}
                >
                  <span className="cost-explorer-filter-option__label">All Databases</span>
                  {!dbService.trim() && !dbEngine.trim() ? <Check className="cost-explorer-filter-option__check" size={15} aria-hidden="true" /> : null}
                </button>

                {serviceEntries.map((entry) => {
                    const matchedService = entry.service;
                    const selectedService = databaseScope === entry.scope || serviceMatchesScope(dbService, entry.scope);
                    const matchingEngines = entry.engines;
                    const showEngines = matchingEngines.length > 0 && hoveredServiceScope === entry.scope;
                    return (
                      <div
                        key={entry.scope}
                        style={{ position: "relative" }}
                        onMouseEnter={(event) => {
                          clearFlyoutHideTimer();
                          setHoveredServiceScope(entry.scope);
                          const rect = event.currentTarget.getBoundingClientRect();
                          setEngineFlyoutPosition({
                            top: rect.top,
                            left: rect.right + 6,
                          });
                        }}
                        onMouseLeave={scheduleFlyoutHide}
                      >
                        <button
                          type="button"
                          className={`cost-explorer-filter-option${selectedService && !dbEngine.trim() ? " is-active" : ""}`}
                          onFocus={(event) => {
                            clearFlyoutHideTimer();
                            setHoveredServiceScope(entry.scope);
                            const rect = event.currentTarget.getBoundingClientRect();
                            setEngineFlyoutPosition({
                              top: rect.top,
                              left: rect.right + 6,
                            });
                          }}
                          onBlur={scheduleFlyoutHide}
                          onClick={() => {
                            onApplyScope({ databaseScope: entry.scope, dbService: matchedService, dbEngine: "" });
                          }}
                        >
                          <span className="cost-explorer-filter-option__label">{matchedService}</span>
                          {selectedService && !dbEngine.trim() ? <Check className="cost-explorer-filter-option__check" size={15} aria-hidden="true" /> : null}
                        </button>
                        {showEngines && engineFlyoutPosition
                          ? createPortal(
                              <div
                                className="cost-explorer-filter-popover"
                                style={{
                                  position: "fixed",
                                  top: engineFlyoutPosition.top,
                                  left: engineFlyoutPosition.left,
                                  minWidth: 220,
                                  zIndex: 110,
                                  maxHeight: 320,
                                  overflowY: "auto",
                                }}
                                role="menu"
                                aria-label={`${matchedService} engines`}
                                onMouseEnter={clearFlyoutHideTimer}
                                onMouseLeave={scheduleFlyoutHide}
                              >
                                <p className="cost-explorer-filter-popover__title">Engines</p>
                                <div className="cost-explorer-filter-popover__list" role="listbox">
                                  {matchingEngines.map((engine) => {
                                    const selectedEngine =
                                      selectedService && dbEngine.trim().toLowerCase() === engine.trim().toLowerCase();
                                    return (
                                      <button
                                        key={`${entry.scope}-${engine}`}
                                        type="button"
                                        className={`cost-explorer-filter-option${selectedEngine ? " is-active" : ""}`}
                                        onClick={() => {
                                          onApplyScope({ databaseScope: entry.scope, dbService: matchedService, dbEngine: engine });
                                          clearFlyoutHideTimer();
                                          setHoveredServiceScope(null);
                                          setEngineFlyoutPosition(null);
                                          setDatabaseMenuOpen(false);
                                        }}
                                      >
                                        <span className="cost-explorer-filter-option__label">{engine}</span>
                                        {selectedEngine ? <Check className="cost-explorer-filter-option__check" size={15} aria-hidden="true" /> : null}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>,
                              document.body,
                            )
                          : null}
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : null}
        </div>
        <div className="cost-explorer-toolbar-item">
          <button
            type="button"
            className="cost-explorer-toolbar-trigger"
            onClick={openGroupDrawer}
            title={groupByLabel}
            data-testid="database-explorer-groupby-control"
          >
            <span className="cost-explorer-toolbar-trigger__label">Group By</span>
            <span className="cost-explorer-toolbar-trigger__row">
              <span className="cost-explorer-toolbar-trigger__value">{groupByLabel}</span>
              <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
            </span>
          </button>
        </div>
        <div className="cost-explorer-toolbar-item">
          <button
            type="button"
            className="cost-explorer-toolbar-trigger"
            onClick={openGroupDrawer}
            title={scopedFiltersLabel}
            data-testid="database-explorer-scoped-filters-control"
          >
            <span className="cost-explorer-toolbar-trigger__label">Filters</span>
            <span className="cost-explorer-toolbar-trigger__row">
              <span className="cost-explorer-toolbar-trigger__value">{filtersChipLabel.replace("Filters: ", "")}</span>
              <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
            </span>
          </button>
        </div>
      </div>

      <div className="cost-explorer-chip-bar" aria-label="Selected filter summary">
        <div className="cost-explorer-chip-row">
          {chips.map((chip) => (
            <span key={chip.key} className="cost-explorer-chip" data-testid={chip.key === "groupValues" ? "database-explorer-filter-chip" : undefined}>
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

      <Dialog open={groupDrawerOpen} onOpenChange={setGroupDrawerOpen}>
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
                    <div className="cost-explorer-filter-popover__list cost-explorer-filter-popover__list--group-dimensions" role="listbox" aria-label="Group by dimensions">
                      {visibleGroupByDimensions.map((dimension) => {
                        const selected = draftGroupBy === dimension.key;
                        return (
                          <button
                            key={dimension.key}
                            type="button"
                            className={`cost-explorer-filter-option database-explorer-groupby__dimension-option${
                              selected ? " is-active database-explorer-groupby__dimension-option--selected" : ""
                            }`}
                            onClick={() => {
                              setDraftGroupBy(dimension.key);
                              setDraftGroupValues([]);
                            }}
                            role="option"
                            aria-selected={selected}
                            style={selected ? groupBySelectedStyle : undefined}
                          >
                            <span className="cost-explorer-filter-option__label">{dimension.label}</span>
                            {selected ? <Check className="cost-explorer-filter-option__check" size={15} aria-hidden="true" /> : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="cost-explorer-filter-popover__split-pane cost-explorer-filter-popover__split-pane--right">
                    <div className="database-explorer-groupby__panel">
                      <p className="cost-explorer-filter-popover__title">Filters</p>
                      <div className="database-explorer-groupby__panel-body">
                        <section className="database-explorer-groupby__section" aria-labelledby="database-groupby-selection">
                          <p id="database-groupby-selection" className="database-explorer-groupby__section-label">
                            Selected dimension
                          </p>
                          <div className="database-explorer-groupby__section-list">
                            <div
                              className="cost-explorer-filter-option is-active database-explorer-groupby__selected-dimension"
                              role="status"
                              style={groupBySelectedStyle}
                            >
                              <span className="cost-explorer-filter-option__label">
                                {groupByOptions.find((option) => option.value === draftGroupBy)?.label ?? "Group"}
                              </span>
                              <Check className="cost-explorer-filter-option__check" size={15} aria-hidden="true" />
                            </div>
                          </div>
                        </section>
                        <section className="database-explorer-groupby__section" aria-labelledby="database-groupby-values">
                          <p id="database-groupby-values" className="database-explorer-groupby__section-label">
                            {`Filters for ${groupByOptions.find((option) => option.value === draftGroupBy)?.label ?? "Group"}`}
                          </p>
                          <div className="database-explorer-groupby__section-list">
                            {groupedValuesPreview.length > 0 ? (
                              groupedValuesPreview.map((value) => (
                                <button
                                  key={`${draftGroupBy}-${value}`}
                                  type="button"
                                  className={`cost-explorer-filter-option${draftGroupValues.includes(value) ? " is-active" : ""}`}
                                  role="option"
                                  aria-selected={draftGroupValues.includes(value)}
                                  style={draftGroupValues.includes(value) ? groupBySelectedStyle : groupByValuePreviewStyle}
                                  onClick={() =>
                                    setDraftGroupValues((prev) =>
                                      prev.includes(value) ? prev.filter((entry) => entry !== value) : [...prev, value],
                                    )
                                  }
                                >
                                  <span className="cost-explorer-filter-option__label">{value}</span>
                                  {draftGroupValues.includes(value) ? (
                                    <Check className="cost-explorer-filter-option__check" size={15} aria-hidden="true" />
                                  ) : null}
                                </button>
                              ))
                            ) : (
                              <p className="database-explorer-groupby__section-empty">
                                Filters are contextual to this Group By dimension and appear when available.
                              </p>
                            )}
                          </div>
                          <p className="database-explorer-groupby__section-empty">
                            Select one or more filters scoped to the selected Group By dimension.
                          </p>
                        </section>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="cost-explorer-filter-popover__actions">
                <button type="button" className="cost-explorer-filter-popover__apply" onClick={applyGroupDrawer}>
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
