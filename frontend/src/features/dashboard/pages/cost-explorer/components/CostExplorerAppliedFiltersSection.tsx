import { X } from "lucide-react";

import type { CostExplorerChip } from "../costExplorer.types";

type CostExplorerAppliedFiltersSectionProps = {
  chips: CostExplorerChip[];
  onEditChip: (key: CostExplorerChip["key"]) => void;
  onRemoveChip: (key: CostExplorerChip["key"]) => void;
  onClearAll: () => void;
};

export function CostExplorerAppliedFiltersSection({
  chips,
  onEditChip,
  onRemoveChip,
  onClearAll,
}: CostExplorerAppliedFiltersSectionProps) {
  return (
    <section className="cost-explorer-chip-surface" aria-label="Selected filter summary">
      <div className="cost-explorer-chip-row">
        {chips.map((chip) => (
          <span key={chip.key} className="cost-explorer-chip">
            <button type="button" className="cost-explorer-chip__edit" onClick={() => onEditChip(chip.key)}>
              {chip.label}: {chip.value}
            </button>
            <button type="button" className="cost-explorer-chip__remove" onClick={() => onRemoveChip(chip.key)} aria-label={`Remove ${chip.label}`}>
              <X size={13} aria-hidden="true" />
            </button>
          </span>
        ))}
        <button type="button" className="cost-explorer-chip-bar__clear cost-explorer-chip-bar__clear--inline" onClick={onClearAll}>
          Clear all
        </button>
      </div>
    </section>
  );
}
