import { Check, ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type {
  DatabaseExplorerGroupBy,
  DatabaseExplorerMetric,
  DatabaseExplorerScopeValue,
} from "../../../api/dashboardTypes";
import {
  DATABASE_SCOPE_NAV_SECTIONS,
  formatDatabaseScopeChip,
  isDatabaseScopeAvailable,
} from "../databaseExplorer.scope";
import {
  deriveAutoGroupBy,
  getEnginesForDatabaseScope,
  resolveHierarchyFromEngine,
  scopeValueFromTaxonomy,
} from "../databaseExplorer.taxonomy";

type DatabaseExplorerFiltersProps = {
  metric: DatabaseExplorerMetric;
  databaseScope: DatabaseExplorerScopeValue;
  dbService: string;
  dbEngine: string;
  groupBy: "auto" | DatabaseExplorerGroupBy;
  effectiveGroupBy: DatabaseExplorerGroupBy;
  availableDatabaseScopes: DatabaseExplorerScopeValue[];
  backendEngineOptions: string[];
  onApplyScope: (next: { databaseScope: DatabaseExplorerScopeValue; dbService: string; dbEngine: string }) => void;
  onApplyGroupBy: (next: { groupBy: "auto" | DatabaseExplorerGroupBy }) => void;
  onClearAll: () => void;
};

const metricOptions: Array<{ value: DatabaseExplorerMetric; label: string }> = [
  { value: "cost", label: "Cost" },
  { value: "usage", label: "Usage" },
];

const groupByOptions: Array<{ value: "auto" | DatabaseExplorerGroupBy; label: string }> = [
  { value: "auto", label: "Recommended" },
  { value: "db_service", label: "DB Service" },
  { value: "db_engine", label: "DB Engine" },
  { value: "region", label: "Region" },
  { value: "resource_type", label: "Resource Type" },
  { value: "instance_class", label: "Instance Class" },
  { value: "cluster", label: "Cluster" },
  { value: "cost_category", label: "Cost Category" },
];

const groupByDimensions: Array<{ key: DatabaseExplorerGroupBy; label: string }> = [
  { key: "region", label: "Region" },
  { key: "cost_category", label: "Cost Category" },
  { key: "resource_type", label: "Resource Type" },
  { key: "instance_class", label: "Instance Class" },
  { key: "cluster", label: "Cluster" },
  { key: "db_service", label: "DB Service" },
  { key: "db_engine", label: "DB Engine" },
];

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
  backendEngineOptions,
  onApplyScope,
  onApplyGroupBy,
  onClearAll,
}: DatabaseExplorerFiltersProps) {
  const [scopeDrawerOpen, setScopeDrawerOpen] = useState(false);
  const [groupDrawerOpen, setGroupDrawerOpen] = useState(false);

  const [draftScope, setDraftScope] = useState<DatabaseExplorerScopeValue>(databaseScope);
  const [draftDbService, setDraftDbService] = useState(dbService);
  const [draftDbEngine, setDraftDbEngine] = useState(dbEngine);

  const [draftGroupBy, setDraftGroupBy] = useState<"auto" | DatabaseExplorerGroupBy>(groupBy);
  const [activeGroupDimension, setActiveGroupDimension] = useState<DatabaseExplorerGroupBy>(effectiveGroupBy);

  const scopeLabel = useMemo(
    () => formatDatabaseScopeChip(databaseScope, dbService, dbEngine),
    [databaseScope, dbEngine, dbService],
  );

  const effectiveGroupByLabel = groupByOptions.find((option) => option.value === effectiveGroupBy)?.label ?? "Recommended";
  const groupByLabel = groupBy === "auto" ? `Auto · ${effectiveGroupByLabel}` : effectiveGroupByLabel;

  const recommendedPreview = useMemo(
    () => deriveAutoGroupBy(databaseScope, dbService, dbEngine),
    [databaseScope, dbEngine, dbService],
  );
  const recommendedPreviewLabel = groupByOptions.find((o) => o.value === recommendedPreview)?.label ?? "DB Service";

  const engineChoices = useMemo(() => {
    const taxonomyEngines = getEnginesForDatabaseScope(draftScope);
    const backend = uniqueSorted(backendEngineOptions);
    if (draftScope === "all") return backend;
    const allowed = new Set(taxonomyEngines.map((e) => e.trim().toLowerCase()));
    const narrowed = backend.filter((e) => allowed.has(e.trim().toLowerCase()));
    return narrowed.length > 0 ? narrowed : taxonomyEngines;
  }, [backendEngineOptions, draftScope]);

  const openScopeDrawer = () => {
    setDraftScope(databaseScope);
    setDraftDbService(dbService);
    setDraftDbEngine(dbEngine);
    setScopeDrawerOpen(true);
  };

  const applyScopeDrawer = () => {
    onApplyScope({
      databaseScope: draftScope,
      dbService: draftDbService,
      dbEngine: draftDbEngine,
    });
    setScopeDrawerOpen(false);
  };

  const selectDraftScope = (scope: DatabaseExplorerScopeValue) => {
    setDraftScope(scope);
    setDraftDbService("");
    setDraftDbEngine("");
  };

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

  const chips = [
    { key: "metric", label: "Metric", value: metricOptions.find((option) => option.value === metric)?.label ?? metric },
    { key: "databaseScope", label: "Database Scope", value: scopeLabel },
    { key: "groupBy", label: "Group By", value: groupByLabel },
  ];

  return (
    <section className="cost-explorer-control-surface" aria-label="Database explorer controls">
      <div className="cost-explorer-toolbar-row">
        <div className="cost-explorer-toolbar-item">
          <button
            type="button"
            className="cost-explorer-toolbar-trigger"
            onClick={openScopeDrawer}
            title={scopeLabel}
          >
            <span className="cost-explorer-toolbar-trigger__label">Database Scope</span>
            <span className="cost-explorer-toolbar-trigger__row">
              <span className="cost-explorer-toolbar-trigger__value">{scopeLabel}</span>
              <ChevronDown className="cost-explorer-toolbar-trigger__caret" size={14} aria-hidden="true" />
            </span>
          </button>
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

      <Dialog open={scopeDrawerOpen} onOpenChange={setScopeDrawerOpen}>
        <DialogContent className="database-explorer-scope-drawer left-auto right-0 top-0 h-screen max-h-screen w-[min(96vw,42rem)] max-w-none -translate-x-0 -translate-y-0 rounded-none border-l border-[color:var(--border-light)] p-6 data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-xl font-semibold text-text-primary">Database Scope</DialogTitle>
          </DialogHeader>
          <div className="mt-4 db-scope-filter" role="presentation">
            <nav className="db-scope-filter__body" aria-label="Database scope">
              <div className="db-scope-filter__list">
                <button
                  type="button"
                  className={`db-scope-filter__row${draftScope === "all" ? " is-active" : ""}`}
                  onClick={() => selectDraftScope("all")}
                >
                  <span className="db-scope-filter__row-label">All Databases</span>
                  {draftScope === "all" ? <Check className="db-scope-filter__row-check" size={15} aria-hidden="true" /> : null}
                </button>

                {DATABASE_SCOPE_NAV_SECTIONS.map((section) => {
                  const portfolioScope = section.portfolioScope;
                  const portfolioEnabled =
                    portfolioScope != null && isDatabaseScopeAvailable(portfolioScope, availableDatabaseScopes);
                  const categorySelected = portfolioScope != null && draftScope === portfolioScope;
                  return (
                    <div key={section.categoryTitle} className="db-scope-filter__group">
                      {portfolioScope != null ? (
                        <button
                          type="button"
                          className={`db-scope-filter__row${categorySelected ? " is-active" : ""}`}
                          disabled={!portfolioEnabled}
                          onClick={() => {
                            if (!portfolioEnabled) return;
                            selectDraftScope(portfolioScope);
                          }}
                        >
                          <span className="db-scope-filter__row-label">{section.categoryTitle}</span>
                          {categorySelected ? <Check className="db-scope-filter__row-check" size={15} aria-hidden="true" /> : null}
                        </button>
                      ) : (
                        <div className="db-scope-filter__group-label">{section.categoryTitle}</div>
                      )}
                      <ul className="db-scope-filter__nested" role="list">
                        {section.services.map((svc) => {
                          const svcEnabled = isDatabaseScopeAvailable(svc.scope, availableDatabaseScopes);
                          const selected = draftScope === svc.scope;
                          return (
                            <li key={svc.scope}>
                              <button
                                type="button"
                                className={`db-scope-filter__row db-scope-filter__row--nested${selected ? " is-active" : ""}`}
                                disabled={!svcEnabled}
                                onClick={() => {
                                  if (!svcEnabled) return;
                                  selectDraftScope(svc.scope);
                                }}
                              >
                                <span className="db-scope-filter__row-label">{svc.label}</span>
                                {selected ? <Check className="db-scope-filter__row-check" size={15} aria-hidden="true" /> : null}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </nav>

            {draftScope !== "all" && engineChoices.length > 0 ? (
              <div className="db-scope-filter__engines" role="region" aria-label="Engine">
                <div className="db-scope-filter__engines-label">Engine</div>
                <ul className="db-scope-filter__engines-list" role="list">
                  {engineChoices.map((engine) => {
                    const selected = draftDbEngine === engine;
                    return (
                      <li key={engine}>
                        <button
                          type="button"
                          className={`db-scope-filter__row db-scope-filter__row--engine${selected ? " is-active" : ""}`}
                          onClick={() => {
                            const resolved = resolveHierarchyFromEngine(engine);
                            setDraftDbEngine(engine);
                            if (resolved) {
                              setDraftScope(scopeValueFromTaxonomy(resolved.databaseType, resolved.dbService));
                              setDraftDbService(resolved.dbService);
                            }
                          }}
                        >
                          <span className="db-scope-filter__row-label">{engine}</span>
                          {selected ? <Check className="db-scope-filter__row-check" size={15} aria-hidden="true" /> : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            <div className="db-scope-filter__footer">
              <div className="cost-explorer-filter-popover__actions">
                <button type="button" className="cost-explorer-filter-popover__apply" onClick={applyScopeDrawer}>
                  Apply
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
                                {draftGroupBy === "auto" ? `Recommended (${recommendedPreviewLabel})` : (groupByOptions.find((option) => option.value === draftGroupBy)?.label ?? "Group")}
                              </span>
                              <Check className="cost-explorer-filter-option__check" size={15} aria-hidden="true" />
                            </div>
                          </div>
                          <p className="database-explorer-groupby__section-empty">
                            Charts and the table group already-filtered data by this dimension. Database scope is configured separately.
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
