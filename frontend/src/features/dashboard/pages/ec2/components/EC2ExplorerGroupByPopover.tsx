import { Check, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { EC2GroupBy } from "../ec2ExplorerControls.types";

type GroupByOption = {
  key: EC2GroupBy;
  label: string;
};

type GroupByValueOption = {
  key: string;
  label: string;
  count: number;
};

const GROUP_VALUE_OPTIONS: Record<EC2GroupBy, GroupByValueOption[]> = {
  none: [],
  region: [
    { key: "US East (N. Virginia)", label: "US East (N. Virginia)", count: 113962 },
    { key: "US East (Ohio)", label: "US East (Ohio)", count: 11530 },
    { key: "Asia Pacific (Mumbai)", label: "Asia Pacific (Mumbai)", count: 7156 },
    { key: "EU (Frankfurt)", label: "EU (Frankfurt)", count: 4326 },
    { key: "EU (Ireland)", label: "EU (Ireland)", count: 4281 },
    { key: "US West (Oregon)", label: "US West (Oregon)", count: 4281 },
    { key: "Asia Pacific (Tokyo)", label: "Asia Pacific (Tokyo)", count: 4276 },
    { key: "Asia Pacific (Seoul)", label: "Asia Pacific (Seoul)", count: 4276 },
  ],
  "instance-type": [
    { key: "t3.medium", label: "t3.medium", count: 2471 },
    { key: "t3.large", label: "t3.large", count: 2160 },
    { key: "m5.large", label: "m5.large", count: 1704 },
    { key: "m6i.large", label: "m6i.large", count: 1628 },
    { key: "c5.xlarge", label: "c5.xlarge", count: 941 },
  ],
  "reservation-type": [
    { key: "on_demand", label: "On Demand", count: 4982 },
    { key: "reserved", label: "Reserved", count: 2271 },
    { key: "savings_plan", label: "Savings Plan", count: 1492 },
  ],
  "usage-category": [
    { key: "cpu", label: "CPU", count: 5820 },
    { key: "network", label: "Network", count: 4710 },
    { key: "disk", label: "Disk", count: 3080 },
  ],
  "cost-category": [
    { key: "compute", label: "Compute", count: 7540 },
    { key: "ebs", label: "EBS", count: 4820 },
    { key: "snapshot", label: "Snapshot", count: 2110 },
    { key: "data_transfer", label: "Data Transfer", count: 1870 },
    { key: "eip", label: "EIP", count: 530 },
    { key: "other", label: "Other", count: 440 },
  ],
  tag: [
    { key: "production", label: "production", count: 98 },
    { key: "critical", label: "critical", count: 76 },
    { key: "batch", label: "batch", count: 49 },
    { key: "customer-facing", label: "customer-facing", count: 39 },
    { key: "internal", label: "internal", count: 31 },
  ],
};

type EC2ExplorerGroupByPopoverProps = {
  options: GroupByOption[];
  valueGroupBy: EC2GroupBy;
  valueGroupByValues: string[];
  onApply: (next: { groupBy: EC2GroupBy; groupByValues: string[] }) => void;
  onClose: () => void;
};

export function EC2ExplorerGroupByPopover({
  options,
  valueGroupBy,
  valueGroupByValues,
  onApply,
  onClose,
}: EC2ExplorerGroupByPopoverProps) {
  const [activeGroupBy, setActiveGroupBy] = useState<EC2GroupBy>(valueGroupBy);
  const [draftValuesByGroup, setDraftValuesByGroup] = useState<Record<EC2GroupBy, string[]>>({
    none: [],
    region: [],
    "instance-type": [],
    "reservation-type": [],
    "usage-category": [],
    "cost-category": [],
    tag: [],
  });
  const [groupSearch, setGroupSearch] = useState("");
  const [valueSearch, setValueSearch] = useState("");

  useEffect(() => {
    setActiveGroupBy(valueGroupBy);
    setDraftValuesByGroup((current) => ({
      ...current,
      [valueGroupBy]: valueGroupByValues,
    }));
  }, [valueGroupBy, valueGroupByValues]);

  const filteredGroups = useMemo(() => {
    const query = groupSearch.trim().toLowerCase();
    if (!query) return options;
    return options.filter((option) => option.label.toLowerCase().includes(query));
  }, [groupSearch, options]);

  useEffect(() => {
    if (filteredGroups.length === 0) return;
    if (!filteredGroups.some((option) => option.key === activeGroupBy)) {
      setActiveGroupBy(filteredGroups[0].key);
    }
  }, [activeGroupBy, filteredGroups]);

  const activeValues = useMemo(() => GROUP_VALUE_OPTIONS[activeGroupBy] ?? [], [activeGroupBy]);
  const filteredValues = useMemo(() => {
    const query = valueSearch.trim().toLowerCase();
    if (!query) return activeValues;
    return activeValues.filter((option) => option.label.toLowerCase().includes(query));
  }, [activeValues, valueSearch]);

  const selectedValues = draftValuesByGroup[activeGroupBy] ?? [];

  const toggleValue = (key: string) => {
    const next = selectedValues.includes(key)
      ? selectedValues.filter((value) => value !== key)
      : [...selectedValues, key];
    setDraftValuesByGroup((current) => ({ ...current, [activeGroupBy]: next }));
  };

  return (
    <div className="ec2-explorer-groupby" role="dialog" aria-label="Group by options">
      <div className="cost-explorer-filter-popover__split ec2-explorer-groupby__split">
        <div className="cost-explorer-filter-popover__split-pane">
          <p className="cost-explorer-filter-popover__title">Group By</p>
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
            aria-label="Group dimensions"
          >
            {filteredGroups.map((option) => {
              const selected = option.key === activeGroupBy;
              return (
                <button
                  key={option.key}
                  type="button"
                  className={`cost-explorer-filter-option${selected ? " is-active" : ""}`}
                  onClick={() => setActiveGroupBy(option.key)}
                  role="option"
                  aria-selected={selected}
                >
                  <span className="cost-explorer-filter-option__label">{option.label}</span>
                  {selected ? <Check className="cost-explorer-filter-option__check" size={15} aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="cost-explorer-filter-popover__split-pane cost-explorer-filter-popover__split-pane--right">
          <p className="cost-explorer-filter-popover__title">Values</p>
          <label className="cost-explorer-filter-popover__search-wrap">
            <Search className="cost-explorer-filter-popover__search-icon" size={14} aria-hidden="true" />
            <input
              type="search"
              className="cost-explorer-filter-popover__search-input"
              value={valueSearch}
              onChange={(event) => setValueSearch(event.target.value)}
              placeholder="Search values..."
            />
          </label>
          <div className="cost-explorer-filter-popover__list cost-explorer-filter-popover__list--value-boxes" role="listbox" aria-label="Group values">
            <button
              type="button"
              className={`cost-explorer-filter-option cost-explorer-filter-option--tile${selectedValues.length === 0 ? " is-active" : ""}`}
              onClick={() => setDraftValuesByGroup((current) => ({ ...current, [activeGroupBy]: [] }))}
              role="option"
              aria-selected={selectedValues.length === 0}
            >
              <span className="cost-explorer-filter-option__content">
                <span className="cost-explorer-filter-option__label">All values</span>
              </span>
              {selectedValues.length === 0 ? (
                <Check className="cost-explorer-filter-option__check" size={15} aria-hidden="true" />
              ) : null}
            </button>
            {filteredValues.map((option) => {
              const selected = selectedValues.includes(option.key);
              return (
                <button
                  key={option.key}
                  type="button"
                  className={`cost-explorer-filter-option cost-explorer-filter-option--tile${selected ? " is-active" : ""}`}
                  onClick={() => toggleValue(option.key)}
                  role="option"
                  aria-selected={selected}
                >
                  <span className="cost-explorer-filter-option__content">
                    <span className="cost-explorer-filter-option__label">{option.label}</span>
                  </span>
                  <span className="cost-explorer-filter-option__label">{option.count}</span>
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
            onApply({ groupBy: activeGroupBy, groupByValues: draftValuesByGroup[activeGroupBy] ?? [] });
            onClose();
          }}
        >
          Apply
        </button>
      </div>
    </div>
  );
}
