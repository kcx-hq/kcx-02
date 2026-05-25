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
  "availability-zone": [
    { key: "us-east-1a", label: "us-east-1a", count: 9280 },
    { key: "us-east-1b", label: "us-east-1b", count: 7330 },
    { key: "ap-south-1a", label: "ap-south-1a", count: 3120 },
  ],
  account: [
    { key: "Prod Account", label: "Prod Account", count: 9430 },
    { key: "Shared Services", label: "Shared Services", count: 3210 },
    { key: "Dev Account", label: "Dev Account", count: 2870 },
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
  "cost-category": [
    { key: "compute", label: "Compute", count: 7540 },
    { key: "volume", label: "Volume", count: 4820 },
    { key: "snapshot", label: "Snapshot", count: 2110 },
    { key: "data_transfer", label: "Data Transfer", count: 1870 },
    { key: "elastic_ip", label: "Elastic IP", count: 530 },
    { key: "other", label: "Other", count: 440 },
  ],
  "usage-type": [
    { key: "boxusage:m5.large", label: "BoxUsage:m5.large", count: 2110 },
    { key: "spotusage:c5.xlarge", label: "SpotUsage:c5.xlarge", count: 940 },
    { key: "ebs:volumeusage.gp3", label: "EBS:VolumeUsage.gp3", count: 1310 },
  ],
  operation: [
    { key: "runinstances", label: "RunInstances", count: 2440 },
    { key: "createnatgateway", label: "CreateNatGateway", count: 510 },
  ],
  "instance-state": [
    { key: "running", label: "Running", count: 5020 },
    { key: "stopped", label: "Stopped", count: 810 },
    { key: "terminated", label: "Terminated", count: 210 },
  ],
  recommendation: [
    { key: "idle", label: "Idle", count: 420 },
    { key: "underutilized", label: "Underutilized", count: 710 },
    { key: "overutilized", label: "Overutilized", count: 190 },
    { key: "uncovered", label: "Uncovered", count: 330 },
  ],
  volume: [
    { key: "vol-001", label: "vol-001", count: 44 },
    { key: "vol-002", label: "vol-002", count: 31 },
    { key: "vol-003", label: "vol-003", count: 27 },
  ],
  volume_type: [
    { key: "gp2", label: "gp2", count: 940 },
    { key: "gp3", label: "gp3", count: 1760 },
    { key: "io1", label: "io1", count: 210 },
    { key: "io2", label: "io2", count: 180 },
  ],
  attachment_state: [
    { key: "attached", label: "Attached", count: 1760 },
    { key: "unattached", label: "Unattached", count: 220 },
  ],
  instance: [
    { key: "i-0a12", label: "i-0a12", count: 143 },
    { key: "i-0b34", label: "i-0b34", count: 120 },
    { key: "i-0c56", label: "i-0c56", count: 97 },
  ],
  storage_tier: [
    { key: "SSD", label: "SSD", count: 1710 },
    { key: "HDD", label: "HDD", count: 240 },
    { key: "Unknown", label: "Unknown", count: 30 },
  ],
  iops_tier: [
    { key: "provisioned", label: "Provisioned", count: 310 },
    { key: "standard", label: "Standard", count: 1630 },
    { key: "unknown", label: "Unknown", count: 40 },
  ],
  size_bucket: [
    { key: "0-100 GB", label: "0-100 GB", count: 980 },
    { key: "101-500 GB", label: "101-500 GB", count: 660 },
    { key: "501 GB-1 TB", label: "501 GB-1 TB", count: 210 },
    { key: "1 TB+", label: "1 TB+", count: 90 },
  ],
  lifecycle_state: [
    { key: "in-use", label: "In Use", count: 1760 },
    { key: "available", label: "Available", count: 200 },
    { key: "unknown", label: "Unknown", count: 20 },
  ],
  "transfer-type": [
    { key: "internet", label: "Internet", count: 640 },
    { key: "inter_region", label: "Inter-Region", count: 310 },
    { key: "inter_az", label: "Inter-AZ", count: 220 },
    { key: "regional", label: "Regional", count: 170 },
    { key: "unknown", label: "Unknown", count: 90 },
  ],
  "source-region": [
    { key: "us-east-1", label: "us-east-1", count: 420 },
    { key: "ap-south-1", label: "ap-south-1", count: 190 },
    { key: "eu-west-1", label: "eu-west-1", count: 110 },
  ],
  "destination-region": [
    { key: "us-east-1", label: "us-east-1", count: 400 },
    { key: "ap-south-1", label: "ap-south-1", count: 170 },
    { key: "eu-west-1", label: "eu-west-1", count: 120 },
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
    "availability-zone": [],
    account: [],
    "instance-type": [],
    "reservation-type": [],
    "cost-category": [],
    "usage-type": [],
    operation: [],
    "instance-state": [],
    recommendation: [],
    volume: [],
    volume_type: [],
    attachment_state: [],
    instance: [],
    storage_tier: [],
    iops_tier: [],
    size_bucket: [],
    lifecycle_state: [],
    "transfer-type": [],
    "source-region": [],
    "destination-region": [],
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

  useEffect(() => {
    setValueSearch("");
  }, [activeGroupBy]);

  const activeValues = useMemo(() => GROUP_VALUE_OPTIONS[activeGroupBy] ?? [], [activeGroupBy]);
  const showValuePanel = activeGroupBy !== "none";
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
      <div className="ec2-explorer-groupby__body">
      <div className={`cost-explorer-filter-popover__split ec2-explorer-groupby__split${showValuePanel ? " ec2-explorer-groupby__split--with-values" : ""}`}>
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

        {showValuePanel ? (
          <div className="cost-explorer-filter-popover__split-pane cost-explorer-filter-popover__split-pane--right">
            <p className="cost-explorer-filter-popover__title">Values</p>
            <label className="cost-explorer-filter-popover__search-wrap">
              <Search className="cost-explorer-filter-popover__search-icon" size={14} aria-hidden="true" />
              <input
                type="search"
                className="cost-explorer-filter-popover__search-input"
                value={valueSearch}
                onChange={(event) => setValueSearch(event.target.value)}
                placeholder="Search tag keys..."
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
                    <span className="cost-explorer-filter-option__meta">
                      <span className="cost-explorer-filter-option__count">{option.count}</span>
                      {selected ? <Check className="cost-explorer-filter-option__check" size={15} aria-hidden="true" /> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
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
