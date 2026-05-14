import { Check, ChevronDown } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type {
  DatabaseExplorerGroupBy,
  DatabaseExplorerMetric,
  DatabaseExplorerScopeValue,
} from "../../../api/dashboardTypes";
import { DATABASE_SCOPE_NAV_SECTIONS, isDatabaseScopeAvailable } from "../databaseExplorer.scope";
import { deriveAutoGroupBy, getEnginesForDatabaseScope } from "../databaseExplorer.taxonomy";

type DatabaseExplorerFiltersProps = {
  metric: DatabaseExplorerMetric;
  databaseScope: DatabaseExplorerScopeValue;
  dbService: string;
  dbEngine: string;
  groupBy: "auto" | DatabaseExplorerGroupBy;
  effectiveGroupBy: DatabaseExplorerGroupBy;
  availableDatabaseScopes: DatabaseExplorerScopeValue[];
  backendServiceOptions: string[];
  backendEngineOptions: string[];
  onApplyScope: (next: { databaseScope: DatabaseExplorerScopeValue; dbService: string; dbEngine: string }) => void;
  onApplyGroupBy: (next: { groupBy: "auto" | DatabaseExplorerGroupBy }) => void;
  onClearAll: () => void;
};

const groupByOptions: Array<{ value: "auto" | DatabaseExplorerGroupBy; label: string }> = [
  { value: "auto", label: "Recommended" },
  { value: "db_type", label: "Database Type" },
  { value: "db_service", label: "DB Service" },
  { value: "db_engine", label: "DB Engine" },
  { value: "region", label: "Region" },
  { value: "resource_type", label: "Resource Type" },
  { value: "instance_class", label: "Instance Class" },
  { value: "cluster", label: "Cluster" },
  { value: "cost_category", label: "Cost Category" },
];

const groupByDimensions: Array<{ key: DatabaseExplorerGroupBy; label: string }> = [
  { key: "db_type", label: "Database Type" },
  { key: "region", label: "Region" },
  { key: "cost_category", label: "Cost Category" },
  { key: "resource_type", label: "Resource Type" },
  { key: "instance_class", label: "Instance Class" },
  { key: "cluster", label: "Cluster" },
  { key: "db_service", label: "DB Service" },
  { key: "db_engine", label: "DB Engine" },
];

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

export function DatabaseExplorerFilters({
  metric,
  databaseScope,
  dbService,
  dbEngine,
  groupBy,
  effectiveGroupBy,
  availableDatabaseScopes,
  backendServiceOptions,
  backendEngineOptions,
  onApplyScope,
  onApplyGroupBy,
  onClearAll,
}: DatabaseExplorerFiltersProps) {
  const [databaseMenuOpen, setDatabaseMenuOpen] = useState(false);
  const [groupDrawerOpen, setGroupDrawerOpen] = useState(false);
  const [hoveredServiceScope, setHoveredServiceScope] = useState<DatabaseExplorerScopeValue | null>(null);
  const [engineFlyoutPosition, setEngineFlyoutPosition] = useState<{ top: number; left: number } | null>(null);
  const [draftGroupBy, setDraftGroupBy] = useState<"auto" | DatabaseExplorerGroupBy>(groupBy);
  const [activeGroupDimension, setActiveGroupDimension] = useState<DatabaseExplorerGroupBy>(effectiveGroupBy);
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
  const effectiveGroupByLabel = groupByOptions.find((option) => option.value === effectiveGroupBy)?.label ?? "Recommended";
  const groupByLabel = groupBy === "auto" ? `Auto · ${effectiveGroupByLabel}` : effectiveGroupByLabel;
  const recommendedPreview = useMemo(
    () => deriveAutoGroupBy(databaseScope, dbService, dbEngine),
    [databaseScope, dbEngine, dbService],
  );
  const recommendedPreviewLabel = groupByOptions.find((o) => o.value === recommendedPreview)?.label ?? "Database Type";

  const databaseLabel = useMemo(() => {
    if (!dbService.trim() && !dbEngine.trim()) return "All Databases";
    if (!dbService.trim() && dbEngine.trim()) return dbEngine.trim();
    return dbEngine.trim() ? `${dbService.trim()} · ${dbEngine.trim()}` : dbService.trim();
  }, [dbEngine, dbService]);

  const chips = [
    { key: "database", label: "Database", value: databaseLabel },
    { key: "groupBy", label: "Group By", value: groupByLabel },
  ];

  const openGroupDrawer = () => {
    setDraftGroupBy(groupBy);
    setActiveGroupDimension(groupBy === "auto" ? effectiveGroupBy : groupBy);
    setGroupDrawerOpen(true);
  };

  const applyGroupDrawer = () => {
    const safe = metric === "usage" && draftGroupBy === "cost_category" ? "auto" : draftGroupBy;
    onApplyGroupBy({ groupBy: safe });
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

                {DATABASE_SCOPE_NAV_SECTIONS.map((section) =>
                  section.services.map((svc) => {
                    const scopeEnabled = isDatabaseScopeAvailable(svc.scope, availableDatabaseScopes);
                    if (!scopeEnabled) return null;
                    const matchedService = availableServices.find((service) => serviceMatchesScope(service, svc.scope)) ?? svc.label;
                    const selectedService = databaseScope === svc.scope || serviceMatchesScope(dbService, svc.scope);
                    const scopedEngines = getEnginesForDatabaseScope(svc.scope);
                    const scopedEngineSet = new Set(scopedEngines.map((engine) => engine.trim().toLowerCase()));
                    const matchingEngines = availableEngines.filter((engine) => scopedEngineSet.has(engine.trim().toLowerCase()));
                    const showEngines = matchingEngines.length > 0 && hoveredServiceScope === svc.scope;
                    return (
                      <div
                        key={svc.scope}
                        style={{ position: "relative" }}
                        onMouseEnter={(event) => {
                          clearFlyoutHideTimer();
                          setHoveredServiceScope(svc.scope);
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
                            setHoveredServiceScope(svc.scope);
                            const rect = event.currentTarget.getBoundingClientRect();
                            setEngineFlyoutPosition({
                              top: rect.top,
                              left: rect.right + 6,
                            });
                          }}
                          onBlur={scheduleFlyoutHide}
                          onClick={() => {
                            onApplyScope({ databaseScope: svc.scope, dbService: matchedService, dbEngine: "" });
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
                                        key={`${svc.scope}-${engine}`}
                                        type="button"
                                        className={`cost-explorer-filter-option${selectedEngine ? " is-active" : ""}`}
                                        onClick={() => {
                                          onApplyScope({ databaseScope: svc.scope, dbService: matchedService, dbEngine: engine });
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
                  }),
                )}
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
          >
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
                      <button
                        type="button"
                        className={`cost-explorer-filter-option${draftGroupBy === "auto" ? " is-active" : ""}`}
                        onClick={() => {
                          setDraftGroupBy("auto");
                          setActiveGroupDimension(effectiveGroupBy);
                        }}
                        role="option"
                        aria-selected={draftGroupBy === "auto"}
                      >
                        <span className="cost-explorer-filter-option__label">Recommended</span>
                        {draftGroupBy === "auto" ? <Check className="cost-explorer-filter-option__check" size={15} aria-hidden="true" /> : null}
                      </button>
                      {groupByDimensions.map((dimension) => {
                        const selected =
                          draftGroupBy === "auto" ? activeGroupDimension === dimension.key : draftGroupBy === dimension.key;
                        const disabled = metric === "usage" && dimension.key === "cost_category";
                        return (
                          <button
                            key={dimension.key}
                            type="button"
                            className={`cost-explorer-filter-option${selected ? " is-active" : ""}`}
                            onClick={() => {
                              if (disabled) return;
                              setActiveGroupDimension(dimension.key);
                              setDraftGroupBy(dimension.key);
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
                    <div className="database-explorer-groupby__panel">
                      <p className="cost-explorer-filter-popover__title">Values</p>
                      <div className="database-explorer-groupby__panel-body">
                        <section className="database-explorer-groupby__section" aria-labelledby="database-groupby-selection">
                          <p id="database-groupby-selection" className="database-explorer-groupby__section-label">
                            Selected dimension
                          </p>
                          <div className="database-explorer-groupby__section-list">
                            <div className="cost-explorer-filter-option is-active" role="status">
                              <span className="cost-explorer-filter-option__label">
                                {draftGroupBy === "auto"
                                  ? `Recommended (${recommendedPreviewLabel})`
                                  : (groupByOptions.find((option) => option.value === draftGroupBy)?.label ?? "Group")}
                              </span>
                              <Check className="cost-explorer-filter-option__check" size={15} aria-hidden="true" />
                            </div>
                          </div>
                          <p className="database-explorer-groupby__section-empty">
                            Group the already-filtered database selection by this dimension.
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
