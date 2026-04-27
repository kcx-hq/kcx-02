import { Check, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { EC2ScopeFilters } from "../ec2ExplorerControls.types";

type FilterGroupKey = keyof EC2ScopeFilters;

const FILTER_GROUPS: Array<{
  key: FilterGroupKey;
  label: string;
  values: Array<{ key: string; label: string; count: number }>;
}> = [
  {
    key: "region",
    label: "Region",
    values: [
      { key: "us-east-1", label: "US East (N. Virginia)", count: 113962 },
      { key: "us-west-2", label: "US West (Oregon)", count: 4281 },
      { key: "eu-west-1", label: "EU (Ireland)", count: 4281 },
      { key: "ap-south-1", label: "Asia Pacific (Mumbai)", count: 7156 },
    ],
  },
  {
    key: "tags",
    label: "Tags",
    values: [
      { key: "critical", label: "critical", count: 76 },
      { key: "batch", label: "batch", count: 49 },
      { key: "customer-facing", label: "customer-facing", count: 39 },
      { key: "internal", label: "internal", count: 31 },
    ],
  },
];

type EC2ExplorerScopeFiltersProps = {
  value: EC2ScopeFilters;
  onChange: (next: EC2ScopeFilters) => void;
  onApply?: () => void;
};

export function EC2ExplorerScopeFilters({ value, onChange, onApply }: EC2ExplorerScopeFiltersProps) {
  const [activeGroup, setActiveGroup] = useState<FilterGroupKey>("region");
  const [draft, setDraft] = useState<EC2ScopeFilters>(value);
  const [groupSearch, setGroupSearch] = useState("");

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const activeValues = useMemo(
    () => FILTER_GROUPS.find((group) => group.key === activeGroup)?.values ?? [],
    [activeGroup],
  );

  const filteredGroups = useMemo(() => {
    const query = groupSearch.trim().toLowerCase();
    if (!query) return FILTER_GROUPS;
    return FILTER_GROUPS.filter((group) => group.label.toLowerCase().includes(query));
  }, [groupSearch]);

  useEffect(() => {
    if (filteredGroups.length === 0) return;
    if (!filteredGroups.some((group) => group.key === activeGroup)) {
      setActiveGroup(filteredGroups[0].key);
    }
  }, [activeGroup, filteredGroups]);

  const toggle = (group: FilterGroupKey, option: string) => {
    const selected = draft[group];
    const exists = selected.includes(option);
    setDraft({
      ...draft,
      [group]: exists ? selected.filter((item) => item !== option) : [...selected, option],
    });
  };

  return (
    <div className="ec2-explorer-scope-filters" role="dialog" aria-label="Scope filters">
      <div className="cost-explorer-filter-popover__split ec2-explorer-scope-filters__split">
        <div className="cost-explorer-filter-popover__split-pane">
          <p className="cost-explorer-filter-popover__title">Common Scope</p>
          <label className="cost-explorer-filter-popover__search-wrap">
            <Search className="cost-explorer-filter-popover__search-icon" size={14} aria-hidden="true" />
            <input
              type="search"
              className="cost-explorer-filter-popover__search-input"
              value={groupSearch}
              onChange={(event) => setGroupSearch(event.target.value)}
              placeholder="Search dimensions..."
            />
          </label>
          <div
            className="cost-explorer-filter-popover__list cost-explorer-filter-popover__list--group-dimensions"
            role="listbox"
            aria-label="Filter groups"
          >
            {filteredGroups.map((group) => {
              const selected = group.key === activeGroup;
              return (
                <button
                  key={group.key}
                  type="button"
                  className={`cost-explorer-filter-option${selected ? " is-active" : ""}`}
                  onClick={() => setActiveGroup(group.key)}
                  role="option"
                  aria-selected={selected}
                >
                  <span className="cost-explorer-filter-option__label">{group.label}</span>
                  {selected ? <Check className="cost-explorer-filter-option__check" size={15} aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="cost-explorer-filter-popover__split-pane cost-explorer-filter-popover__split-pane--right">
          <p className="cost-explorer-filter-popover__title">Values</p>
          <div className="cost-explorer-filter-popover__list cost-explorer-filter-popover__list--value-boxes" role="listbox" aria-label="Filter values">
            <button
              type="button"
              className={`cost-explorer-filter-option cost-explorer-filter-option--tile${(draft[activeGroup]?.length ?? 0) === 0 ? " is-active" : ""}`}
              onClick={() => setDraft({ ...draft, [activeGroup]: [] })}
              role="option"
              aria-selected={(draft[activeGroup]?.length ?? 0) === 0}
            >
              <span className="cost-explorer-filter-option__content">
                <span className="cost-explorer-filter-option__label">All values</span>
              </span>
              {(draft[activeGroup]?.length ?? 0) === 0 ? (
                <Check className="cost-explorer-filter-option__check" size={15} aria-hidden="true" />
              ) : null}
            </button>
            {activeValues.map((entry) => {
              const selected = draft[activeGroup].includes(entry.key);
              return (
                <button
                  key={entry.key}
                  type="button"
                  className={`cost-explorer-filter-option cost-explorer-filter-option--tile${selected ? " is-active" : ""}`}
                  onClick={() => toggle(activeGroup, entry.key)}
                  role="option"
                  aria-selected={selected}
                >
                  <span className="cost-explorer-filter-option__content">
                    <span className="cost-explorer-filter-option__label">{entry.label}</span>
                  </span>
                  <span className="cost-explorer-filter-option__label">{entry.count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="cost-explorer-filter-popover__actions">
        <button
          type="button"
          className="cost-explorer-filter-popover__apply"
          onClick={() => {
            onChange(draft);
            onApply?.();
          }}
        >
          Apply
        </button>
      </div>
    </div>
  );
}
